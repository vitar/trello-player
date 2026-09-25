import { dom } from './dom.js';
import { caches } from './state.js';

export function isAudioPlaying() {
  const { audioPlayer } = dom;
  return Boolean(audioPlayer && !audioPlayer.paused && !audioPlayer.ended && audioPlayer.currentTime >= 0);
}

export function getCurrentTrackDuration() {
  const { audioPlayer, waveformView } = dom;
  if (audioPlayer && Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
    return audioPlayer.duration;
  }
  if (waveformView && typeof waveformView.getDuration === 'function') {
    const waveformDuration = waveformView.getDuration();
    if (Number.isFinite(waveformDuration) && waveformDuration > 0) {
      return waveformDuration;
    }
  }
  const attachmentId = audioPlayer?.dataset?.attachmentId;
  if (attachmentId) {
    const storedDuration = caches.attachmentDurations.get(attachmentId);
    if (Number.isFinite(storedDuration) && storedDuration > 0) {
      return storedDuration;
    }
  }
  return null;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(remainingSeconds).padStart(2, '0');
  return `${paddedMinutes}:${paddedSeconds}`;
}
