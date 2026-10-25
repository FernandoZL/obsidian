#!/usr/bin/python3
"""Run in the user's terminal: never pass an Apple password on the command line."""
import configparser
import getpass
import json
import os
import pathlib
import subprocess
import sys
import shutil
from contextlib import contextmanager

HOME = pathlib.Path.home()
RCLONE = os.environ.get('NEURONAS_RCLONE') or shutil.which('rclone') or HOME / '.local/bin/rclone'
CONFIG = pathlib.Path(os.environ.get('RCLONE_CONFIG', str(HOME / '.config/rclone/rclone.conf')))
SETTINGS = HOME / '.config/neuronas/icloud.json'
REMOTE = 'neuronas-icloud'


def obsidian_running():
    return subprocess.run(['pgrep', '-u', str(os.getuid()), '-x', 'obsidian'],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


@contextmanager
def quiet_capture():
    if obsidian_running():
        raise RuntimeError('Cerrá Obsidian antes de la primera sincronización y mantenelo cerrado hasta que termine.')
    active = subprocess.run(['systemctl', '--user', 'is-active', '--quiet', 'neuronas-memory.timer']).returncode == 0
    try:
        if active:
            subprocess.run(['systemctl', '--user', 'stop', 'neuronas-memory.timer', 'neuronas-memory.service'], check=True)
        yield
    finally:
        if active:
            subprocess.run(['systemctl', '--user', 'start', 'neuronas-memory.timer'], check=True)


def get_json(*args):
    return json.loads(subprocess.check_output([str(RCLONE), *args], text=True))


def main():
    os.umask(0o077)
    print('Conectar la bóveda de Obsidian con iCloud Drive.\n')
    print('Ingresá tus credenciales únicamente aquí; no se guardan en las notas ni en el chat.')
    memory_config = json.loads((HOME / '.config/neuronas/config.json').read_text())
    vault = pathlib.Path(memory_config['vault']).resolve()
    if not (vault / '.obsidian').is_dir():
        raise RuntimeError('No se encontró la bóveda configurada por el instalador Linux.')
    conf = configparser.RawConfigParser()
    conf.optionxform = str
    if CONFIG.exists():
        conf.read(CONFIG)
    if not conf.has_section(REMOTE) or not conf.get(REMOTE, 'trust_token', fallback=''):
        apple_id = input('Correo de tu cuenta Apple: ').strip()
        if not apple_id:
            raise RuntimeError('Falta el correo de Apple.')
        password = getpass.getpass('Contraseña de Apple: ')
        if not password:
            raise RuntimeError('Falta la contraseña.')
        obscured = subprocess.check_output([str(RCLONE), 'obscure', '-'],
                                           input=password, text=True).strip()
        del password
        if not conf.has_section(REMOTE):
            conf.add_section(REMOTE)
        for key, value in {'type': 'iclouddrive', 'service': 'drive',
                           'apple_id': apple_id, 'password': obscured}.items():
            conf.set(REMOTE, key, value)
        CONFIG.parent.mkdir(parents=True, exist_ok=True)
        temporary = CONFIG.with_suffix('.tmp')
        with temporary.open('w') as handle:
            conf.write(handle)
        temporary.chmod(0o600)
        temporary.replace(CONFIG)
    if not SETTINGS.exists():
        print('\nApple puede pedir un código o autorización en tu iPhone/iPad.\n')
        subprocess.run([str(RCLONE), 'config', 'reconnect', REMOTE + ':'], check=True)
        print('\nBuscando tu bóveda en iCloud…')
        # iCloud exposes the Obsidian application container using different labels.
        folders = get_json('lsjson', REMOTE + ':', '--dirs-only', '--recursive', '--max-depth', '3')
        candidates = []
        for entry in folders:
            path = entry['Path']
            if 'obsidian' not in path.casefold():
                continue
            target = REMOTE + ':' + path
            probe = subprocess.run([str(RCLONE), 'lsjson', target + '/.obsidian/app.json',
                                    '--stat', '--log-level', 'ERROR'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if probe.returncode == 0:
                candidates.append(target)
        if len(candidates) == 1:
            target = candidates[0]
        else:
            print('Carpetas encontradas:')
            for entry in folders:
                print(' ', entry['Path'])
            path = input('Ruta exacta de tu bóveda dentro de iCloud (sin .obsidian): ').strip().strip('/')
            if not path:
                raise RuntimeError('No se eligió una bóveda.')
            target = REMOTE + ':' + path
        # Read-only validation before saving the destination and before any upload.
        get_json('lsjson', target + '/.obsidian/app.json', '--stat')
        SETTINGS.write_text(json.dumps({'vault': str(vault),
                                        'remote': target}, ensure_ascii=False, indent=2) + '\n')
        SETTINGS.chmod(0o600)
        print('Bóveda encontrada:', target)
    state = HOME / '.local/state/neuronas/icloud'
    if json.loads(SETTINGS.read_text())['vault'] != str(vault):
        raise RuntimeError('La bóveda de iCloud pertenece a otra instalación. Revisá icloud.json antes de continuar.')
    sync = [sys.executable, str(pathlib.Path(__file__).with_name('icloud_sync.py'))]
    if not (state / 'initialized.json').exists():
        print('\nPreparando la primera sincronización, sin respaldos. Puede tardar por los adjuntos.\n')
        with quiet_capture():
            subprocess.run(sync + ['--initialize'], check=True)
    else:
        subprocess.run(sync, check=True)
    subprocess.run(['systemctl', '--user', 'enable', '--now', 'neuronas-icloud.timer'], check=True)
    print('\nListo: iCloud se sincronizará cada tres minutos mientras tengas sesión abierta.')
    print('Si Apple vence la sesión, ejecutá icloud-renovar y después icloud-conectar.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, configparser.Error, subprocess.CalledProcessError, KeyboardInterrupt) as error:
        print('\nNo se completó la conexión. Tus notas locales se conservan.', file=sys.stderr)
        if isinstance(error, RuntimeError):
            print(str(error), file=sys.stderr)
        print('Podés reintentar con: icloud-conectar', file=sys.stderr)
        sys.exit(1)
