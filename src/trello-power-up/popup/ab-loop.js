import { dom } from './dom.js';
import { state } from './state.js';
import { AB_MIN_DURATION } from './constants.js';
import { getCurrentTrackDuration, isAudioPlaying } from './audio-helpers.js';

export function createAbLoopController() {
  const { audioPlayer, abButton, waveformView } = dom;

  function hasValidAbLoop() {
    return (
      state.abRepeatActive &&
      state.abPointA !== null &&
      state.abPointB !== null &&
      state.abPointB - state.abPointA >= AB_MIN_DURATION
    );
  }

  function updateAbButtonState() {
    if (!abButton) return;
    const hasA = state.abPointA !== null;
    const hasB = state.abPointB !== null;
    const active = hasValidAbLoop();
    abButton.classList.toggle('active', active);
    abButton.classList.toggle('pending', hasA && !hasB && !active);
    abButton.setAttribute('aria-pressed', String(active));
    if (active) {
      abButton.title = 'Clear A|B repeat';
    } else if (hasA && !hasB) {
      abButton.title = 'Set B point for A|B repeat';
    } else {
      abButton.title = 'Set A|B repeat points';
    }
  }

  function setAbButtonEnabled(enabled) {
    if (!abButton) return;
    abButton.disabled = !enabled;
    if (!enabled) {
      abButton.classList.remove('active', 'pending');
      abButton.setAttribute('aria-pressed', 'false');
      abButton.title = 'Set A|B repeat points';
    }
    updateAbButtonState();
  }

  function ensureAbLoopRegion() {
    if (!waveformView || typeof waveformView.setAbLoopRegion !== 'function') {
      return;
    }
    if (hasValidAbLoop()) {
      waveformView.setAbLoopRegion(state.abPointA, state.abPointB);
    } else if (!state.abRepeatActive && typeof waveformView.clearAbLoopRegion === 'function') {
      state.isClearingAbRegion = true;
      waveformView.clearAbLoopRegion();
      state.isClearingAbRegion = false;
    }
  }

  function resetAbLoop() {
    state.abPointA = null;
    state.abPointB = null;
    state.abRepeatActive = false;
    if (waveformView && typeof waveformView.clearAbLoopRegion === 'function') {
      state.isClearingAbRegion = true;
      waveformView.clearAbLoopRegion();
      state.isClearingAbRegion = false;
    }
    updateAbButtonState();
  }

  function enforceAbLoop() {
    if (!hasValidAbLoop()) {
      return;
    }
    const current = dom.audioPlayer.currentTime;
    const loopStart = state.abPointA;
    const loopEnd = state.abPointB;
    if (loopEnd <= loopStart) {
      return;
    }
    if (current >= loopEnd - 0.02) {
      dom.audioPlayer.currentTime = loopStart;
      if (dom.audioPlayer.paused && !dom.audioPlayer.ended) {
        dom.audioPlayer.play().catch(() => {});
      }
    }
  }

  function primePlaybackForAbLoop() {
    if (!hasValidAbLoop()) {
      return;
    }
    const loopStart = state.abPointA;
    const loopEnd = state.abPointB;
    if (loopEnd <= loopStart) {
      return;
    }
    if (dom.audioPlayer.currentTime < loopStart || dom.audioPlayer.currentTime >= loopEnd) {
      dom.audioPlayer.currentTime = loopStart;
    }
  }

  function handleAbButtonClick() {
    if (!abButton || abButton.disabled || !audioPlayer || !audioPlayer.src) {
      return;
    }

    if (hasValidAbLoop()) {
      resetAbLoop();
      return;
    }

    if (state.abPointA === null) {
      const playing = isAudioPlaying();
      state.abPointA = playing ? audioPlayer.currentTime : 0;
      state.abPointB = null;
      state.abRepeatActive = false;
      ensureAbLoopRegion();
      updateAbButtonState();
      return;
    }

    if (state.abPointB === null) {
      const playing = isAudioPlaying();
      let targetEnd;
      if (playing) {
        targetEnd = audioPlayer.currentTime;
      } else {
        targetEnd = getCurrentTrackDuration();
        if (!Number.isFinite(targetEnd) || targetEnd <= 0) {
          alert('Track duration is not available yet. Please try again after the audio loads.');
          return;
        }
      }
      const duration = getCurrentTrackDuration();
      if (Number.isFinite(duration) && duration > 0) {
        targetEnd = Math.min(targetEnd, duration);
      }
      if (!Number.isFinite(targetEnd)) {
        targetEnd = state.abPointA + AB_MIN_DURATION;
      }
      if (targetEnd <= state.abPointA + AB_MIN_DURATION) {
        const fallbackDuration = duration ?? state.abPointA + AB_MIN_DURATION;
        targetEnd = Math.min(fallbackDuration, state.abPointA + AB_MIN_DURATION);
      }
      if (targetEnd <= state.abPointA) {
        return;
      }
      state.abPointB = targetEnd;
      state.abRepeatActive = true;
      ensureAbLoopRegion();
      updateAbButtonState();
      enforceAbLoop();
      return;
    }

    resetAbLoop();
  }

  function init() {
    updateAbButtonState();
    setAbButtonEnabled(false);
    if (waveformView && typeof waveformView.setAbRegionUpdateHandler === 'function') {
      waveformView.setAbRegionUpdateHandler((start, end) => {
        state.abPointA = start;
        state.abPointB = end;
        if (!state.abRepeatActive && start !== null && end !== null && end > start) {
          state.abRepeatActive = true;
        }
        updateAbButtonState();
        enforceAbLoop();
      });
    }

    if (waveformView && typeof waveformView.setAbRegionRemovalHandler === 'function') {
      waveformView.setAbRegionRemovalHandler(() => {
        if (state.isClearingAbRegion) {
          return;
        }
        state.abPointA = null;
        state.abPointB = null;
        state.abRepeatActive = false;
        updateAbButtonState();
      });
    }

    if (abButton) {
      abButton.addEventListener('click', handleAbButtonClick);
    }
  }

  return {
    init,
    hasValidAbLoop,
    updateAbButtonState,
    setAbButtonEnabled,
    ensureAbLoopRegion,
    resetAbLoop,
    enforceAbLoop,
    primePlaybackForAbLoop,
    handleAbButtonClick
  };
}
