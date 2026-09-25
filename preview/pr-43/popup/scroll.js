export function clampScrollTarget(container, target) {
  const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
  return Math.max(0, Math.min(target, maxScroll));
}

export function scrollActiveAttachmentIntoView(list, { direction = null } = {}) {
  if (!list) {
    return;
  }
  const activeItem = list.querySelector('li.active');
  if (!activeItem) {
    return;
  }
  const containerHeight = list.clientHeight;
  if (containerHeight <= 0) {
    return;
  }

  const containerRect = list.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();
  const scrollTop = list.scrollTop;
  const itemTop = scrollTop + itemRect.top - containerRect.top;
  const containerMiddle = scrollTop + containerHeight / 2;
  const itemHeight = activeItem.offsetHeight;
  const itemBottom = itemTop + itemHeight;
  const itemCenter = itemTop + itemHeight / 2;
  const isBelowView = itemBottom > scrollTop + containerHeight;
  const isAboveView = itemTop < scrollTop;
  let shouldAdjust = false;

  if (direction === 'forward') {
    shouldAdjust = itemCenter > containerMiddle;
  } else if (direction === 'backward') {
    shouldAdjust = itemCenter < containerMiddle;
  } else {
    shouldAdjust = isBelowView || isAboveView;
  }

  if (!shouldAdjust) {
    return;
  }

  const target = clampScrollTarget(list, itemCenter - containerHeight / 2);
  list.scrollTo({ top: target, behavior: 'smooth' });
}
