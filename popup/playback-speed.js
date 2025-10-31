import { PLAYBACK_SPEED_MIN, PLAYBACK_SPEED_MAX, PLAYBACK_SPEED_STEP } from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { clearSoundtouchBuffers, ensureSoundtouchNode, resumeAudioContext, updateSoundtouchTempo } from './soundtouch.js';

function clampPlaybackSpeed(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const clamped = Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, value));
  const steps = Math.round(clamped / PLAYBACK_SPEED_STEP);
  return Number((steps * PLAYBACK_SPEED_STEP).toFixed(2));
}

export function updatePlaybackSpeedUI(value) {
  const formatted = value.toFixed(2);
  if (dom.speedSlider) dom.speedSlider.value = formatted;
  if (dom.speedDisplay) {
    dom.speedDisplay.textContent = `${formatted}x`;
  }
}

export function setPlaybackSpeedControlsEnabled(enabled) {
  if (dom.speedSlider) dom.speedSlider.disabled = !enabled;
}

export async function applyPlaybackSpeed(value) {
  const clamped = clampPlaybackSpeed(value);
  const previousSpeed = state.desiredPlaybackSpeed;
  state.desiredPlaybackSpeed = clamped;
  updatePlaybackSpeedUI(clamped);
  try {
    await ensureSoundtouchNode();
    await resumeAudioContext();
    if (clamped !== previousSpeed) {
      clearSoundtouchBuffers();
    }
    updateSoundtouchTempo(clamped);
  } catch (error) {
    console.warn('Playback speed adjustment unavailable:', error);
  }
  return clamped;
}
