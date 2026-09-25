import { t } from './trello.js';
import { PITCH_KEY_PREFIX } from './constants.js';

function buildPitchStorageKey(attachment) {
  if (!attachment || !attachment.id || !attachment.cardId) {
    return null;
  }
  return `${PITCH_KEY_PREFIX}${attachment.cardId}:${attachment.id}`;
}

export async function loadApiKey() {
  return await t.get('board', 'shared', 'apikey');
}

export async function saveApiKey(value) {
  return await t.set('board', 'shared', 'apikey', value);
}

export async function loadMemberToken() {
  return await t.get('member', 'private', 'token');
}

export async function saveMemberToken(token) {
  return await t.set('member', 'private', 'token', token);
}

export async function clearMemberToken() {
  return await t.set('member', 'private', 'token', null);
}

export async function loadPitchPreference(attachment) {
  const storageKey = buildPitchStorageKey(attachment);
  if (!storageKey) {
    return null;
  }
  try {
    return await t.get('board', 'shared', storageKey);
  } catch (error) {
    console.warn('Failed to load pitch preference:', error);
    return null;
  }
}

export async function savePitchPreference(attachment, value) {
  const storageKey = buildPitchStorageKey(attachment);
  if (!storageKey) {
    return;
  }
  try {
    await t.set('board', 'shared', storageKey, value);
  } catch (error) {
    console.error('Failed to save pitch preference:', error);
  }
}
