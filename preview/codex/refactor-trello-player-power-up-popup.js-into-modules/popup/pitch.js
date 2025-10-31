import { PITCH_MIN, PITCH_MAX, PITCH_KEY_PREFIX } from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { t } from './trello.js';
import { ensureSoundtouchNode, resumeAudioContext, updateSoundtouchPitch } from './soundtouch.js';

function clampPitch(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, value));
}

export function updatePitchUI(value) {
  if (dom.pitchSlider) dom.pitchSlider.value = String(value);
  if (dom.pitchDisplay) {
    const formatted = value > 0 ? `+${value}` : `${value}`;
    dom.pitchDisplay.textContent = formatted;
  }
}

export function setPitchControlsEnabled(enabled) {
  if (dom.pitchSlider) dom.pitchSlider.disabled = !enabled;
}

export function getPitchStorageKey(attachment) {
  return `${PITCH_KEY_PREFIX}${attachment.cardId}:${attachment.id}`;
}

export async function applyPitchValue(value, { persist = false } = {}) {
  const clamped = clampPitch(value);
  state.desiredPitchSemitones = clamped;
  updatePitchUI(clamped);
  try {
    await ensureSoundtouchNode();
    await resumeAudioContext();
    updateSoundtouchPitch(clamped);
  } catch (error) {
    console.warn('Pitch shift unavailable:', error);
  }
  if (persist) {
    const attachment = state.m4aAttachments[state.currentAttachmentIndex];
    if (attachment) {
      try {
        await t.set('board', 'shared', getPitchStorageKey(attachment), clamped);
      } catch (error) {
        console.error('Failed to save pitch preference:', error);
      }
    }
  }
}
