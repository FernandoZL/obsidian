#!/usr/bin/python3
"""Sync the configured vault; credentials stay in rclone's private config."""
import argparse
import datetime
import fcntl
import json
import pathlib
import os
import shutil
import subprocess
import sys

HOME = pathlib.Path.home()
RCLONE = os.environ.get('NEURONAS_RCLONE') or shutil.which('rclone') or HOME / '.local/bin/rclone'
CONFIG = HOME / '.config/neuronas/icloud.json'
STATE = HOME / '.local/state/neuronas/icloud'


def run(args):
    subprocess.run([str(RCLONE), *map(str, args)], check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--initialize', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    options = parser.parse_args()
    STATE.mkdir(parents=True, exist_ok=True)
    with (STATE / 'sync.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Ya hay una sincronización en curso.')
            return
        cfg = json.loads(CONFIG.read_text())
        vault, remote = pathlib.Path(cfg['vault']), cfg['remote']
        if not (vault / '.obsidian').is_dir():
            raise RuntimeError('No se encontró la bóveda local esperada.')
        subprocess.run([str(RCLONE), 'lsjson', remote + '/.obsidian/app.json', '--stat', '--log-level', 'ERROR'], check=True, stdout=subprocess.DEVNULL)
        initialized = STATE / 'initialized.json'
        if not initialized.exists() and not options.initialize:
            raise RuntimeError('Primero completá la conexión con icloud-conectar.')
        if initialized.exists() and options.initialize:
            raise RuntimeError('La sincronización ya está inicializada; no se reinicia automáticamente.')
        if initialized.exists():
            prior = json.loads(initialized.read_text())
            if prior['vault'] != str(vault) or prior['remote'] != remote:
                raise RuntimeError('Las rutas cambiaron. Revisá la configuración antes de sincronizar.')
        sentinel = '.neuronas-icloud-access'
        if options.initialize and not options.dry_run:
            (vault / sentinel).write_text('Neuronas: control de acceso de sincronización.\n')
            run(['copyto', vault / sentinel, remote + '/' + sentinel])
        args = ['bisync', str(vault), remote,
                '--workdir', str(STATE / 'bisync'),
                '--filters-file', str(HOME / '.config/neuronas/icloud-filters.txt'),
                '--check-access', '--check-filename', sentinel,
                '--conflict-resolve', 'newer', '--conflict-loser', 'delete',
                '--resilient', '--recover',
                '--max-delete', '10', '--create-empty-src-dirs',
                '--log-level', 'INFO', '--stats', '30s', '--stats-one-line',
                '--contimeout', '30s', '--timeout', '5m']
        if options.initialize:
            # On first merge, existing cloud files win (backups disabled by the user).
            # New local memories absent from the cloud are still uploaded.
            args += ['--resync-mode', 'path2']
        if options.dry_run:
            args += ['--dry-run']
        run(args)
        if not options.dry_run:
            initialized.write_text(json.dumps({'vault': str(vault), 'remote': remote}) + '\n')
            (STATE / 'last-success.json').write_text(json.dumps({
                'date': datetime.datetime.now().astimezone().isoformat(),
                'vault': str(vault), 'remote': remote,
            }) + '\n')
        print('Sincronización terminada correctamente.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print('No se completó la sincronización:', error, file=sys.stderr)
        sys.exit(1)
