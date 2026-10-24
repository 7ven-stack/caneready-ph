import React, { useState, useMemo, useEffect } from 'react';
import { Bell, X } from 'lucide-react';

export default function NeedsAttentionPanel({
  lots = [],
  isLoading = false,
}) {
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const attentionCount = useMemo(() => {
    return lots.filter(
      (l) => l.status === 'Harvest Due' || !l.plannedHarvestDate
    ).length;
  }, [lots]);

  const handleFadeOut = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsRendered(false);
    }, 500);
  };

  useEffect(() => {
    if (isLoading || attentionCount === 0) return;

    setIsRendered(true);
    // Trigger smooth fade-in on next frame
    const enterTimer = setTimeout(() => {
      setIsVisible(true);
    }, 40);

    // Start smooth fade-out after 5.2 seconds
    const fadeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 5200);

    // Unmount from DOM after the 500ms fade-out completes
    const unmountTimer = setTimeout(() => {
      setIsRendered(false);
    }, 5750);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, [isLoading, attentionCount]);

  if (isLoading || attentionCount === 0 || !isRendered) {
    return null;
  }

  return (
    <div
      style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      className={
        'fixed top-16 right-4 z-[1150] max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-emerald-300 dark:border-emerald-800 px-3.5 py-2.5 flex items-center gap-3 text-xs transition-all duration-500 transform ' +
        (isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-2 scale-95 pointer-events-none')
      }
    >
      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-900 dark:text-white">
          {attentionCount} Planter Harvest Reminder{attentionCount === 1 ? '' : 's'}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Click the bell icon in the top bar anytime to view or schedule.
        </p>
      </div>
      <button
        type="button"
        onClick={handleFadeOut}
        title="Dismiss notification"
        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
