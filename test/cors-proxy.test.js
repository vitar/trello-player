import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/cloudflare-worker-cors-proxy/index.js';

const PROXY = 'https://proxy.example.workers.dev/';
const ATTACHMENT_URL =
  'https://trello.com/1/cards/abc/attachments/def/download/song.mp3';
const ENV = { ALLOWED_ORIGIN_DOMAIN: 'player.example.com' };

function proxyRequest({ url = ATTACHMENT_URL, origin = 'https://player.example.com', method = 'GET', headers = {} } = {}) {
  const target = url === null ? PROXY : `${PROXY}?url=${encodeURIComponent(url)}`;
  const allHeaders = { ...headers };
  if (origin !== null) {
    allHeaders.Origin = origin;
  }
  return new Request(target, { method, headers: allHeaders });
}

describe('cors proxy', () => {
  let upstreamCalls;
  let originalFetch;

  beforeEach(() => {
    upstreamCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (request) => {
      upstreamCalls.push(request);
      return new Response('audio-bytes', {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' }
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('request validation', () => {
    test('rejects requests without a url parameter', async () => {
      const response = await worker.fetch(proxyRequest({ url: null }), ENV);
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects requests without an Origin header', async () => {
      const response = await worker.fetch(proxyRequest({ origin: null }), ENV);
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects origins outside the allowed domain', async () => {
      const response = await worker.fetch(proxyRequest({ origin: 'https://evil.example' }), ENV);
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects look-alike origins that only end with the allowed domain text', async () => {
      const response = await worker.fetch(
        proxyRequest({ origin: 'https://evilplayer.example.com' }),
        ENV
      );
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('accepts the exact allowed domain', async () => {
      const response = await worker.fetch(proxyRequest(), ENV);
      assert.equal(response.status, 200);
    });

    test('accepts subdomains of the allowed domain', async () => {
      const response = await worker.fetch(
        proxyRequest({ origin: 'https://preview.player.example.com' }),
        ENV
      );
      assert.equal(response.status, 200);
    });

    test('accepts any domain from a comma-separated list', async () => {
      const env = { ALLOWED_ORIGIN_DOMAIN: 'other.example, player.example.com' };
      const response = await worker.fetch(proxyRequest(), env);
      assert.equal(response.status, 200);
    });
  });

  describe('CORS preflight', () => {
    test('answers OPTIONS for an allowed origin without calling upstream', async () => {
      const response = await worker.fetch(
        proxyRequest({
          method: 'OPTIONS',
          headers: { 'Access-Control-Request-Headers': 'x-trello-auth' }
        }),
        ENV
      );
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://player.example.com');
      assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'x-trello-auth');
      assert.equal(upstreamCalls.length, 0);
    });
  });

  describe('forwarding', () => {
    test('converts x-trello-auth into the upstream Authorization header', async () => {
      const auth = 'OAuth oauth_consumer_key="key", oauth_token="token"';
      await worker.fetch(proxyRequest({ headers: { 'x-trello-auth': auth } }), ENV);
      assert.equal(upstreamCalls.length, 1);
      assert.equal(upstreamCalls[0].url, ATTACHMENT_URL);
      assert.equal(upstreamCalls[0].headers.get('Authorization'), auth);
    });

    test('does not send an Authorization header when x-trello-auth is absent', async () => {
      await worker.fetch(proxyRequest(), ENV);
      assert.equal(upstreamCalls[0].headers.get('Authorization'), null);
    });

    test('adds CORS and caching headers to the upstream response', async () => {
      const response = await worker.fetch(proxyRequest(), ENV);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://player.example.com');
      assert.equal(response.headers.get('Vary'), 'Origin');
      assert.equal(response.headers.get('Cache-Control'), 'private, max-age=86400');
      assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
      assert.equal(await response.text(), 'audio-bytes');
    });

    test('returns 500 when the upstream fetch throws', async () => {
      globalThis.fetch = async () => {
        throw new Error('network down');
      };
      const response = await worker.fetch(proxyRequest(), ENV);
      assert.equal(response.status, 500);
    });
  });

  // Known security gaps from the production review. Convert each todo into a
  // real test in the same change that fixes it.
  describe('security hardening (planned)', () => {
    test.todo('rejects target URLs that are not https');
    test.todo('rejects target hosts outside the Trello allowlist');
    test.todo('never forwards Authorization to non-Trello hosts');
    test.todo('rejects methods other than GET, HEAD and OPTIONS');
    test.todo('refuses all requests when ALLOWED_ORIGIN_DOMAIN is not configured');
  });
});
