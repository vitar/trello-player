const t = window.TrelloPowerUp.iframe();
let currentAttachmentIndex = 0;
let m4aAttachments = [];
let audioPlayer = document.getElementById('audio-player');
let attachmentsList = document.getElementById('attachments-list');
let waveSurfer;

async function loadPlayer() {
  try {
    m4aAttachments = [];
    const listInfo = await t.list('cards');
    const cards = listInfo.cards;
    cards.forEach(card => {
      const cardM4aAttachments = card.attachments.filter(attachment => attachment.url.endsWith('.m4a') || attachment.url.endsWith('.mp3'));
      cardM4aAttachments.forEach(attachment => {
        m4aAttachments.push(attachment);
        
        const attachmentLi = document.createElement('li');
        attachmentLi.innerHTML = attachment.name;
        attachmentLi.addEventListener('click', () => {
          loadAttachment(m4aAttachments.findIndex((att) => att.name == attachment.name));
        });
        attachmentsList.appendChild(attachmentLi);
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
    waveSurfer.load(m4aAttachments[index].url);
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.then(_ => {}).catch(error => {});
    }
    
    const attachmentsListItems = document.querySelectorAll('#attachments-list li');
    attachmentsListItems.forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });
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

audioPlayer.addEventListener('ended', () => {
  if (currentAttachmentIndex < m4aAttachments.length - 1) {
    loadAttachment(currentAttachmentIndex + 1);
  }
});

window.addEventListener('load', () => {
  waveSurfer = WaveSurfer.create({
    container: '#waveform',
    media: audioPlayer,
    waveColor: 'lightgreen',
    progressColor: 'darkgreen'
  });
  loadPlayer();
});
