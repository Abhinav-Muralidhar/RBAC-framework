let activeLocks = 0;
let previousOverflow = '';
let previousPaddingRight = '';

export function lockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  activeLocks += 1;

  if (activeLocks === 1) {
    const { body, documentElement } = document;
    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  let released = false;

  return () => {
    if (released || typeof document === 'undefined') {
      return;
    }

    released = true;
    activeLocks = Math.max(0, activeLocks - 1);

    if (activeLocks === 0) {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    }
  };
}
