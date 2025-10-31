import { dom } from './dom.js';
import { state, caches } from './state.js';
import {
  applyPitchValue,
  setPitchControlsEnabled,
  updatePitchUI
} from './pitch.js';
import {
  applyPlaybackSpeed,
  setPlaybackSpeedControlsEnabled,
  updatePlaybackSpeedUI
} from './playback-speed.js';
import {
  appendAttachmentListItem,
  clearAttachmentList,
  createAttachmentListItem,
  updateAttachmentDurationDisplay
} from './attachments-ui.js';
import {
  clearAudioCache,
  getAttachmentBlob,
  prefetchAdjacent,
  revokeCurrentObjectUrl
} from './audio-cache.js';
import { scrollActiveAttachmentIntoView } from './scroll.js';
import {
  clearSoundtouchBuffers,
  ensureSoundtouchNode,
  resumeAudioContext,
  updateSoundtouchPitch,
  updateSoundtouchTempo
} from './soundtouch.js';
import { loadPitchPreference } from './storage.js';
import { fetchSongAttachments } from './song-source.js';

function updatePlayPauseButton() {
  if (!dom.playPauseButton) return;
  if (dom.audioPlayer && !dom.audioPlayer.paused && !dom.audioPlayer.ended && dom.audioPlayer.currentTime >= 0) {
    dom.playPauseButton.innerHTML = '&#x23F8;&#xFE0E;';
    dom.playPauseButton.title = 'Pause';
  } else {
    dom.playPauseButton.innerHTML = '&#x25B6;&#xFE0E;';
    dom.playPauseButton.title = 'Play';
  }
}

function updateSettingsControlsAvailability() {
  const audioReady = state.isAudioLoaded;
  setPitchControlsEnabled(audioReady);
  setPlaybackSpeedControlsEnabled(audioReady);
}

function showWaveform(audioUrl) {
  if (!dom.waveformView) return;
  dom.waveformView.clear();
  dom.waveformView.hideStatus();
  dom.waveformView.showLoading();
  dom.waveformView.setWrenchHandler(openWaveformModal);
  try {
    dom.waveformView.loadFromUrl(audioUrl, {
      interact: true,
      media: dom.audioPlayer
    });
  } catch (error) {
    console.error('Failed to render waveform:', error);
  }
}

function openWaveformModal() {
  if (!dom.modal) return;
  dom.modal.classList.remove('hidden');
  dom.modal.focus();
}

function closeModal() {
  if (!dom.modal) return;
  dom.modal.classList.add('hidden');
}

function handleOutsideModalClick(event) {
  if (event.target === dom.modal) {
    closeModal();
  }
}

async function prepareAudioProcessorsOnPlay() {
  updatePlayPauseButton();
  await ensureSoundtouchNode();
  updateSoundtouchTempo(state.desiredPlaybackSpeed);
  updateSoundtouchPitch(state.desiredPitchSemitones);
  await resumeAudioContext();
}

async function loadAttachment(index, { autoplay = true, scrollToTop = false } = {}, abLoop) {
  if (index < 0 || index >= state.m4aAttachments.length) {
    return;
  }

  const previousIndex = state.currentAttachmentIndex;
  const previousSpeed = state.desiredPlaybackSpeed;
  const previousAudioLoaded = state.isAudioLoaded;
  abLoop.resetAbLoop();
  abLoop.setAbButtonEnabled(false);
  state.currentAttachmentIndex = index;
  const loadToken = ++state.currentLoadRequest;
  const attachment = state.m4aAttachments[index];
  state.isAudioLoaded = false;
  updateSettingsControlsAvailability();

  const listItems = dom.attachmentsList?.querySelectorAll('li') ?? [];
  const direction = index > previousIndex ? 'forward' : index < previousIndex ? 'backward' : null;
  listItems.forEach((item, idx) => {
    item.classList.toggle('active', idx === index);
  });

  if (scrollToTop && dom.attachmentsList) {
    dom.attachmentsList.scrollTop = 0;
  } else if (dom.attachmentsList) {
    scrollActiveAttachmentIntoView(dom.attachmentsList, { direction });
  }

  dom.waveformView?.hideStatus();
  dom.waveformView?.showLoading();
  let audioBlob;
  let audioUrl;
  try {
    dom.audioPlayer.pause();
    clearSoundtouchBuffers();
    audioBlob = await getAttachmentBlob(attachment);
    if (loadToken !== state.currentLoadRequest) {
      return;
    }
    audioUrl = URL.createObjectURL(audioBlob);
    revokeCurrentObjectUrl();
    state.currentObjectUrl = audioUrl;
    dom.audioPlayer.src = audioUrl;
    dom.audioPlayer.load();
    dom.audioPlayer.dataset.attachmentId = attachment.id;
    dom.audioPlayer.dataset.loadToken = String(loadToken);
    showWaveform(audioUrl);
    abLoop.setAbButtonEnabled(true);
    const storedPitch = await loadPitchPreference(attachment);
    const pitchValue = Number(storedPitch);
    await applyPitchValue(Number.isFinite(pitchValue) ? pitchValue : 0);
    await applyPlaybackSpeed(1);
    state.isAudioLoaded = true;
    updateSettingsControlsAvailability();
    prefetchAdjacent(index);
    if (autoplay) {
      const playPromise = dom.audioPlayer.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Playback start was blocked:', error);
          dom.waveformView?.showStatus('Press play or choose a track to start playback.');
        });
      }
    } else {
      dom.audioPlayer.pause();
      dom.audioPlayer.currentTime = 0;
      updatePlayPauseButton();
    }
  } catch (error) {
    if (audioUrl && audioUrl !== state.currentObjectUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    console.error('Failed to load attachment audio:', error);
    alert('Failed to load audio attachment. Please try again.');
    state.currentAttachmentIndex = previousIndex;
    listItems.forEach((item, idx) => {
      item.classList.toggle('active', idx === state.currentAttachmentIndex);
    });
    state.desiredPlaybackSpeed = previousSpeed;
    updatePlaybackSpeedUI(state.desiredPlaybackSpeed);
    updateSoundtouchTempo(state.desiredPlaybackSpeed);
    state.isAudioLoaded = previousAudioLoaded;
    updateSettingsControlsAvailability();
    updatePitchUI(state.desiredPitchSemitones);
    if (loadToken === state.currentLoadRequest) {
      dom.waveformView?.hideLoading();
    }
    abLoop.setAbButtonEnabled(state.m4aAttachments.length > 0);
  }
}

async function loadPlayer(abLoop) {
  try {
    clearAudioCache();
    state.m4aAttachments = [];
    clearAttachmentList();
    caches.attachmentDurations.clear();
    abLoop.resetAbLoop();
    abLoop.setAbButtonEnabled(false);
    state.isAudioLoaded = false;
    updateSettingsControlsAvailability();
    state.desiredPlaybackSpeed = 1;
    updatePlaybackSpeedUI(state.desiredPlaybackSpeed);
    const attachments = await fetchSongAttachments({ apiKey: state.apiKey, token: state.trelloToken });
    state.m4aAttachments.push(...attachments);
    state.isAudioLoaded = false;
    updateSettingsControlsAvailability();
    state.m4aAttachments.forEach((attachment) => {
      const element = createAttachmentListItem(attachment, (id) => {
        const targetIndex = state.m4aAttachments.findIndex((att) => att.id === id);
        loadAttachment(targetIndex, {}, abLoop);
      });
      appendAttachmentListItem(element);
      updateAttachmentDurationDisplay(attachment.id);
    });

    if (state.m4aAttachments.length > 0) {
      await loadAttachment(0, {}, abLoop);
    } else {
      dom.waveformView?.clear();
      revokeCurrentObjectUrl();
      dom.audioPlayer.pause();
      dom.audioPlayer.removeAttribute('src');
      dom.audioPlayer.load();
      updatePitchUI(0);
      state.desiredPlaybackSpeed = 1;
      updatePlaybackSpeedUI(state.desiredPlaybackSpeed);
      state.isAudioLoaded = false;
      updateSettingsControlsAvailability();
      abLoop.resetAbLoop();
      abLoop.setAbButtonEnabled(false);
    }
  } catch (error) {
    console.error('Error fetching attachments:', error);
    alert('Failed to load attachments. Please try again.');
    abLoop.resetAbLoop();
    abLoop.setAbButtonEnabled(false);
    state.isAudioLoaded = false;
    updateSettingsControlsAvailability();
  }
}

export function createPlayerController(abLoop) {
  function init() {
    updatePlayPauseButton();
    updatePitchUI(state.desiredPitchSemitones);
    updatePlaybackSpeedUI(state.desiredPlaybackSpeed);
    state.isAudioLoaded = false;
    updateSettingsControlsAvailability();

    dom.prevButton?.addEventListener('click', () => {
      if (state.currentAttachmentIndex > 0) {
        loadAttachment(state.currentAttachmentIndex - 1, {}, abLoop);
      }
    });

    dom.nextButton?.addEventListener('click', () => {
      if (state.currentAttachmentIndex < state.m4aAttachments.length - 1) {
        loadAttachment(state.currentAttachmentIndex + 1, {}, abLoop);
      }
    });

    if (dom.playPauseButton) {
      dom.playPauseButton.addEventListener('click', () => {
        if (dom.audioPlayer.paused || dom.audioPlayer.ended) {
          dom.audioPlayer.play();
        } else {
          dom.audioPlayer.pause();
        }
      });
    }

    dom.stopButton?.addEventListener('click', () => {
      dom.audioPlayer.pause();
      dom.audioPlayer.currentTime = 0;
    });

    dom.cancelBtn?.addEventListener('click', closeModal);
    dom.modal?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    });
    dom.modal?.addEventListener('click', handleOutsideModalClick);
    dom.modal?.addEventListener('touchstart', handleOutsideModalClick);

    dom.audioPlayer.addEventListener('ended', () => {
      updatePlayPauseButton();
      if (abLoop.hasValidAbLoop()) {
        dom.audioPlayer.currentTime = state.abPointA ?? 0;
        dom.audioPlayer.play().catch(() => {});
        return;
      }
      if (state.currentAttachmentIndex < state.m4aAttachments.length - 1) {
        loadAttachment(state.currentAttachmentIndex + 1, { autoplay: true }, abLoop);
      } else if (state.m4aAttachments.length > 0) {
        loadAttachment(0, { autoplay: false, scrollToTop: true }, abLoop);
      }
    });

    dom.audioPlayer.addEventListener('loadedmetadata', () => {
      const attachmentId = dom.audioPlayer.dataset.attachmentId;
      const loadToken = Number(dom.audioPlayer.dataset.loadToken);
      if (!attachmentId || loadToken !== state.currentLoadRequest) {
        return;
      }
      const duration = dom.audioPlayer.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      caches.attachmentDurations.set(attachmentId, duration);
      updateAttachmentDurationDisplay(attachmentId);
    });

    dom.audioPlayer.addEventListener('play', async () => {
      try {
        await prepareAudioProcessorsOnPlay();
      } catch (error) {
        console.warn('Unable to prepare pitch processor on play:', error);
      }
      abLoop.primePlaybackForAbLoop();
    });

    dom.audioPlayer.addEventListener('playing', () => {
      dom.waveformView?.hideStatus();
      updatePlayPauseButton();
    });

    dom.audioPlayer.addEventListener('pause', () => {
      clearSoundtouchBuffers();
      updatePlayPauseButton();
    });

    dom.audioPlayer.addEventListener('seeked', () => {
      clearSoundtouchBuffers();
      abLoop.enforceAbLoop();
    });

    dom.audioPlayer.addEventListener('loadstart', () => {
      clearSoundtouchBuffers();
      updatePlayPauseButton();
    });

    dom.audioPlayer.addEventListener('timeupdate', () => {
      abLoop.enforceAbLoop();
    });

    if (dom.pitchSlider) {
      dom.pitchSlider.addEventListener('input', (event) => {
        const value = Number(event.target.value);
        applyPitchValue(value);
      });
      dom.pitchSlider.addEventListener('change', (event) => {
        const value = Number(event.target.value);
        applyPitchValue(value, { persist: true });
      });
    }

    if (dom.speedSlider) {
      dom.speedSlider.addEventListener('input', (event) => {
        const value = Number(event.target.value);
        applyPlaybackSpeed(value);
      });
      dom.speedSlider.addEventListener('change', (event) => {
        const value = Number(event.target.value);
        applyPlaybackSpeed(value);
      });
    }

    window.addEventListener('unload', revokeCurrentObjectUrl);
  }

  return {
    init,
    loadPlayer: () => loadPlayer(abLoop),
    loadAttachment: (index, options) => loadAttachment(index, options, abLoop),
    updatePlayPauseButton
  };
}
