const stack = [];
let programmaticBack = false;
let listenerReady = false;

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 639px)').matches;
}

function handlePopState() {
  if (programmaticBack) {
    programmaticBack = false;
    return;
  }

  const entry = stack.pop();
  entry?.onClose?.();
}

function ensureListener() {
  if (listenerReady || typeof window === 'undefined') return;
  listenerReady = true;
  window.addEventListener('popstate', handlePopState);
}

export function pushMobileBackStack(onClose) {
  if (!isMobileViewport()) {
    return () => {};
  }

  ensureListener();

  const entry = { onClose };
  stack.push(entry);

  const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.history.pushState({ invitemeMobileOverlay: true }, '', url);

  return () => {
    const idx = stack.indexOf(entry);
    if (idx === -1) return;
    stack.splice(idx, 1);
    programmaticBack = true;
    window.history.back();
  };
}
