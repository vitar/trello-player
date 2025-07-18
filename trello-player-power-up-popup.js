const t = window.TrelloPowerUp.iframe();
let currentAttachmentIndex = 0;
let m4aAttachments = [];
let audioPlayer = document.getElementById('audio-player');
let attachmentsList = document.getElementById('attachments-list');
let waveformView = document.getElementById('waveform-view');
let waveformTemplate = document.getElementById('waveform-template');
let attachmentTemplate = document.getElementById('attachment-template');
let modal = document.getElementById('waveform-modal');
let downloadLink = document.getElementById('download-file');
let loadFileLink = document.getElementById('load-file');
let fileInput = document.getElementById('waveform-file-input');
let saveBtn = document.getElementById('save-waveform');
let cancelBtn = document.getElementById('cancel-waveform');
let waveformPreview = document.getElementById('waveform-preview');
let deleteWaveform = false;
const dummyPeaks = Array(100).fill(0.3);
class WaveformPreview extends HTMLElement {
  constructor() {
    super();
    const frag = waveformTemplate.content.cloneNode(true);
    this.appendChild(frag);
    this.canvas = this.querySelector('.waveform-canvas');
    this.deleteBtn = this.querySelector('.delete-waveform');
    this.msg = this.querySelector('.no-waveform-msg');
    this.wrench = this.querySelector('.wrench');
  }
  createPlayer(options = {}) {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
    }
    this.canvas.innerHTML = '';
    this.wavesurfer = WaveSurfer.create({
      container: this.canvas,
      height: 80,
      normalize: true,
      ...options
    });
    return this.wavesurfer;
  }
  loadFromData(peaks, duration, options = {}) {
    this.createPlayer({
      ...options,
      peaks: peaks,
      duration: duration
    });
  }
  async loadFromUrl(url, options = {}) {
    const ws = this.createPlayer(options);
    return new Promise((resolve) => {
      ws.once('ready', resolve);
      ws.load(url);
    });
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
  }
  showDeleteButton() { if (this.deleteBtn) this.deleteBtn.classList.remove('hidden'); }
  hideDeleteButton() { if (this.deleteBtn) this.deleteBtn.classList.add('hidden'); }
  showMessage() { if (this.msg) this.msg.classList.remove('hidden'); }
  hideMessage() { if (this.msg) this.msg.classList.add('hidden'); }
  showWrench() { if (this.wrench) this.wrench.classList.remove('hidden'); }
  hideWrench() { if (this.wrench) this.wrench.classList.add('hidden'); }
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
let currentAttachment;
let waveformDuration;

async function loadPlayer() {
  try {
    m4aAttachments = [];
    const listInfo = await t.list('cards');
    const cards = listInfo.cards;
    cards.forEach(card => {
      const cardM4aAttachments = card.attachments.filter(attachment => attachment.url.endsWith('.m4a') || attachment.url.endsWith('.mp3'));
      cardM4aAttachments.forEach(attachment => {
        m4aAttachments.push(Object.assign({cardId: card.id}, attachment));

        const li = attachmentTemplate.content.firstElementChild.cloneNode(true);
        li.querySelector('.attachment-name').textContent = attachment.name;
        li.addEventListener('click', () => {
          loadAttachment(m4aAttachments.findIndex((att) => att.id == attachment.id));
        });
        attachmentsList.appendChild(li);
      });
    });

    if (m4aAttachments.length > 0) {
      loadAttachment(0);
    }
  }
  catch (error) {
    console.error('Error fetching attachments:', error);
    alert('Failed to load attachments. Please try again.');
  }
}

function loadAttachment(index) {
  if (index >= 0 && index < m4aAttachments.length) {
    currentAttachmentIndex = index;
    audioPlayer.src = m4aAttachments[index].url;
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.then(_ => {}).catch(error => {});
    }

    const attachmentsListItems = document.querySelectorAll('#attachments-list li');
    attachmentsListItems.forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });

    currentAttachment = m4aAttachments[index];
    showWaveform(currentAttachment);
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

function showWaveform(att) {
  waveformView.clear();
  waveformView.showWrench();
  waveformView.setWrenchHandler(() => openWaveformModal(att));
  t.get(att.cardId, 'shared', 'waveformData').then(data => {
    if (data) {
      const wfData = JSON.parse(data);
      waveformView.loadFromData(wfData.peaks, wfData.duration, {
        normalize: true,
        interact: true,
        media: audioPlayer
      });
    } else {
      waveformView.loadFromData(dummyPeaks, audioPlayer.duration, {
        normalize: false,
        interact: true,
        media: audioPlayer
      });
      waveformView.showMessage();
    }
  });
}

function openWaveformModal(att) {
  currentAttachment = att;
  downloadLink.href = att.url;
  downloadLink.download = att.name;
  waveformPreview.clear();
  deleteWaveform = false;
  saveBtn.disabled = true;
  modal.classList.remove('hidden');
  modal.focus();
  waveformPreview.deleteBtn.onclick = () => {
    deleteWaveform = true;
    saveBtn.disabled = false;
    waveformPreview.clear();
  };
  t.get(att.cardId, 'shared', 'waveformData').then(data => {
    if (data) {
      const wfData = JSON.parse(data);
      waveformPreview.loadFromData(wfData.peaks, wfData.duration, {interact:false});
      waveformPreview.showDeleteButton();
    } else {
      waveformPreview.hideDeleteButton();
    }
  });
}

loadFileLink.addEventListener('click', (e) => {
  e.preventDefault();
  fileInput.click();
});

fileInput.addEventListener('change', async () => {
  if (fileInput.files.length === 0) return;
  const url = URL.createObjectURL(fileInput.files[0]);
  await waveformPreview.loadFromUrl(url, {interact:false});
  saveBtn.disabled = false;
  deleteWaveform = false;
  waveformPreview.hideDeleteButton();
  waveformDuration = waveformPreview.getDuration();
});

cancelBtn.addEventListener('click', closeModal);
saveBtn.addEventListener('click', async () => {
  if (deleteWaveform) {
    await t.remove(currentAttachment.cardId, 'shared', 'waveformData');
  } else {
    const peaks = waveformPreview.exportPeaks();
    const waveformData = {peaks, duration: waveformDuration};
    await t.set(currentAttachment.cardId, 'shared', 'waveformData', JSON.stringify(waveformData));
  }
  closeModal();
  showWaveform(currentAttachment);
});

function closeModal() {
  modal.classList.add('hidden');
  waveformPreview.clear();
  fileInput.value = '';
  deleteWaveform = false;
}

modal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); }
  if (e.key === 'Enter' && !saveBtn.disabled) { saveBtn.click(); }
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

window.addEventListener('load', loadPlayer);
