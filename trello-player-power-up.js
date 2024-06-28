//
var Promise = TrelloPowerUp.Promise;

TrelloPowerUp.initialize({
  'board-buttons': function(t, options){
    return [{
      icon: './trello-player-192.png',
      text: 'Trello Player',
    }];
  },
}, {
  helpfulStacks: true
});
