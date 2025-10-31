import { PROXY_URL, AUDIO_CACHE_LIMIT } from './constants.js';
import { caches, state } from './state.js';

async function fetchAttachmentBlob(originalUrl) {
  if (!state.trelloToken) {
    throw new Error('Missing Trello token');
  }
  const proxiedUrl = `${PROXY_URL}?url=${encodeURIComponent(originalUrl)}`;
  const auth = `OAuth oauth_consumer_key="${state.apiKey}", oauth_token="${state.trelloToken}"`;
  const response = await fetch(proxiedUrl, {
    headers: {
      'x-trello-auth': auth
    }
  });
  if (!response.ok) {
    throw new Error(`Proxy request failed with status ${response.status}`);
  }
  return await response.blob();
}

function trimAudioCache(preserveIds = []) {
  if (caches.audioBlobCache.size <= AUDIO_CACHE_LIMIT) {
    return;
  }
  const preserveSet = new Set(preserveIds.filter(Boolean));
  for (const [attachmentId] of caches.audioBlobCache) {
    if (caches.audioBlobCache.size <= AUDIO_CACHE_LIMIT) {
      break;
    }
    if (preserveSet.has(attachmentId)) {
      preserveSet.delete(attachmentId);
      continue;
    }
    caches.audioBlobCache.delete(attachmentId);
  }
}

function fetchAndCacheAttachment(attachment) {
  if (!attachment) {
    return null;
  }
  if (!caches.audioBlobCache.has(attachment.id)) {
    const downloadPromise = fetchAttachmentBlob(attachment.url);
    caches.audioBlobCache.set(attachment.id, downloadPromise);
    trimAudioCache([attachment.id, state.m4aAttachments[state.currentAttachmentIndex]?.id]);
    downloadPromise.catch(() => {
      if (caches.audioBlobCache.get(attachment.id) === downloadPromise) {
        caches.audioBlobCache.delete(attachment.id);
      }
    });
  }
  return caches.audioBlobCache.get(attachment.id);
}

export async function getAttachmentBlob(attachment) {
  const blobPromise = fetchAndCacheAttachment(attachment);
  if (!blobPromise) {
    throw new Error('Unable to resolve attachment blob');
  }
  return await blobPromise;
}

export function prefetchAttachment(index) {
  if (index < 0 || index >= state.m4aAttachments.length) {
    return;
  }
  fetchAndCacheAttachment(state.m4aAttachments[index]);
}

export function prefetchAdjacent(index) {
  prefetchAttachment(index + 1);
  prefetchAttachment(index - 1);
}

export function revokeCurrentObjectUrl() {
  if (state.currentObjectUrl) {
    URL.revokeObjectURL(state.currentObjectUrl);
    state.currentObjectUrl = null;
  }
}

export function clearAudioCache() {
  caches.audioBlobCache.clear();
}
