'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
test('iCloud Linux sincroniza en ambos sentidos sin respaldos ni copias de conflicto', { skip: process.platform !== 'linux' }, () => {
  const result = spawnSync('python3', [path.join(__dirname, 'linux_icloud_test.py')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
