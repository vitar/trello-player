window.TrelloPowerUp.initialize({
  'list-actions': function(t, options){
    return [{
      icon: './trello-player-192.png',
      text: 'Trello Player',
      callback: async function (t) {
        const list = await t.list('cards');
        for (const card of list.cards) {
          console.log(card.id);
        }
      },
    }];
  },
}, {
  helpfulStacks: true
});
