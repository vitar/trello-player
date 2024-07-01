window.TrelloPowerUp.initialize({
  'list-actions': function(t, options){
    return [{
      icon: './trello-player-192.png',
      text: 'Trello Player',
      callback: async function (t) {
        return t.modal({
          title: "Trello Player",
          url: "./trello-player-power-up-popup.html",
          fullscreen: false,
          actions: [{
            icon: './trello-player-192.png',
            url: 'https://github.com/vitar/trello-player',
            alt: 'Trello Player',
            position: 'left',
          }],
        });
      },
    }];
  },
}, {
  helpfulStacks: true
});
