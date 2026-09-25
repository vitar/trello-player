import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  isSupportedAttachment,
} from '../src/trello-power-up/popup/attachment-filter.js';

const trelloUpload = (name) => ({
  id: 'att1',
  name,
  isUpload: true,
  url: `https://trello.com/1/cards/card1/attachments/att1/download/${name}`,
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
    assert.equal(isSupportedAttachment({ id: 'x', isUpload: true, name: 'song.mp3' }), false);
    assert.equal(
      isSupportedAttachment({ id: 'x', isUpload: true, name: 'song.mp3', url: null }),
      false,
    );
  });

  // Link attachments can point anywhere; fetching them through the proxy would
  // send the user's Trello credentials to that host.
  test('rejects link attachments that are not Trello uploads', () => {
    const link = { id: 'x', name: 'song.mp3', url: 'https://evil.example/song.mp3' };
    assert.equal(isSupportedAttachment({ ...link, isUpload: false }), false);
    assert.equal(isSupportedAttachment(link), false);
    assert.equal(isSupportedAttachment({ ...link, isUpload: 'true' }), false);
  });

  test('rejects missing attachments', () => {
    assert.equal(isSupportedAttachment(undefined), false);
    assert.equal(isSupportedAttachment(null), false);
  });
});
