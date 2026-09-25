import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { prepareSite, renderConfig, validateProxyUrl } from '../scripts/prepare-site.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const script = path.join(projectRoot, 'scripts/prepare-site.mjs');

function buildBundle() {
  execFileSync(process.execPath, [path.join(projectRoot, 'scripts/build-popup.mjs')]);
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-site-'));
}

function evaluateConfig(source) {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.trelloPlayerConfig;
}

describe('validateProxyUrl', () => {
  test('rejects a missing or blank value', () => {
    for (const value of [undefined, null, '', '   ']) {
      assert.throws(() => validateProxyUrl(value), /PROXY_URL is not set/);
    }
  });

  test('rejects values that are not URLs', () => {
    assert.throws(() => validateProxyUrl('trello-proxy'), /not a valid URL/);
  });

  test('rejects non-https URLs', () => {
    for (const value of ['http://proxy.example/', 'javascript:alert(1)', 'ftp://proxy.example/']) {
      assert.throws(() => validateProxyUrl(value), /must use https/, value);
    }
  });

  test('accepts https URLs and trims whitespace', () => {
    assert.equal(
      validateProxyUrl(' https://proxy.example.workers.dev/ '),
      'https://proxy.example.workers.dev/',
    );
  });
});

describe('renderConfig', () => {
  test('produces a script that sets the proxy URL', () => {
    const config = evaluateConfig(renderConfig('https://proxy.example/'));
    assert.equal(config.proxyUrl, 'https://proxy.example/');
  });

  test('escapes values so they cannot break out of the string', () => {
    const hostile = 'https://proxy.example/";window.pwned=true;"';
    const context = { window: {} };
    vm.runInNewContext(renderConfig(hostile), context);
    assert.equal(context.window.trelloPlayerConfig.proxyUrl, hostile);
    assert.equal(context.window.pwned, undefined);
  });
});

describe('prepareSite', () => {
  test('copies the site, writes the proxy config and .nojekyll', () => {
    buildBundle();
    const outDir = path.join(tempDir(), 'site');
    prepareSite({ outDir, proxyUrl: 'https://proxy.example/' });
    for (const file of [
      'trello-player-power-up.html',
      'trello-player-power-up-popup.html',
      'trello-player-power-up-popup.js',
      'soundtouch-worklet.js',
      'trello-player.css',
      'privacy.html',
      '.nojekyll',
    ]) {
      assert.ok(fs.existsSync(path.join(outDir, file)), file);
    }
    const config = fs.readFileSync(path.join(outDir, 'trello-player-config.js'), 'utf8');
    assert.equal(evaluateConfig(config).proxyUrl, 'https://proxy.example/');
  });

  test('does not touch the output folder when PROXY_URL is invalid', () => {
    const outDir = tempDir();
    fs.writeFileSync(path.join(outDir, 'keep.txt'), 'x');
    assert.throws(() => prepareSite({ outDir, proxyUrl: '' }), /PROXY_URL is not set/);
    assert.ok(fs.existsSync(path.join(outDir, 'keep.txt')));
  });

  test('CLI exits non-zero with a GitHub error annotation when PROXY_URL is missing', () => {
    const env = { ...process.env };
    delete env.PROXY_URL;
    const result = spawnSync(process.execPath, [script, path.join(tempDir(), 'site')], {
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /::error::PROXY_URL is not set/);
  });
});
