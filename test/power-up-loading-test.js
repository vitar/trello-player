import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { installTrelloMock } from './trello-mock.js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '../trello-player-power-up-popup.html');
let html = fs.readFileSync(htmlPath, 'utf8');
// remove script tags to avoid loading external resources
html = html.replace(/<script[^>]*><\/script>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');

const dom = new JSDOM(html, { url: 'http://localhost', runScripts: 'outside-only' });
const { window } = dom;
installTrelloMock(window);
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.WaveSurfer = { create: () => ({
  load: () => {},
  once: (_, cb) => cb(),
  destroy: () => {},
  exportPeaks: () => [],
  getDuration: () => 0,
  setMediaElement: () => {},
}) };

global.window = window;
global.document = window.document;

delete global.navigator; // jsdom sets navigator; ensure we use window.navigator
const scriptContent = fs.readFileSync(path.join(__dirname, '../trello-player-power-up-popup.js'), 'utf8');
vm.runInContext(scriptContent, dom.getInternalVMContext());

window.dispatchEvent(new window.Event('load'));
// allow pending promises in the script to resolve
await new Promise(r => setTimeout(r, 0));

const items = window.document.querySelectorAll('#attachments-list li');
assert.ok(items.length > 0);
assert.strictEqual(items[0].textContent.trim(), 'sample.mp3');
console.log('Test passed');
