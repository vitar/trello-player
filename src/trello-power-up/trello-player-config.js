(function initializeTrelloPlayerConfig() {
  const existing = window.trelloPlayerConfig || {};
  if (typeof existing.proxyUrl !== 'string' || !existing.proxyUrl) {
    existing.proxyUrl = 'https://trello-proxy/';
  }
  window.trelloPlayerConfig = existing;
})();
