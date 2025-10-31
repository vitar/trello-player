import { dom } from './dom.js';
import { state } from './state.js';

export function clearSoundtouchBuffers() {
  if (!state.soundtouchNode || !state.soundtouchNode.port) {
    return;
  }
  try {
    state.soundtouchNode.port.postMessage({ type: 'clearBuffers' });
  } catch (error) {
    console.warn('Failed to clear SoundTouch buffers:', error);
  }
}

function setSoundtouchParam(name, value) {
  if (!state.soundtouchNode || !state.audioContext) return;
  try {
    const param = state.soundtouchNode.parameters?.get(name);
    if (param) {
      param.setValueAtTime(value, state.audioContext.currentTime);
    } else if (state.soundtouchNode.port) {
      state.soundtouchNode.port.postMessage({ type: name, value });
    }
  } catch (error) {
    console.error(`Unable to update ${name} parameter:`, error);
  }
}

export function updateSoundtouchPitch(value) {
  setSoundtouchParam('pitchSemitones', value);
}

export function updateSoundtouchTempo(value) {
  setSoundtouchParam('tempo', value);
  setSoundtouchParam('rate', 1);
  setSoundtouchParam('pitch', 1);
}

export async function resumeAudioContext() {
  if (state.audioContext && state.audioContext.state === 'suspended') {
    try {
      await state.audioContext.resume();
    } catch (error) {
      console.warn('Audio context resume blocked:', error);
    }
  }
}

export async function ensureSoundtouchNode() {
  if (state.soundtouchNode) {
    updateSoundtouchTempo(state.desiredPlaybackSpeed);
    updateSoundtouchPitch(state.desiredPitchSemitones);
    return state.soundtouchNode;
  }
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }
  if (!state.soundtouchModulePromise) {
    state.soundtouchModulePromise = state.audioContext.audioWorklet
      .addModule('./soundtouch-worklet.js?4')
      .catch((error) => {
        console.error('Failed to load SoundTouch worklet:', error);
        throw error;
      });
  }
  await state.soundtouchModulePromise;
  try {
    state.soundtouchNode = new AudioWorkletNode(state.audioContext, 'soundtouch-processor');
  } catch (error) {
    console.error('Failed to create SoundTouch node:', error);
    state.soundtouchNode = null;
    throw error;
  }
  state.soundtouchNode.connect(state.audioContext.destination);
  if (!state.audioSourceNode) {
    state.audioSourceNode = state.audioContext.createMediaElementSource(dom.audioPlayer);
  } else {
    try {
      state.audioSourceNode.disconnect();
    } catch (error) {
      console.warn('Audio source disconnect failed:', error);
    }
  }
  state.audioSourceNode.connect(state.soundtouchNode);
  updateSoundtouchTempo(state.desiredPlaybackSpeed);
  updateSoundtouchPitch(state.desiredPitchSemitones);
  return state.soundtouchNode;
}
