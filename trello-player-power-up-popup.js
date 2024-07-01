const t = window.TrelloPowerUp.iframe();
let currentAttachmentIndex = 0;
let m4aAttachments = [];
let audioPlayer = document.getElementById('audio-player');

function loadPlayer() {
  const listInfo = t.list('cards');
  for(const card of listInfo.cards) {
    console.log(card.id);
  }
}

window.onload = loadPlayer();
