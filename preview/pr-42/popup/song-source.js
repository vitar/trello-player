import { t } from './trello.js';

const SUPPORTED_AUDIO_EXTENSIONS = ['.m4a', '.mp3'];

function isSupportedAttachment(attachment) {
  return SUPPORTED_AUDIO_EXTENSIONS.some((ext) => attachment.url?.toLowerCase().endsWith(ext));
}

export async function fetchSongAttachments({ apiKey, token }) {
  const listInfo = await t.list('id');
  const response = await fetch(
    `https://api.trello.com/1/lists/${listInfo.id}/cards?attachments=true&key=${apiKey}&token=${token}`
  );
  if (!response.ok) {
    throw new Error(`Trello responded with status ${response.status}`);
  }
  const cards = await response.json();
  const attachments = [];
  cards.forEach((card) => {
    const cardAttachments = card.attachments
      .filter(isSupportedAttachment)
      .map((attachment) => ({ ...attachment, cardId: card.id }));
    attachments.push(...cardAttachments);
  });
  return attachments;
}
