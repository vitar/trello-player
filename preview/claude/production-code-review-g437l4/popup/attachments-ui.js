import { dom } from './dom.js';
import { caches } from './state.js';
import { formatDuration } from './audio-helpers.js';

export function clearAttachmentList() {
  if (dom.attachmentsList) {
    dom.attachmentsList.innerHTML = '';
  }
}

export function createAttachmentListItem(attachment, onClick) {
  const template = dom.attachmentTemplate;
  if (!template || !template.content) {
    return null;
  }
  const li = template.content.firstElementChild.cloneNode(true);
  li.dataset.attachmentId = attachment.id;
  li.dataset.originalName = attachment.name;
  const nameElement = li.querySelector('.attachment-name');
  if (nameElement) {
    nameElement.textContent = attachment.name;
  }
  li.addEventListener('click', () => {
    onClick(attachment.id);
  });
  return li;
}

export function appendAttachmentListItem(element) {
  if (dom.attachmentsList && element) {
    dom.attachmentsList.appendChild(element);
  }
}

export function updateAttachmentDurationDisplay(attachmentId) {
  if (!attachmentId || !dom.attachmentsList) {
    return;
  }
  const listItem = dom.attachmentsList.querySelector(`li[data-attachment-id="${attachmentId}"]`);
  if (!listItem) {
    return;
  }
  const nameElement = listItem.querySelector('.attachment-name');
  if (!nameElement) {
    return;
  }
  const originalName = listItem.dataset.originalName || nameElement.textContent;
  listItem.dataset.originalName = originalName;
  const storedDuration = caches.attachmentDurations.get(attachmentId);
  const formattedDuration = formatDuration(storedDuration);
  if (formattedDuration) {
    nameElement.textContent = `(${formattedDuration}) ${originalName}`;
  } else {
    nameElement.textContent = originalName;
  }
}
