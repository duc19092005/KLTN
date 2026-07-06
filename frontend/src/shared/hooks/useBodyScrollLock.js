import { useEffect } from 'react';

const LOCK_CLASS = 'modal-scroll-locked';
const lockStack = [];

function getScrollbarWidth() {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function applyBodyLock() {
  const body = document.body;
  const scrollbarWidth = getScrollbarWidth();
  const currentPaddingRight = window.getComputedStyle(body).paddingRight;

  body.dataset.previousOverflow = body.style.overflow || '';
  body.dataset.previousPaddingRight = body.style.paddingRight || '';
  body.dataset.previousComputedPaddingRight = currentPaddingRight || '0px';

  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `calc(${currentPaddingRight} + ${scrollbarWidth}px)`;
  }
  body.classList.add(LOCK_CLASS);
}

function releaseBodyLock() {
  const body = document.body;
  body.style.overflow = body.dataset.previousOverflow || '';
  body.style.paddingRight = body.dataset.previousPaddingRight || '';
  body.classList.remove(LOCK_CLASS);
  delete body.dataset.previousOverflow;
  delete body.dataset.previousPaddingRight;
  delete body.dataset.previousComputedPaddingRight;
}

export function lockBodyScroll(lockId = Symbol('modal-scroll-lock')) {
  if (typeof window === 'undefined') return () => {};

  if (lockStack.length === 0) applyBodyLock();
  lockStack.push(lockId);

  return () => {
    const index = lockStack.indexOf(lockId);
    if (index >= 0) lockStack.splice(index, 1);
    if (lockStack.length === 0) releaseBodyLock();
  };
}

export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    return lockBodyScroll(Symbol('modal-scroll-lock'));
  }, [active]);
}
