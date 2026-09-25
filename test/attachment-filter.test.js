import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  isSupportedAttachment
} from '../src/trello-power-up/popup/attachment-filter.js';

const trelloUpload = (name) => ({
  id: 'att1',
  name,
  isUpload: true,
  url: `https://trello.com/1/cards/card1/attachments/att1/download/${name}`
});

describe('isSupportedAttachment', () => {
  test('supports exactly .m4a and .mp3', () => {
    assert.deepEqual(SUPPORTED_AUDIO_EXTENSIONS, ['.m4a', '.mp3']);
  });

  test('accepts uploaded .mp3 and .m4a files', () => {
    assert.equal(isSupportedAttachment(trelloUpload('song.mp3')), true);
    assert.equal(isSupportedAttachment(trelloUpload('song.m4a')), true);
  });

  test('matches extensions case-insensitively', () => {
    assert.equal(isSupportedAttachment(trelloUpload('SONG.MP3')), true);
    assert.equal(isSupportedAttachment(trelloUpload('Song.M4a')), true);
  });

  test('rejects other file types', () => {
    for (const name of ['notes.pdf', 'song.wav', 'song.mp3.txt', 'song.mp4', 'mp3']) {
      assert.equal(isSupportedAttachment(trelloUpload(name)), false, name);
    }
  });

  test('rejects attachments without a url', () => {
    assert.equal(isSupportedAttachment({ id: 'x', name: 'song.mp3' }), false);
    assert.equal(isSupportedAttachment({ id: 'x', name: 'song.mp3', url: null }), false);
  });

  // Known security gap from the production review: link attachments to
  // external hosts are currently accepted, and the proxy forwards the user's
  // Trello credentials to them. Convert to a real test when fixing it.
  test.todo('rejects link attachments that are not Trello uploads');
});
