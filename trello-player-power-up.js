window.TrelloPowerUp.initialize({
  'list-actions': function(t, options){
    return [{
      icon: './trello-player-192.png',
      text: 'Trello Player',
      callback: async function (t) {
        return t.popup({
          title: "Trello Player",
          url: "./trello-player-power-up-popup.html",
        });
      },
    }];
  },
}, {
  helpfulStacks: true
});
