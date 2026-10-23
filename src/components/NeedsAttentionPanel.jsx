import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  FlaskConical,
  Truck,
  Clock,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';

export default function NeedsAttentionPanel({
  lots = [],
  onQuickLogBrix,
  onQuickScheduleCut,
  onSelectLot,
  isLoading = false,
  error = null,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 2b. Build ordered attention items:
  // 1. Over-mature or inversion-risk lots
  // 2. Lots needing a first sample
  // 3. Lots overdue for re-sampling (> 7 days)
  // 4. Cuts scheduled in the next 7 days
  // 5. Lots within 3 days of their estimated ready date
  const attentionItems = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const items = [];

    for (const lot of lots) {
      const isOverMatureOrInversion =
        lot.status === 'Over-mature Risk' ||
        (lot.hasBrixSample && lot.maturityRatio > 1.05);

      if (isOverMatureOrInversion) {
        items.push({
          priority: 1,
          key: `${lot.id}-overmature`,
          lot,
          badge:
            lot.status === 'Over-mature Risk'
              ? 'Over-mature Risk'
              : 'Inversion Watch',
          badgeTone:
            lot.status === 'Over-mature Risk'
              ? 'bg-rose-100 text-rose-800 border-rose-300'
              : 'bg-amber-100 text-amber-800 border-amber-300',
          icon: AlertTriangle,
          reason:
            lot.cropAgeMonths > 13.5 && (!lot.hasBrixSample || lot.maturityRatio <= 1.08)
              ? `Over age at ${lot.cropAgeMonths} mos (> 13.5m limit)`
              : `High T/B ratio (${lot.maturityRatio}) — sucrose inversion risk`,
        });
        continue;
      }

      if (!lot.hasBrixSample) {
        items.push({
          priority: 2,
          key: `${lot.id}-first-sample`,
          lot,
          badge: 'Needs first sample',
          badgeTone: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: FlaskConical,
          reason: `No refractometer reading yet (${lot.cropAgeMonths} mos old)`,
        });
        continue;
      }

      if (lot.lastSampled && lot.status !== 'OK to Harvest') {
        const sampledTime = new Date(lot.lastSampled + 'T00:00:00').getTime();
        if (!Number.isNaN(sampledTime)) {
          const daysSinceSample = Math.floor(
            (todayStart - sampledTime) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceSample > 7) {
            items.push({
              priority: 3,
              key: `${lot.id}-overdue-sample`,
              lot,
              badge: `Re-sample overdue (${daysSinceSample}d)`,
              badgeTone: 'bg-amber-50 text-amber-800 border-amber-200',
              icon: Clock,
              reason: `Last sampled ${lot.lastSampled} (${daysSinceSample} days ago)`,
            });
            continue;
          }
        }
      }

      if (lot.dispatch?.scheduledDate) {
        const cutTime = new Date(lot.dispatch.scheduledDate + 'T00:00:00').getTime();
        if (!Number.isNaN(cutTime)) {
          const daysUntilCut = Math.round(
            (cutTime - todayStart) / (1000 * 60 * 60 * 24)
          );
          if (daysUntilCut >= 0 && daysUntilCut <= 7) {
            items.push({
              priority: 4,
              key: `${lot.id}-upcoming-cut`,
              lot,
              badge:
                daysUntilCut === 0
                  ? 'Cut Today'
                  : `Cut in ${daysUntilCut}d`,
              badgeTone: 'bg-emerald-100 text-emerald-800 border-emerald-300',
              icon: Calendar,
              reason: `Scheduled ${lot.dispatch.scheduledDate} (${lot.dispatch.quedanTicket})`,
            });
            continue;
          }
        }
      }

      const daysRem = lot.estimatedReady?.daysRemaining;
      if (typeof daysRem === 'number' && daysRem > 0 && daysRem <= 3) {
        items.push({
          priority: 5,
          key: `${lot.id}-ready-soon`,
          lot,
          badge: `Ready in ${daysRem}d`,
          badgeTone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: Sparkles,
          reason: `Estimated ready on ${lot.estimatedReady.dateIso}`,
        });
      }
    }

    return items.sort((a, b) => a.priority - b.priority);
  }, [lots]);

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
        Needs Attention error: {error}
      </div>
    );
  }

  // 2b. Hidden when empty
  if (isLoading || attentionItems.length === 0) {
    return null;
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-amber-300/80 dark:border-amber-800/70 overflow-hidden shadow-2xs">
      <div className="px-4 py-2.5 bg-amber-50/80 dark:bg-amber-950/40 border-b border-amber-200/70 dark:border-amber-800/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white font-extrabold text-[11px]">
            {attentionItems.length}
          </span>
          <h3 className="font-extrabold text-slate-900 dark:text-white">
            Needs Attention
          </h3>
          <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
            Priority field actions ordered by urgency
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
        >
          <span>{isCollapsed ? 'Show' : 'Hide'}</span>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
          {attentionItems.map((item) => {
            const Icon = item.icon;
            const lot = item.lot;
            return (
              <div
                key={item.key}
                className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shrink-0">
                    {lot.id}
                  </span>
                  <span
                    className={
                      'px-2 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ' +
                      item.badgeTone
                    }
                  >
                    {item.badge}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {lot.hacienda} ({lot.planter})
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 truncate hidden md:inline">
                    — {item.reason}
                  </span>
                </div>

                {/* One-tap actions: Log Brix / Schedule cut / Inspect */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onQuickLogBrix(lot)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px]"
                  >
                    <FlaskConical className="w-3 h-3" />
                    <span>Log Brix</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickScheduleCut(lot)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-[11px]"
                  >
                    <Truck className="w-3 h-3" />
                    <span>Schedule cut</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectLot(lot)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-[11px]"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Inspect</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
