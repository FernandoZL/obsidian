import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SYNC = ROOT / 'scripts/linux/icloud_sync.py'
CONNECT = ROOT / 'scripts/linux/icloud_connect.py'
RCLONE = shutil.which('rclone') or str(Path.home() / '.local/bin/rclone')


class SyncTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='neuronas cloud ')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.home = self.root / 'home'
        self.vault = self.home / 'Notas con espacios'
        self.remote = self.root / 'remote/Obsidian/Obsidian'
        for p in [self.vault / '.obsidian', self.remote / '.obsidian',
                  self.home / '.config/neuronas', self.home / '.config/rclone']:
            p.mkdir(parents=True)
        for root in [self.vault, self.remote]:
            (root / '.obsidian/app.json').write_text('{}')
            for n in range(30):
                (root / f'nota-{n}.md').write_text(f'Nota {n}')
        config = self.home / '.config/rclone/rclone.conf'
        config.write_text(f'[testcloud]\ntype = alias\nremote = {self.root / "remote"}\n')
        self.settings = self.home / '.config/neuronas/icloud.json'
        self.settings.write_text(json.dumps({'vault': str(self.vault), 'remote': 'testcloud:Obsidian/Obsidian'}))
        shutil.copy(ROOT / 'scripts/linux/icloud-filters.txt', self.home / '.config/neuronas/icloud-filters.txt')
        self.env = {**os.environ, 'HOME': str(self.home), 'RCLONE_CONFIG': str(config), 'NEURONAS_RCLONE': RCLONE}

    def sync(self, *args, success=True):
        p = subprocess.run(['python3', str(SYNC), *args], env=self.env, capture_output=True, text=True)
        if success:
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        else:
            self.assertNotEqual(p.returncode, 0)
        return p

    @unittest.skipUnless(Path(RCLONE).is_file(), 'rclone no está instalado')
    def test_union_bidirectional_conflicts_and_no_backups(self):
        (self.vault / 'local.md').write_text('Recuerdo de consola')
        (self.remote / 'movil.md').write_text('Nota del teléfono')
        self.sync('--initialize')
        self.assertEqual((self.remote / 'local.md').read_text(), 'Recuerdo de consola')
        self.assertEqual((self.vault / 'movil.md').read_text(), 'Nota del teléfono')
        (self.vault / 'nota-1.md').write_text('Edición Linux')
        (self.remote / 'nota-2.md').write_text('Edición móvil')
        self.sync()
        self.assertEqual((self.remote / 'nota-1.md').read_text(), 'Edición Linux')
        self.assertEqual((self.vault / 'nota-2.md').read_text(), 'Edición móvil')
        (self.vault / 'nota-3.md').write_text('Versión antigua')
        (self.remote / 'nota-3.md').write_text('Versión nueva')
        now = time.time()
        os.utime(self.vault / 'nota-3.md', (now - 30, now - 30))
        os.utime(self.remote / 'nota-3.md', (now, now))
        self.sync()
        self.assertEqual((self.vault / 'nota-3.md').read_text(), 'Versión nueva')
        self.assertFalse(list(self.vault.glob('*.conflict*')))
        self.assertFalse(list(self.root.rglob('icloud-backups')))
        self.assertFalse(list(self.root.rglob('antes-de-icloud')))
        (self.vault / 'local.md').unlink()
        self.sync()
        self.assertFalse((self.remote / 'local.md').exists())
        self.sync('--initialize', success=False)

    @unittest.skipUnless(Path(RCLONE).is_file(), 'rclone no está instalado')
    def test_path_change_requires_review_and_does_not_initialize(self):
        self.sync('--initialize')
        self.settings.write_text(json.dumps({'vault': str(self.vault), 'remote': 'testcloud:otra'}))
        self.sync(success=False)
        self.assertFalse((self.root / 'remote/otra').exists())

    def test_initialization_refuses_obsidian_and_resumes_capture_on_error(self):
        spec = importlib.util.spec_from_file_location('icloud_connect_test', CONNECT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with patch.object(module, 'obsidian_running', return_value=True):
            with self.assertRaisesRegex(RuntimeError, 'Obsidian'):
                with module.quiet_capture():
                    self.fail('No debe empezar una transferencia con Obsidian abierto')
        commands = []
        def run(args, **kwargs):
            commands.append(args)
            return subprocess.CompletedProcess(args, 0)
        with patch.object(module, 'obsidian_running', return_value=False), patch.object(module.subprocess, 'run', side_effect=run):
            with self.assertRaisesRegex(RuntimeError, 'transferencia'):
                with module.quiet_capture():
                    raise RuntimeError('falló transferencia')
        self.assertIn(['systemctl', '--user', 'stop', 'neuronas-memory.timer', 'neuronas-memory.service'], commands)
        self.assertEqual(commands[-1], ['systemctl', '--user', 'start', 'neuronas-memory.timer'])


if __name__ == '__main__':
    unittest.main()
