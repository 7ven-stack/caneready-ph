import React, { useState, useEffect, useMemo } from 'react';
import { Bell, X } from 'lucide-react';

let hasShownReminderThisSession = false;

export default function NeedsAttentionPanel({
  lots = [],
  isLoading = false,
  suppressed = false,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const attentionCount = useMemo(() => {
    return lots.filter(
      (lot) => lot.status === 'Harvest Due' || !lot.plannedHarvestDate
    ).length;
  }, [lots]);

  const hasItems = attentionCount > 0;

  useEffect(() => {
    if (isLoading || !hasItems || hasShownReminderThisSession) return;

    setShouldRender(true);
    const enterTimer = setTimeout(() => {
      hasShownReminderThisSession = true;
      setIsVisible(true);
    }, 50);

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, 3600);

    const unmountTimer = setTimeout(() => {
      setShouldRender(false);
    }, 4000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(hideTimer);
      clearTimeout(unmountTimer);
    };
  }, [isLoading, hasItems]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => setShouldRender(false), 300);
  };

  if (suppressed || !shouldRender || !hasItems) return null;

  return (
    <div
      className={
        'fixed top-16 right-4 z-[1150] max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-emerald-200 dark:border-emerald-800/80 p-3 flex items-center gap-3 transition-all duration-300 ' +
        (isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2 pointer-events-none')
      }
    >
      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4" />
      </div>
      <div className="text-xs flex-1 min-w-0">
        <p className="font-bold text-slate-900 dark:text-white">
          {attentionCount} Planter Harvest Reminders
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Click the bell icon in the top bar anytime to view or schedule.
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
