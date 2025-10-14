const t = window.TrelloPowerUp.iframe();
let currentAttachmentIndex = 0;
let m4aAttachments = [];
let audioPlayer = document.getElementById('audio-player');
let attachmentsList = document.getElementById('attachments-list');
let waveformView = document.getElementById('waveform-view');
let waveformTemplate = document.getElementById('waveform-template');
let attachmentTemplate = document.getElementById('attachment-template');
let modal = document.getElementById('waveform-modal');
let cancelBtn = document.getElementById('cancel-waveform');
let authorizeBtn = document.getElementById('authorize-button');
let attachmentsContainer = document.getElementById('attachments-container');
let authForm = document.getElementById('auth-form');
let apiKeyInput = document.getElementById('apikey-input');
let pitchSlider = document.getElementById('pitch-slider');
let pitchDisplay = document.getElementById('pitch-display');
let speedSlider = document.getElementById('speed-slider');
let speedDisplay = document.getElementById('speed-display');
let trelloToken;
let apiKey;
let popup;
let authMessageHandler;
const PROXY_URL = window.trelloPlayerConfig?.proxyUrl;
let currentObjectUrl = null;
let currentLoadRequest = 0;
const audioBlobCache = new Map();
const AUDIO_CACHE_LIMIT = 6;
const attachmentDurations = new Map();
const PITCH_MIN = -7;
const PITCH_MAX = 7;
const PITCH_KEY_PREFIX = 'pitch:';
let desiredPitchSemitones = 0;
const PLAYBACK_SPEED_MIN = 0.5;
const PLAYBACK_SPEED_MAX = 1;
const PLAYBACK_SPEED_STEP = 0.05;
let desiredPlaybackSpeed = 1;
let audioContext = null;
let soundtouchNode = null;
let audioSourceNode = null;
let soundtouchModulePromise = null;

function isValidToken(token) {
  const isString = typeof token === 'string';
  const isTest = /^[a-zA-Z0-9]{64,80}$/i.test(token);
  return isString && isTest;
}

function showAuthForm() {
  authForm.classList.remove('hidden');
  attachmentsContainer.classList.add('hidden');
}

function hideAuthForm() {
  authForm.classList.add('hidden');
  attachmentsContainer.classList.remove('hidden');
}

async function validateToken(key, token) {
  if (!key || !token) return false;
  try {
    const resp = await fetch(`https://api.trello.com/1/members/me?key=${key}&token=${token}`);
    return resp.status === 200;
  } catch {
    return false;
  }
}
class WaveformPreview extends HTMLElement {
  constructor() {
    super();
    const frag = waveformTemplate.content.cloneNode(true);
    this.appendChild(frag);
    this.canvas = this.querySelector('.waveform-canvas');
    this.deleteBtn = this.querySelector('.delete-waveform');
    this.msg = this.querySelector('.no-waveform-msg');
    this.wrench = this.querySelector('.wrench');
    this.placeholder = this.querySelector('.waveform-placeholder');
    this.status = this.querySelector('.waveform-status');
    this.loadingTimer = null;
  }
  createPlayer(options = {}) {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
    }
    this.canvas.innerHTML = '';
    const abortController = new AbortController();
    const signal = abortController.signal;
    this.wavesurfer = WaveSurfer.create({
      container: this.canvas,
      height: 80,
      normalize: true,
      fetchParans: { signal },
      ...options
    });
    this.wavesurfer.on('destroy', () => {
      abortController.abort();
    })
    return this.wavesurfer;
  }
  loadFromData(peaks, duration, options = {}) {
    this.createPlayer({
      ...options,
      peaks: peaks,
      duration: duration
    });
    this.hideLoading();
    this.hideStatus();
  }
  loadFromUrl(url, options = {}) {
    this.showLoading();
    this.createPlayer({
      ...options,
      url: url
    });
    if (this.wavesurfer) {
      this.wavesurfer.once('ready', () => {
        this.hideLoading();
      });
      this.wavesurfer.once('error', () => {
        this.hideLoading();
      });
    }
  }
  clear() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
    this.canvas.innerHTML = '';
    this.hideDeleteButton();
    this.hideMessage();
    this.hideWrench();
    this.hideLoading();
    this.hideStatus();
  }
  showDeleteButton() { if (this.deleteBtn) this.deleteBtn.classList.remove('hidden'); }
  hideDeleteButton() { if (this.deleteBtn) this.deleteBtn.classList.add('hidden'); }
  showMessage() { if (this.msg) this.msg.classList.remove('hidden'); }
  hideMessage() { if (this.msg) this.msg.classList.add('hidden'); }
  showWrench() { if (this.wrench) this.wrench.classList.remove('hidden'); }
  hideWrench() { if (this.wrench) this.wrench.classList.add('hidden'); }
  showLoading() {
    this.classList.add('loading');
    this.hideStatus();
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.placeholder) {
      this.placeholder.classList.add('hidden');
      const timer = setTimeout(() => {
        if (this.classList.contains('loading') && this.placeholder) {
          this.placeholder.classList.remove('hidden');
        }
        if (this.loadingTimer === timer) {
          this.loadingTimer = null;
        }
      }, 3000);
      this.loadingTimer = timer;
    }
  }
  hideLoading() {
    this.classList.remove('loading');
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.placeholder) this.placeholder.classList.add('hidden');
  }
  showStatus(message) {
    if (!this.status) return;
    this.hideLoading();
    this.status.textContent = message;
    this.status.classList.remove('hidden');
  }
  hideStatus() {
    if (!this.status) return;
    this.status.textContent = '';
    this.status.classList.add('hidden');
  }
  exportPeaks() {
    return this.wavesurfer.exportPeaks({channels:1,maxLength:600,precision:1000});
  }
  getDuration() {
    return this.wavesurfer.getDuration();
  }
  setWrenchHandler(handler) {
    if (this.wrench) this.wrench.onclick = handler;
  }
}
customElements.define('waveform-preview', WaveformPreview);

function revokeCurrentObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

async function fetchAttachmentBlob(originalUrl) {
  if (!trelloToken) {
    throw new Error('Missing Trello token');
  }
  const proxiedUrl = `${PROXY_URL}?url=${encodeURIComponent(originalUrl)}`;
  const auth = `OAuth oauth_consumer_key="${apiKey}", oauth_token="${trelloToken}"`;
  const response = await fetch(proxiedUrl, {
    headers: {
      'x-trello-auth': auth
    }
  });
  if (!response.ok) {
    throw new Error(`Proxy request failed with status ${response.status}`);
  }
  return await response.blob();
}

function clampPitch(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, value));
}

function clampPlaybackSpeed(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const clamped = Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, value));
  const steps = Math.round(clamped / PLAYBACK_SPEED_STEP);
  return Number((steps * PLAYBACK_SPEED_STEP).toFixed(2));
}

function getPitchStorageKey(attachment) {
  return `${PITCH_KEY_PREFIX}${attachment.cardId}:${attachment.id}`;
}

function trimAudioCache(preserveIds = []) {
  if (audioBlobCache.size <= AUDIO_CACHE_LIMIT) {
    return;
  }
  const preserveSet = new Set(preserveIds.filter(Boolean));
  for (const [attachmentId] of audioBlobCache) {
    if (audioBlobCache.size <= AUDIO_CACHE_LIMIT) {
      break;
    }
    if (preserveSet.has(attachmentId)) {
      preserveSet.delete(attachmentId);
      continue;
    }
    audioBlobCache.delete(attachmentId);
  }
}

function fetchAndCacheAttachment(attachment) {
  if (!attachment) {
    return null;
  }

  if (!audioBlobCache.has(attachment.id)) {
    const downloadPromise = fetchAttachmentBlob(attachment.url);
    audioBlobCache.set(attachment.id, downloadPromise);
    trimAudioCache([attachment.id, m4aAttachments[currentAttachmentIndex]?.id]);
    downloadPromise.catch(() => {
      if (audioBlobCache.get(attachment.id) === downloadPromise) {
        audioBlobCache.delete(attachment.id);
      }
    });
  }

  return audioBlobCache.get(attachment.id);
}

async function getAttachmentBlob(attachment) {
  const blobPromise = fetchAndCacheAttachment(attachment);
  if (!blobPromise) {
    throw new Error('Unable to resolve attachment blob');
  }
  return await blobPromise;
}

function prefetchAttachment(index) {
  if (index < 0 || index >= m4aAttachments.length) {
    return;
  }
  fetchAndCacheAttachment(m4aAttachments[index]);
}

function prefetchAdjacent(index) {
  prefetchAttachment(index + 1);
  prefetchAttachment(index - 1);
}

function formatDuration(seconds) {
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

function updateAttachmentDurationDisplay(attachmentId) {
  if (!attachmentId) {
    return;
  }
  const listItem = attachmentsList.querySelector(`li[data-attachment-id="${attachmentId}"]`);
  if (!listItem) {
    return;
  }
  const nameElement = listItem.querySelector('.attachment-name');
  if (!nameElement) {
    return;
  }
  const originalName = listItem.dataset.originalName || nameElement.textContent;
  listItem.dataset.originalName = originalName;
  const storedDuration = attachmentDurations.get(attachmentId);
  const formattedDuration = formatDuration(storedDuration);
  if (formattedDuration) {
    nameElement.textContent = `(${formattedDuration}) ${originalName}`;
  } else {
    nameElement.textContent = originalName;
  }
}

function updatePitchUI(value) {
  if (pitchSlider) pitchSlider.value = String(value);
  if (pitchDisplay) {
    const formatted = value > 0 ? `+${value}` : `${value}`;
    pitchDisplay.textContent = formatted;
  }
}

function updatePlaybackSpeedUI(value) {
  const formatted = value.toFixed(2);
  if (speedSlider) speedSlider.value = formatted;
  if (speedDisplay) {
    speedDisplay.textContent = `${formatted}x`;
  }
}

function setPitchControlsEnabled(enabled) {
  if (pitchSlider) pitchSlider.disabled = !enabled;
}

function setPlaybackSpeedControlsEnabled(enabled) {
  if (speedSlider) speedSlider.disabled = !enabled;
}

function clearSoundtouchBuffers() {
  if (!soundtouchNode || !soundtouchNode.port) {
    return;
  }
  try {
    soundtouchNode.port.postMessage({ type: 'clearBuffers' });
  } catch (error) {
    console.warn('Failed to clear SoundTouch buffers:', error);
  }
}

function setSoundtouchParam(name, value) {
  if (!soundtouchNode || !audioContext) return;
  try {
    const param = soundtouchNode.parameters?.get(name);
    if (param) {
      param.setValueAtTime(value, audioContext.currentTime);
    } else if (soundtouchNode.port) {
      soundtouchNode.port.postMessage({ type: name, value });
    }
  } catch (error) {
    console.error(`Unable to update ${name} parameter:`, error);
  }
}

function updateSoundtouchPitch(value) {
  setSoundtouchParam('pitchSemitones', value);
}

function updateSoundtouchTempo(value) {
  setSoundtouchParam('tempo', value);
  setSoundtouchParam('rate', 1);
  setSoundtouchParam('pitch', 1);
}

async function resumeAudioContext() {
  if (audioContext && audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (error) {
      console.warn('Audio context resume blocked:', error);
    }
  }
}

async function ensureSoundtouchNode() {
  if (soundtouchNode) {
    updateSoundtouchTempo(desiredPlaybackSpeed);
    updateSoundtouchPitch(desiredPitchSemitones);
    return soundtouchNode;
  }
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (!soundtouchModulePromise) {
    soundtouchModulePromise = audioContext.audioWorklet.addModule('./soundtouch-worklet.js?4').catch((error) => {
      console.error('Failed to load SoundTouch worklet:', error);
      throw error;
    });
  }
  try {
    await soundtouchModulePromise;
  } catch (error) {
    throw error;
  }
  try {
    soundtouchNode = new AudioWorkletNode(audioContext, 'soundtouch-processor');
  } catch (error) {
    console.error('Failed to create SoundTouch node:', error);
    soundtouchNode = null;
    throw error;
  }
  soundtouchNode.connect(audioContext.destination);
  if (!audioSourceNode) {
    audioSourceNode = audioContext.createMediaElementSource(audioPlayer);
  } else {
    try {
      audioSourceNode.disconnect();
    } catch (error) {
      console.warn('Audio source disconnect failed:', error);
    }
  }
  audioSourceNode.connect(soundtouchNode);
  updateSoundtouchTempo(desiredPlaybackSpeed);
  updateSoundtouchPitch(desiredPitchSemitones);
  return soundtouchNode;
}

async function applyPitchValue(value, { persist = false } = {}) {
  const clamped = clampPitch(value);
  desiredPitchSemitones = clamped;
  updatePitchUI(clamped);
  try {
    await ensureSoundtouchNode();
    await resumeAudioContext();
    updateSoundtouchPitch(clamped);
  } catch (error) {
    console.warn('Pitch shift unavailable:', error);
  }
  if (persist) {
    const attachment = m4aAttachments[currentAttachmentIndex];
    if (attachment) {
      try {
        await t.set('board', 'shared', getPitchStorageKey(attachment), clamped);
      } catch (error) {
        console.error('Failed to save pitch preference:', error);
      }
    }
  }
}

async function applyPlaybackSpeed(value) {
  const clamped = clampPlaybackSpeed(value);
  const previousSpeed = desiredPlaybackSpeed;
  desiredPlaybackSpeed = clamped;
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

async function loadPlayer(token, key) {
  try {
    audioBlobCache.clear();
    m4aAttachments = [];
    attachmentsList.innerHTML = '';
    attachmentDurations.clear();
    setPitchControlsEnabled(false);
    setPlaybackSpeedControlsEnabled(false);
    desiredPlaybackSpeed = 1;
    updatePlaybackSpeedUI(desiredPlaybackSpeed);
    const listInfo = await t.list('id');
    const response = await fetch(`https://api.trello.com/1/lists/${listInfo.id}/cards?attachments=true&key=${key}&token=${token}`);
    const cards = await response.json();
    cards.forEach(card => {
      const cardM4aAttachments = card.attachments.filter(attachment => attachment.url.endsWith('.m4a') || attachment.url.endsWith('.mp3'));
      cardM4aAttachments.forEach(attachment => {
        m4aAttachments.push(Object.assign({cardId: card.id}, attachment));

        const li = attachmentTemplate.content.firstElementChild.cloneNode(true);
        li.dataset.attachmentId = attachment.id;
        li.dataset.originalName = attachment.name;
        const nameElement = li.querySelector('.attachment-name');
        if (nameElement) {
          nameElement.textContent = attachment.name;
        }
        li.addEventListener('click', () => {
          loadAttachment(m4aAttachments.findIndex((att) => att.id === attachment.id));
        });
        attachmentsList.appendChild(li);
        updateAttachmentDurationDisplay(attachment.id);
      });
    });

    if (m4aAttachments.length > 0) {
      await loadAttachment(0);
    } else {
      waveformView.clear();
      revokeCurrentObjectUrl();
      audioPlayer.pause();
      audioPlayer.removeAttribute('src');
      audioPlayer.load();
      updatePitchUI(0);
      desiredPlaybackSpeed = 1;
      updatePlaybackSpeedUI(desiredPlaybackSpeed);
      setPlaybackSpeedControlsEnabled(false);
    }
  }
  catch (error) {
    console.error('Error fetching attachments:', error);
    alert('Failed to load attachments. Please try again.');
  }
}

async function loadAttachment(index) {
  if (index < 0 || index >= m4aAttachments.length) {
    return;
  }

  const previousIndex = currentAttachmentIndex;
  const previousSpeed = desiredPlaybackSpeed;
  currentAttachmentIndex = index;
  const loadToken = ++currentLoadRequest;
  const attachment = m4aAttachments[index];

  const attachmentsListItems = document.querySelectorAll('#attachments-list li');
  attachmentsListItems.forEach((item, idx) => {
    item.classList.toggle('active', idx === index);
  });

  setPitchControlsEnabled(false);
  setPlaybackSpeedControlsEnabled(false);
  waveformView.hideStatus();
  waveformView.showLoading();
  let audioBlob;
  let audioUrl;
  try {
    audioPlayer.pause();
    clearSoundtouchBuffers();
    audioBlob = await getAttachmentBlob(attachment);
    if (loadToken !== currentLoadRequest) {
      return;
    }
    audioUrl = URL.createObjectURL(audioBlob);
    revokeCurrentObjectUrl();
    currentObjectUrl = audioUrl;
    audioPlayer.src = audioUrl;
    audioPlayer.load();
    audioPlayer.dataset.attachmentId = attachment.id;
    audioPlayer.dataset.loadToken = String(loadToken);
    showWaveform(audioUrl);
    const storedPitch = await t.get('board', 'shared', getPitchStorageKey(attachment));
    const pitchValue = clampPitch(Number(storedPitch));
    await applyPitchValue(pitchValue);
    setPitchControlsEnabled(true);
    await applyPlaybackSpeed(1);
    setPlaybackSpeedControlsEnabled(true);
    prefetchAdjacent(index);
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn('Playback start was blocked:', error);
        waveformView.showStatus('Press play or choose a track to start playback.');
      });
    }
  } catch (error) {
    if (audioUrl && audioUrl !== currentObjectUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    console.error('Failed to load attachment audio:', error);
    alert('Failed to load audio attachment. Please try again.');
    currentAttachmentIndex = previousIndex;
    attachmentsListItems.forEach((item, idx) => {
      item.classList.toggle('active', idx === currentAttachmentIndex);
    });
    desiredPlaybackSpeed = previousSpeed;
    updatePlaybackSpeedUI(desiredPlaybackSpeed);
    updateSoundtouchTempo(desiredPlaybackSpeed);
    setPlaybackSpeedControlsEnabled(m4aAttachments.length > 0);
    setPitchControlsEnabled(m4aAttachments.length > 0);
    updatePitchUI(desiredPitchSemitones);
    if (loadToken === currentLoadRequest) {
      waveformView.hideLoading();
    }
  }
}

document.getElementById('prev-button').addEventListener('click', () => {
  if (currentAttachmentIndex > 0) {
    loadAttachment(currentAttachmentIndex - 1);
  }
});

document.getElementById('next-button').addEventListener('click', () => {
  if (currentAttachmentIndex < m4aAttachments.length - 1) {
    loadAttachment(currentAttachmentIndex + 1);
  }
});

document.getElementById('play-button').addEventListener('click', () => {
  audioPlayer.play();
});

document.getElementById('pause-button').addEventListener('click', () => {
  audioPlayer.pause();
});

document.getElementById('stop-button').addEventListener('click', () => {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
});

function showWaveform(audioUrl) {
  waveformView.clear();
  waveformView.hideStatus();
  waveformView.showLoading();
  waveformView.showWrench();
  waveformView.setWrenchHandler(openWaveformModal);
  try {
    waveformView.loadFromUrl(audioUrl, {
      interact: true,
      media: audioPlayer
    });
  } catch (error) {
    console.error('Failed to render waveform:', error);
  }
}

function openWaveformModal() {
  modal.classList.remove('hidden');
  modal.focus();
}

function closeModal() {
  modal.classList.add('hidden');
}

cancelBtn.addEventListener('click', closeModal);

modal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); }
});

function outsideClickClose(e) {
  if (e.target === modal) {
    closeModal();
  }
}

modal.addEventListener('click', outsideClickClose);
modal.addEventListener('touchstart', outsideClickClose);

audioPlayer.addEventListener('ended', () => {
  if (currentAttachmentIndex < m4aAttachments.length - 1) {
    loadAttachment(currentAttachmentIndex + 1);
  }
});

audioPlayer.addEventListener('loadedmetadata', () => {
  const attachmentId = audioPlayer.dataset.attachmentId;
  const loadToken = Number(audioPlayer.dataset.loadToken);
  if (!attachmentId || loadToken !== currentLoadRequest) {
    return;
  }
  const duration = audioPlayer.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    return;
  }
  attachmentDurations.set(attachmentId, duration);
  updateAttachmentDurationDisplay(attachmentId);
});

audioPlayer.addEventListener('play', async () => {
  try {
    await ensureSoundtouchNode();
    updateSoundtouchTempo(desiredPlaybackSpeed);
    updateSoundtouchPitch(desiredPitchSemitones);
    await resumeAudioContext();
  } catch (error) {
    console.warn('Unable to prepare pitch processor on play:', error);
  }
});

audioPlayer.addEventListener('playing', () => {
  waveformView.hideStatus();
});

audioPlayer.addEventListener('pause', () => {
  clearSoundtouchBuffers();
});

audioPlayer.addEventListener('seeked', () => {
  clearSoundtouchBuffers();
});

audioPlayer.addEventListener('loadstart', () => {
  clearSoundtouchBuffers();
});

if (pitchSlider) {
  pitchSlider.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    applyPitchValue(value);
  });
  pitchSlider.addEventListener('change', (event) => {
    const value = Number(event.target.value);
    applyPitchValue(value, { persist: true });
  });
  setPitchControlsEnabled(false);
}

if (speedSlider) {
  speedSlider.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    applyPlaybackSpeed(value);
  });
  speedSlider.addEventListener('change', (event) => {
    const value = Number(event.target.value);
    applyPlaybackSpeed(value);
  });
  updatePlaybackSpeedUI(desiredPlaybackSpeed);
  setPlaybackSpeedControlsEnabled(false);
}

authorizeBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  apiKey = key;
  await t.set('board', 'shared', 'apikey', key);
  const returnUrl = window.location.href.split('#')[0];
  const authUrl = (secret) => {
    return 'https://trello.com/1/authorize?expiration=never' +
      '&scope=read&key=' + encodeURIComponent(key) +
      '&callback_method=postMessage' +
      '&return_url=' + encodeURIComponent(returnUrl);
  }

  if (authMessageHandler) {
    window.removeEventListener('message', authMessageHandler);
    authMessageHandler = null;
  }

  authMessageHandler = async (event) => {
    if (!popup || event.source !== popup) return;

    const token = typeof event.data === 'string' ? event.data.trim() : '';
    if (!isValidToken(token)) return;

    window.removeEventListener('message', authMessageHandler);
    authMessageHandler = null;

    if (!(await validateToken(key, token))) {
      alert('Failed to validate Trello authorization. Please try again.');
      popup?.close();
      popup = null;
      return;
    }

    await t.set('member', 'private', 'token', token);
    popup?.close();
    popup = null;
    location.reload();
  };

  window.addEventListener('message', authMessageHandler);

  try {
    await t.authorize(authUrl, {
      validToken: isValidToken,
      windowCallback: (win) => { popup = win; }
    });
  } catch (error) {
    window.removeEventListener('message', authMessageHandler);
    authMessageHandler = null;
    popup = null;
    console.error('Authorization popup failed to open:', error);
  }
});

apiKeyInput.addEventListener('change', () => {
  apiKey = apiKeyInput.value.trim();
  t.set('board', 'shared', 'apikey', apiKey);
});

window.addEventListener('unload', revokeCurrentObjectUrl);

async function init() {
  const key = await t.get('board', 'shared', 'apikey');
  if (key) apiKeyInput.value = key;

  const hashMatch = window.location.hash.match(/token=([^&]+)/);
  if (hashMatch) {
    await t.set('member', 'private', 'token', hashMatch[1]);
    window.location.hash = '';
  }

  const token = await t.get('member', 'private', 'token');
  apiKey = apiKeyInput.value.trim();
  if (token && await validateToken(apiKey, token)) {
    hideAuthForm();
    trelloToken = token;
    await loadPlayer(token, apiKey);
  } else {
    if (token) await t.set('member', 'private', 'token', null);
    showAuthForm();
  }
}

init();
