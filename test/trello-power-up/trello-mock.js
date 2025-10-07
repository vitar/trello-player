function createMockTrello() {
  return {
    list: async () => ({
      cards: [{
        id: 'c1',
        attachments: [
          { id: 'a1', name: 'sample.mp3', url: 'http://example.com/sample.mp3' }
        ]
      }]
    }),
    authorize: async () => {},
    getRestApi: () => ({ getToken: async () => 'mock-token' }),
    get: async () => null,
    set: async () => {},
    remove: async () => {}
  };
}

export function installTrelloMock(window) {
  window.TrelloPowerUp = {
    iframe: () => createMockTrello(),
    initialize: () => {}
  };
}

