import React, { useRef, useState, useEffect } from 'react';
import MobileStateMessage from './MobileStateMessage';

export default function MobileChartPager({ slides = [], ready = false }) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!ready) setActiveIndex(0);
  }, [ready]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !ready || slides.length === 0) return undefined;

    const sections = container.querySelectorAll('[data-chart-slide]');
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length === 0) return;
        const idx = Number(visible[0].target.getAttribute('data-chart-slide'));
        if (!Number.isNaN(idx)) setActiveIndex(idx);
      },
      { root: container, threshold: [0.35, 0.5, 0.65] },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ready, slides.length]);

  const scrollToSlide = (idx) => {
    const target = scrollRef.current?.querySelector(`[data-chart-slide="${idx}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < slides.length - 1;

  if (!ready) {
    return <MobileStateMessage variant="loading" title="טוען גרפים..." />;
  }

  if (slides.length === 0) {
    return (
      <MobileStateMessage
        variant="empty"
        title="אין גרפים להצגה"
        description="הנתונים יופיעו לאחר יצירת אירוע והזנת אורחים."
      />
    );
  }

  const activeSlide = slides[activeIndex] || slides[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pb-3 pt-1">
        <div className="flex items-center justify-center gap-2" role="tablist" aria-label="גרפים">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={activeIndex === idx}
              aria-label={`${idx + 1}. ${slide.label}`}
              onClick={() => scrollToSlide(idx)}
              className={`rounded-full transition-all ${
                activeIndex === idx ? 'h-2.5 w-8 bg-indigo-400' : 'h-2.5 w-2.5 bg-white/25'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-slate-400">
          {activeIndex + 1} מתוך {slides.length} · {activeSlide.label}
          {activeIndex < slides.length - 1 ? ' · גלול לגרף הבא' : ''}
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => canGoPrev && scrollToSlide(activeIndex - 1)}
            disabled={!canGoPrev}
            className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-xs font-bold text-slate-200 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            לגרף קודם
          </button>
          <button
            type="button"
            onClick={() => canGoNext && scrollToSlide(activeIndex + 1)}
            disabled={!canGoNext}
            className="rounded-full border border-indigo-400/45 bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-100 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            לגרף הבא
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain px-4 pb-5"
      >
        {slides.map((slide, idx) => (
          <section
            key={slide.id}
            data-chart-slide={idx}
            role="tabpanel"
            aria-label={slide.label}
            className="mb-6 min-h-[min(72vh,640px)] snap-start snap-always scroll-mt-1 last:mb-2"
          >
            {slide.content}
          </section>
        ))}
      </div>
    </div>
  );
}
