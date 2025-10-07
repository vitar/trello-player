import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { installTrelloMock } from './trello-mock.js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '../../src/trello-power-up/trello-player-power-up-popup.html');
let html = fs.readFileSync(htmlPath, 'utf8');
// remove script tags to avoid loading external resources
html = html.replace(/<script[^>]*><\/script>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');

const dom = new JSDOM(html, { url: 'http://localhost', runScripts: 'outside-only' });
const { window } = dom;
installTrelloMock(window);
const tMock = window.TrelloPowerUp.iframe();
window.TrelloPowerUp.iframe = () => tMock;
tMock.get = async (scope, vis, key) => {
  if (scope === 'board' && key === 'apikey') return 'mock-key';
  if (scope === 'member' && key === 'token') return 'mock-token';
  return null;
};
tMock.set = async () => {};
tMock.remove = async () => {};

window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.WaveSurfer = { create: () => ({
  load: () => {},
  once: (_, cb) => cb(),
  destroy: () => {},
  exportPeaks: () => [],
  getDuration: () => 0,
  setMediaElement: () => {},
}) };
window.fetch = async (url) => {
  if (url.includes('members/me')) {
    return { status: 200, json: async () => ({ id: 'me' }) };
  }
  return { status: 200, json: async () => ([{
    id: 'c1',
    attachments: [{ id: 'a1', name: 'sample.mp3', url: 'http://example.com/sample.mp3' }]
  }]) };
};

global.window = window;
global.document = window.document;

delete global.navigator; // jsdom sets navigator; ensure we use window.navigator
const scriptContent = fs.readFileSync(path.join(__dirname, '../../src/trello-power-up/trello-player-power-up-popup.js'), 'utf8');
vm.runInContext(scriptContent, dom.getInternalVMContext());

await new Promise(r => setTimeout(r, 0));

const items = window.document.querySelectorAll('#attachments-list li');
assert.ok(items.length > 0);
assert.strictEqual(items[0].textContent.trim(), 'sample.mp3');
console.log('Test passed');
