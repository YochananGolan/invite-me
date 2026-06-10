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

            function getDragLayer() {
              var layer = document.getElementById('meetm-userway-drag-layer');
              if (layer) {
                document.body.appendChild(layer);
                return layer;
              }

              layer = document.createElement('div');
              layer.id = 'meetm-userway-drag-layer';
              layer.setAttribute('aria-label', 'גרור להזזת כפתור הנגישות');
              layer.setAttribute('title', 'גרור להזזת כפתור הנגישות');
              layer.textContent = '↕';
              document.body.appendChild(layer);

              layer.style.setProperty('position', 'fixed', 'important');
              layer.style.setProperty('z-index', '2147483647', 'important');
              layer.style.setProperty('display', 'flex', 'important');
              layer.style.setProperty('align-items', 'center', 'important');
              layer.style.setProperty('justify-content', 'center', 'important');
              layer.style.setProperty('background', 'rgba(15, 23, 42, 0.88)', 'important');
              layer.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.85)', 'important');
              layer.style.setProperty('border-radius', '999px', 'important');
              layer.style.setProperty('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.35)', 'important');
              layer.style.setProperty('color', '#ffffff', 'important');
              layer.style.setProperty('font', '700 16px/1 Arial, sans-serif', 'important');
              layer.style.setProperty('touch-action', 'none', 'important');
              layer.style.setProperty('cursor', 'grab', 'important');
              layer.style.setProperty('user-select', 'none', 'important');

              return layer;
            }

            function syncDragLayer(layer, target) {
              var rect = target.getBoundingClientRect();
              var size = 28;
              var top = clamp(rect.top - 10, 8, window.innerHeight - size - 8);
              var left = clamp(rect.left - 10, 8, window.innerWidth - size - 8);

              layer.style.setProperty('top', top + 'px', 'important');
              layer.style.setProperty('left', left + 'px', 'important');
              layer.style.setProperty('width', size + 'px', 'important');
              layer.style.setProperty('height', size + 'px', 'important');
              layer.style.setProperty('right', 'auto', 'important');
              layer.style.setProperty('bottom', 'auto', 'important');
            }

            function forwardClickThroughLayer(layer, event) {
              layer.style.setProperty('pointer-events', 'none', 'important');
              var target = document.elementFromPoint(event.clientX, event.clientY);
              window.setTimeout(function() {
                layer.style.setProperty('pointer-events', 'auto', 'important');
              }, 0);

              if (target && target !== layer && typeof target.click === 'function') {
                target.click();
              }
            }

            function setupDrag(layer) {
              if (layer.dataset.meetmDraggable === 'true') return;
              layer.dataset.meetmDraggable = 'true';

              layer.addEventListener('pointerdown', function(event) {
                if (event.button !== undefined && event.button !== 0) return;

                var elements = getWidgetElements();
                if (!elements.handle) return;

                var rect = elements.handle.getBoundingClientRect();
                didDrag = false;
                dragState = {
                  pointerId: event.pointerId,
                  target: elements.handle,
                  offsetX: event.clientX - rect.left,
                  offsetY: event.clientY - rect.top
                };
                event.preventDefault();
                event.stopPropagation();
                layer.style.setProperty('cursor', 'grabbing', 'important');
                if (layer.setPointerCapture) {
                  try {
                    layer.setPointerCapture(event.pointerId);
                  } catch (error) {}
                }
              }, true);

              layer.addEventListener('pointermove', function(event) {
                if (!dragState || dragState.pointerId !== event.pointerId) return;

                event.preventDefault();
                event.stopPropagation();
                var rect = dragState.target.getBoundingClientRect();
                var nextPosition = {
                  top: event.clientY - dragState.offsetY,
                  left: event.clientX - dragState.offsetX
                };
                if (Math.abs(nextPosition.top - rect.top) > 3 || Math.abs(nextPosition.left - rect.left) > 3) {
                  didDrag = true;
                }
                applyPosition(dragState.target, nextPosition);
                syncDragLayer(layer, dragState.target);
              }, true);

              layer.addEventListener('pointerup', function(event) {
                if (!dragState || dragState.pointerId !== event.pointerId) return;

                event.preventDefault();
                event.stopPropagation();
                var rect = dragState.target.getBoundingClientRect();
                var wasDrag = didDrag;
                savePosition({ top: rect.top, left: rect.left });
                dragState = null;
                didDrag = false;
                layer.style.setProperty('cursor', 'grab', 'important');
                if (layer.releasePointerCapture) {
                  try {
                    layer.releasePointerCapture(event.pointerId);
                  } catch (error) {}
                }
                if (!wasDrag) forwardClickThroughLayer(layer, event);
              }, true);

              layer.addEventListener('pointercancel', function() {
                dragState = null;
                didDrag = false;
                layer.style.setProperty('cursor', 'grab', 'important');
              }, true);
            }

            function positionWidget() {
              if (dragState) return;

              var elements = getWidgetElements();
              if (!elements.root || !elements.handle) return;

              elements.root.style.setProperty('position', 'fixed', 'important');
              elements.root.style.setProperty('z-index', '2147483647', 'important');
              applyPosition(elements.handle, getSavedPosition() || getDefaultPosition());
              var layer = getDragLayer();
              syncDragLayer(layer, elements.handle);
              setupDrag(layer);
            }

            setInterval(positionWidget, 1000);
            window.addEventListener('resize', function() {
              var elements = getWidgetElements();
              if (elements.handle) {
                var rect = elements.handle.getBoundingClientRect();
                applyPosition(elements.handle, { top: rect.top, left: rect.left });
                syncDragLayer(getDragLayer(), elements.handle);
              }
            });
          })();
        `}} />
      </body>
    </Html>
  );
}

