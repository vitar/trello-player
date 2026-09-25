import { t } from './trello.js';
import { isSupportedAttachment } from './attachment-filter.js';

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
