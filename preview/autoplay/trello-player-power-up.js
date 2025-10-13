let audioPlayer = document.getElementById('audio-player');
window.TrelloPowerUp.initialize({
  'list-actions': function(t, options){
    return [{
      icon: './trello-player-192.png',
      text: 'Audio Player',
      callback: async function (t) {
        this.audioPlayer.play();
        return t.modal({
          title: "Audio Player",
          url: "./trello-player-power-up-popup.html",
          fullscreen: true,
          actions: [{
            icon: './trello-player-192.png',
            url: 'https://github.com/vitar/trello-player',
            alt: 'Audio Player',
            position: 'left',
          }],
        });
      },
    }];
  },
});
