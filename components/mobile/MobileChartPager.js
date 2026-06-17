import React, { useRef, useState, useEffect } from 'react';

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

  if (!ready) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-300"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm font-semibold text-slate-400">טוען גרפים...</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-4xl" aria-hidden="true">📊</div>
        <p className="mt-3 text-base font-bold text-slate-200">אין גרפים להצגה</p>
        <p className="mt-2 text-sm font-semibold text-slate-400">הנתונים יופיעו לאחר יצירת אירוע והזנת אורחים.</p>
      </div>
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
