const t = window.TrelloPowerUp.iframe();
let currentAttachmentIndex = 0;
let m4aAttachments = [];
let audioPlayer = document.getElementById('audio-player');
let attachmentsList = document.getElementById('attachments-list');

async function loadPlayer() {
  try {
    m4aAttachments = [];
    const listInfo = await t.list('cards');
    const cards = listInfo.cards;
    cards.forEach(card => {
      const cardM4aAttachments = card.attachments.filter(attachment => attachment.url.endsWith('.m4a'));
      cardM4aAttachments.forEach(attachment => {
        m4aAttachments.push(attachment);
        
        const attachmentLi = document.createElement('li');
        attachmentLi.innerHTML = attachment.name;
        attachmentsList.appendChild(attachmentLi);
      });
    });
    
    if (m4aAttachments.length > 0) {
      loadAttachment(0);
    }
  }
  catch (error) {
    console.error('Error fetching attachments:', error);
    alert('Failed to load attachmentas. Please try again.');
  }
}

function loadAttachment(index) {
  if (index >= 0 && index < m4aAttachments.length) {
    currentAttachmentIndex = index;
    audioPlayer.src = m4aAttachments[index].url;
    audioPlayer.play();
    
    const attachmentsListItems = document.querySelectorAll('#attachments-list li');
    attachmentsListItems.forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });
  }
}

window.onload = loadPlayer();
