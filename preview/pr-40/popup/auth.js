import { dom } from './dom.js';
import { state } from './state.js';
import { t } from './trello.js';

function isValidToken(token) {
  const isString = typeof token === 'string';
  const isTest = /^[a-zA-Z0-9]{64,80}$/i.test(token);
  return isString && isTest;
}

async function validateToken(key, token) {
  if (!key || !token) return false;
  try {
    const resp = await fetch(`https://api.trello.com/1/members/me?key=${key}&token=${token}`);
    return resp.status === 200;
  } catch {
    return false;
  }
}

function showAuthForm() {
  dom.authForm?.classList.remove('hidden');
  dom.attachmentsContainer?.classList.add('hidden');
}

function hideAuthForm() {
  dom.authForm?.classList.add('hidden');
  dom.attachmentsContainer?.classList.remove('hidden');
}

export function setupAuth(player) {
  async function handleAuthorizeClick() {
    const key = dom.apiKeyInput?.value.trim() ?? '';
    state.apiKey = key;
    await t.set('board', 'shared', 'apikey', key);
    const returnUrl = window.location.href.split('#')[0];
    const authUrl = () =>
      'https://trello.com/1/authorize?expiration=never' +
      '&scope=read&key=' + encodeURIComponent(key) +
      '&callback_method=postMessage' +
      '&return_url=' + encodeURIComponent(returnUrl);

    if (state.authMessageHandler) {
      window.removeEventListener('message', state.authMessageHandler);
      state.authMessageHandler = null;
    }

    state.authMessageHandler = async (event) => {
      if (!state.popup || event.source !== state.popup) return;
      const token = typeof event.data === 'string' ? event.data.trim() : '';
      if (!isValidToken(token)) return;
      window.removeEventListener('message', state.authMessageHandler);
      state.authMessageHandler = null;
      if (!(await validateToken(key, token))) {
        alert('Failed to validate Trello authorization. Please try again.');
        state.popup?.close();
        state.popup = null;
        return;
      }
      await t.set('member', 'private', 'token', token);
      state.popup?.close();
      state.popup = null;
      location.reload();
    };

    window.addEventListener('message', state.authMessageHandler);

    try {
      await t.authorize(authUrl, {
        validToken: isValidToken,
        windowCallback: (win) => {
          state.popup = win;
        }
      });
    } catch (error) {
      window.removeEventListener('message', state.authMessageHandler);
      state.authMessageHandler = null;
      state.popup = null;
      console.error('Authorization popup failed to open:', error);
    }
  }

  dom.authorizeBtn?.addEventListener('click', handleAuthorizeClick);

  dom.apiKeyInput?.addEventListener('change', () => {
    state.apiKey = dom.apiKeyInput.value.trim();
    t.set('board', 'shared', 'apikey', state.apiKey);
  });

  async function initAuth() {
    const key = await t.get('board', 'shared', 'apikey');
    if (key && dom.apiKeyInput) {
      dom.apiKeyInput.value = key;
    }
    state.apiKey = dom.apiKeyInput?.value.trim() ?? '';

    const hashMatch = window.location.hash.match(/token=([^&]+)/);
    if (hashMatch) {
      await t.set('member', 'private', 'token', hashMatch[1]);
      window.location.hash = '';
    }

    const token = await t.get('member', 'private', 'token');
    if (token && (await validateToken(state.apiKey, token))) {
      hideAuthForm();
      state.trelloToken = token;
      await player.loadPlayer();
    } else {
      if (token) {
        await t.set('member', 'private', 'token', null);
      }
      showAuthForm();
    }
  }

  return {
    initAuth
  };
}
