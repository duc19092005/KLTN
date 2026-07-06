import { useEffect } from 'react';
import { lockBodyScroll } from '../hooks/useBodyScrollLock';

function hasModalOverlay() {
  return Boolean(document.querySelector('.fixed.inset-0'));
}

export default function ModalScrollLockObserver() {
  useEffect(() => {
    let releaseLock = null;

    const sync = () => {
      const shouldLock = hasModalOverlay();
      if (shouldLock && !releaseLock) {
        releaseLock = lockBodyScroll('global-modal-observer');
      }
      if (!shouldLock && releaseLock) {
        releaseLock();
        releaseLock = null;
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();

    return () => {
      observer.disconnect();
      if (releaseLock) releaseLock();
    };
  }, []);

  return null;
}
