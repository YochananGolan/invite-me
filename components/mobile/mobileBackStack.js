const stack = [];
let overlayDepth = 0;
let pendingOpens = 0;
let programmaticBack = false;
let listenerReady = false;
let releaseTimer = null;

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 639px)').matches;
}

function currentUrl() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function clearOverlayHistoryIfIdle() {
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (!isMobileViewport()) return;
    if (overlayDepth > 0 || pendingOpens > 0) return;
    if (!window.history.state?.invitemeMobileOverlay) return;

    programmaticBack = true;
    window.history.replaceState(null, '', currentUrl());
    queueMicrotask(() => {
      programmaticBack = false;
    });
  }, 0);
}

function handlePopState() {
  if (programmaticBack) {
    programmaticBack = false;
    return;
  }

  const entry = stack.pop();
  overlayDepth = Math.max(0, overlayDepth - 1);
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
  clearTimeout(releaseTimer);
  releaseTimer = null;
  pendingOpens += 1;

  const entry = { onClose };
  stack.push(entry);
  window.history.pushState({ invitemeMobileOverlay: true }, '', currentUrl());
  overlayDepth += 1;

  queueMicrotask(() => {
    pendingOpens = Math.max(0, pendingOpens - 1);
  });

  return () => {
    const idx = stack.indexOf(entry);
    if (idx === -1) return;
    stack.splice(idx, 1);
    overlayDepth = Math.max(0, overlayDepth - 1);

    if (typeof window !== 'undefined' && window.history.state?.invitemeMobileOverlay) {
      programmaticBack = true;
      window.history.back();
    }

    queueMicrotask(() => {
      queueMicrotask(() => {
        if (pendingOpens > 0 || overlayDepth > 0) return;
        clearOverlayHistoryIfIdle();
      });
    });
  };
}
