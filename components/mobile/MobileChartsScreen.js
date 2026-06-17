import React, { useEffect, useState } from 'react';
import MobileChartPager from './MobileChartPager';
import MobileFullScreenShell from './MobileFullScreenShell';

export default function MobileChartsScreen({ slides = [], onClose }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <MobileFullScreenShell
      testId="mobile-charts-screen"
      eyebrow="הצג גרפים"
      title="דוחות וגרפים"
      onClose={onClose}
      headerExtra={(
        <p className="mt-1 text-xs font-semibold text-slate-400">
          גלול או הקש על הנקודות למעבר בין הגרפים
        </p>
      )}
    >
      <MobileChartPager ready={ready} slides={slides} />
    </MobileFullScreenShell>
  );
}
