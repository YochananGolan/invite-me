import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html dir="rtl" lang="he">
      <Head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvgxmlns='http://www.w3.org/2000/svg'viewBox='0 0 100 100'%3E%3Ctexty='.9em'font-size='90'%3E✉️%3C/text%3E%3C/svg%3E"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Heebo:wght@400;500;600;700&family=Secular+One&family=Rubik:wght@400;500;700&family=Noto+Sans+Hebrew:wght@400;600;700&family=Frank+Ruhl+Libre:wght@400;500;700&family=Varela+Round&family=Alef:wght@400;700&family=Suez+One&family=Gveret+Levin&display=swap" rel="stylesheet" />
        <script src="https://cdn.userway.org/widget.js" data-account="qK2or1KFZX" data-position="2"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var storageKey = 'meetm:userway-position';
            var dragState = null;
            var didDrag = false;

            function clamp(value, min, max) {
              return Math.min(Math.max(value, min), max);
            }

            function getDefaultPosition() {
              return {
                top: window.innerWidth < 640 ? 16 : 68,
                left: window.innerWidth - 16 - 56
              };
            }

            function getSavedPosition() {
              try {
                return JSON.parse(window.localStorage.getItem(storageKey) || 'null');
              } catch (error) {
                return null;
              }
            }

            function savePosition(position) {
              try {
                window.localStorage.setItem(storageKey, JSON.stringify(position));
              } catch (error) {
                // Ignore storage errors so the accessibility widget still works.
              }
            }

            function applyPosition(el, position) {
              var rect = el.getBoundingClientRect();
              var width = rect.width || 56;
              var height = rect.height || 56;
              var top = clamp(position.top, 8, window.innerHeight - height - 8);
              var left = clamp(position.left, 8, window.innerWidth - width - 8);

              el.style.setProperty('position', 'fixed', 'important');
              el.style.setProperty('top', top + 'px', 'important');
              el.style.setProperty('left', left + 'px', 'important');
              el.style.setProperty('right', 'auto', 'important');
              el.style.setProperty('bottom', 'auto', 'important');
              el.style.setProperty('transform', 'none', 'important');
              el.style.setProperty('touch-action', 'none', 'important');
              el.style.setProperty('cursor', 'grab', 'important');
            }

            function getWidgetElements() {
              var root = document.querySelector('.uwy');
              var handle = document.querySelector('.uwy .userway_buttons_wrapper') ||
                document.getElementById('userwayAccessibilityIcon') ||
                root;

              return { root: root, handle: handle };
            }

            function setupDrag(el) {
              if (el.dataset.meetmDraggable === 'true') return;
              el.dataset.meetmDraggable = 'true';

              el.addEventListener('pointerdown', function(event) {
                if (event.button !== undefined && event.button !== 0) return;

                var rect = el.getBoundingClientRect();
                didDrag = false;
                dragState = {
                  pointerId: event.pointerId,
                  offsetX: event.clientX - rect.left,
                  offsetY: event.clientY - rect.top
                };
                el.style.setProperty('cursor', 'grabbing', 'important');
                if (el.setPointerCapture) {
                  try {
                    el.setPointerCapture(event.pointerId);
                  } catch (error) {}
                }
              }, true);

              el.addEventListener('pointermove', function(event) {
                if (!dragState || dragState.pointerId !== event.pointerId) return;

                event.preventDefault();
                var rect = el.getBoundingClientRect();
                var nextPosition = {
                  top: event.clientY - dragState.offsetY,
                  left: event.clientX - dragState.offsetX
                };
                if (Math.abs(nextPosition.top - rect.top) > 3 || Math.abs(nextPosition.left - rect.left) > 3) {
                  didDrag = true;
                }
                applyPosition(el, nextPosition);
              }, true);

              el.addEventListener('pointerup', function(event) {
                if (!dragState || dragState.pointerId !== event.pointerId) return;

                var rect = el.getBoundingClientRect();
                savePosition({ top: rect.top, left: rect.left });
                dragState = null;
                el.style.setProperty('cursor', 'grab', 'important');
                if (el.releasePointerCapture) {
                  try {
                    el.releasePointerCapture(event.pointerId);
                  } catch (error) {}
                }
                if (didDrag) {
                  window.setTimeout(function() {
                    didDrag = false;
                  }, 0);
                }
              }, true);

              el.addEventListener('pointercancel', function() {
                dragState = null;
                didDrag = false;
                el.style.setProperty('cursor', 'grab', 'important');
              }, true);

              el.addEventListener('click', function(event) {
                if (!didDrag) return;
                event.preventDefault();
                event.stopPropagation();
                didDrag = false;
              }, true);
            }

            function positionWidget() {
              if (dragState) return;

              var elements = getWidgetElements();
              if (!elements.root || !elements.handle) return;

              elements.root.style.setProperty('position', 'fixed', 'important');
              elements.root.style.setProperty('z-index', '2147483647', 'important');
              applyPosition(elements.handle, getSavedPosition() || getDefaultPosition());
              setupDrag(elements.handle);
            }

            setInterval(positionWidget, 1000);
            window.addEventListener('resize', function() {
              var elements = getWidgetElements();
              if (elements.handle) {
                var rect = elements.handle.getBoundingClientRect();
                applyPosition(elements.handle, { top: rect.top, left: rect.left });
              }
            });
          })();
        `}} />
      </body>
    </Html>
  );
}

