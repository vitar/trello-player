import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const projectRoot = path.resolve(import.meta.dirname, '..');
const popupDir = path.join(projectRoot, 'src/trello-power-up/popup');
const bundlePath = path.join(projectRoot, 'src/trello-power-up/trello-player-power-up-popup.js');

function buildBundle() {
  execFileSync(process.execPath, [path.join(projectRoot, 'scripts/build-popup.mjs')], {
    cwd: projectRoot,
  });
  return fs.readFileSync(bundlePath, 'utf8');
}

describe('popup bundle', () => {
  test('builds into syntactically valid JavaScript without import/export statements', () => {
    const bundle = buildBundle();
    assert.doesNotThrow(() => new vm.Script(bundle, { filename: bundlePath }));
    assert.doesNotMatch(bundle, /^\s*import\s/m);
    assert.doesNotMatch(bundle, /^\s*export\s/m);
  });

  test('includes every popup module', () => {
    const bundle = buildBundle();
    for (const file of fs.readdirSync(popupDir).filter((f) => f.endsWith('.js'))) {
      assert.match(
        bundle,
        new RegExp(`// Source: src/trello-power-up/popup/${file.replace('.', '\\.')}\\n`),
        `${file} is not reachable from popup/index.js`,
      );
    }
  });

  // The bundler concatenates all modules into one scope. Two modules with the
  // same top-level name would silently override each other (for functions) or
  // break the bundle (for const/let/class), so names must be unique.
  test('popup modules do not share top-level declaration names', () => {
    const declaration =
      /^(?:export\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
    const owners = new Map();
    const duplicates = [];
    for (const file of fs.readdirSync(popupDir).filter((f) => f.endsWith('.js'))) {
      const source = fs.readFileSync(path.join(popupDir, file), 'utf8');
      for (const match of source.matchAll(declaration)) {
        const name = match[1];
        if (owners.has(name)) {
          duplicates.push(`${name} (${owners.get(name)}, ${file})`);
        } else {
          owners.set(name, file);
        }
      }
    }
    assert.deepEqual(duplicates, []);
  });
});
