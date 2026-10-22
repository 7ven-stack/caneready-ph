import fs from 'fs';
import path from 'path';

const files = {
  'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
}

@keyframes drawerFadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-drawer-item {
  animation: drawerFadeUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
}
`,

  'src/utils/caneCalculations.js': `export function evaluateLotMetrics(lot) {
  const topBrix = Number(lot.topBrix) || 0;
  const bottomBrix = Number(lot.bottomBrix) || 0;
  const avgBrix = Number(((topBrix + bottomBrix) / 2).toFixed(1));
  const brixDelta = Number((topBrix - bottomBrix).toFixed(1));
  const maturityRatio = bottomBrix > 0
    ? Number((topBrix / bottomBrix).toFixed(2))
    : 0;

  // Sub-scores (0 - 100)
  const ageScore = Math.round(Math.min(100, Math.max(0, ((lot.cropAgeMonths - 6) / 6) * 100)));
  const brixScore = Math.round(Math.min(100, Math.max(0, ((avgBrix - 13) / 8) * 100)));
  const ratioDiff = Math.abs(1.0 - maturityRatio);
  const ratioScore = Math.round(Math.max(0, 100 - ratioDiff * 260));

  const readinessScore = Math.round(brixScore * 0.45 + ratioScore * 0.35 + ageScore * 0.2);

  // Sugar & Mill Yield Estimates
  const estimatedLkgTc = Number(Math.max(0.8, (avgBrix * 0.115 * Math.min(1.05, maturityRatio))).toFixed(2));
  const estimatedTons = Math.round(Number(lot.areaHa) * Number(lot.expectedTcHa || 75));
  const totalSugarBagsLkg = Math.round(estimatedTons * estimatedLkgTc);
  const planterShareBags = Math.round(totalSugarBagsLkg * 0.70);
  const millShareBags = totalSugarBagsLkg - planterShareBags;
  const estimatedTruckLoads = Math.max(1, Math.ceil(estimatedTons / 18));
  const apparentPurity = Number(Math.min(92.5, Math.max(72.0, 74 + (avgBrix - 15) * 2.1 - ratioDiff * 12)).toFixed(1));

  let status = 'Immature';
  let recommendation = 'Continue vegetative growth and monitor foliar nutrition. Schedule first refractometer check at 9.5 months.';
  let harvestWindow = 'In 60–90 Days';

  if (lot.cropAgeMonths > 13.5 || maturityRatio > 1.08) {
    status = 'Over-mature Risk';
    recommendation = 'URGENT: Top Brix exceeds Bottom Brix (Ratio > 1.08), indicating sucrose inversion risk. Issue priority cutting permit immediately.';
    harvestWindow = 'Immediate (Within 3–5 Days)';
  } else if (avgBrix >= 19.5 && maturityRatio >= 0.94 && maturityRatio <= 1.05 && lot.cropAgeMonths >= 10.5) {
    status = 'OK to Harvest';
    recommendation = 'Stalk sucrose concentration is uniform from bottom to top internodes. Optimal maturity reached for peak LKg/TC recovery.';
    harvestWindow = 'Optimal Now (Next 7–14 Days)';
  } else if (avgBrix >= 17.5 && maturityRatio >= 0.85 && lot.cropAgeMonths >= 9.5) {
    status = 'Approaching';
    recommendation = 'Bottom stalk has accumulated high sucrose while top internodes are still ripening. Withhold irrigation and re-sample in 7–10 days.';
    harvestWindow = 'In 10–21 Days';
  }

  return {
    ...lot,
    avgBrix,
    brixDelta,
    maturityRatio,
    brixScore,
    ratioScore,
    ageScore,
    readinessScore,
    estimatedLkgTc,
    estimatedTons,
    totalSugarBagsLkg,
    planterShareBags,
    millShareBags,
    estimatedTruckLoads,
    apparentPurity,
    recommendation,
    harvestWindow,
    status,
  };
}

export function getStatusStyles(status) {
  switch (status) {
    case 'OK to Harvest':
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        bar: 'bg-emerald-600',
        polygonFill: '#10b981',
        polygonStroke: '#047857',
      };
    case 'Approaching':
      return {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        bar: 'bg-amber-500',
        polygonFill: '#f59e0b',
        polygonStroke: '#b45309',
      };
    case 'Over-mature Risk':
      return {
        badge: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-500',
        bar: 'bg-rose-600',
        polygonFill: '#f43f5e',
        polygonStroke: '#be123c',
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
        dot: 'bg-slate-400',
        bar: 'bg-slate-500',
        polygonFill: '#94a3b8',
        polygonStroke: '#475569',
      };
  }
}
`,

  'src/components/LotInspectorDrawer.jsx': `import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FlaskConical,
  Truck,
  FileText,
  Sparkles,
  Scale,
  Sprout,
  Calendar,
  MapPin,
  Droplets,
  CheckCircle2,
  Printer,
  ArrowRight,
  Gauge,
  Layers,
} from 'lucide-react';
import { evaluateLotMetrics, getStatusStyles } from '../utils/caneCalculations';

export default function LotInspectorDrawer({
  lot,
  onClose,
  onUpdateBrix,
  onSaveDispatch,
}) {
  const [renderedLot, setRenderedLot] = useState(lot);
  const [isVisible, setIsVisible] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [savedBanner, setSavedBanner] = useState('');

  const [topBrixInput, setTopBrixInput] = useState('');
  const [bottomBrixInput, setBottomBrixInput] = useState('');

  const [scheduledDate, setScheduledDate] = useState('');
  const [quedanTicket, setQuedanTicket] = useState('');
  const [brigadeLeader, setBrigadeLeader] = useState('');
  const [assignedTrucks, setAssignedTrucks] = useState(4);

  // Smooth mount / unmount animation lifecycle
  useEffect(() => {
    if (lot) {
      setRenderedLot(lot);
      const raf = requestAnimationFrame(() => {
        setIsVisible(true);
        setTimeout(() => setAnimateBars(true), 80);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
      setAnimateBars(false);
      const timer = setTimeout(() => setRenderedLot(null), 300);
      return () => clearTimeout(timer);
    }
  }, [lot]);

  // Sync form inputs when selected lot updates
  useEffect(() => {
    if (lot) {
      setTopBrixInput(String(lot.topBrix));
      setBottomBrixInput(String(lot.bottomBrix));
      setScheduledDate(lot.dispatch ? lot.dispatch.scheduledDate : '2026-10-25');
      setQuedanTicket(
        lot.dispatch
          ? lot.dispatch.quedanTicket
          : 'QDN-2026-' + Math.floor(1000 + Math.random() * 9000)
      );
      setBrigadeLeader(
        lot.dispatch ? lot.dispatch.brigadeLeader : 'Brgy. Guimbala-on Cutting Crew A'
      );
      setAssignedTrucks(
        lot.dispatch ? lot.dispatch.assignedTrucks : Math.max(2, Math.min(8, Math.ceil((lot.areaHa || 10) / 3)))
      );
      setSavedBanner('');
    }
  }, [lot]);

  // Allow closing with ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lot) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lot, onClose]);

  // Live preview of Brix changes inside the Brix Analyzer tab
  const simulatedMetrics = useMemo(() => {
    if (!renderedLot) return null;
    return evaluateLotMetrics({
      ...renderedLot,
      topBrix: parseFloat(topBrixInput) || 0,
      bottomBrix: parseFloat(bottomBrixInput) || 0,
    });
  }, [renderedLot, topBrixInput, bottomBrixInput]);

  if (!renderedLot) return null;

  const styles = getStatusStyles(renderedLot.status);
  const centroid =
    renderedLot.coordinates && renderedLot.coordinates[0]
      ? renderedLot.coordinates[0][0].toFixed(4) + '° N, ' + renderedLot.coordinates[0][1].toFixed(4) + '° E'
      : '10.8185° N, 123.0124° E';

  const handleBrixSubmit = (e) => {
    e.preventDefault();
    onUpdateBrix(renderedLot.id, parseFloat(topBrixInput), parseFloat(bottomBrixInput));
    setSavedBanner('Refractometer Brix sample updated & readiness recalculated.');
    setTimeout(() => setSavedBanner(''), 3500);
  };

  const handleDispatchSubmit = (e) => {
    e.preventDefault();
    onSaveDispatch(renderedLot.id, {
      scheduledDate,
      quedanTicket,
      brigadeLeader,
      assignedTrucks: Number(assignedTrucks),
    });
    setSavedBanner('Harvest Dispatch & Quedan Ticket saved to lot record.');
    setTimeout(() => setSavedBanner(''), 3500);
  };

  const handlePrintPermit = () => {
    window.print();
  };

  return (
    <div
      className={
        'fixed inset-0 z-50 overflow-hidden flex justify-end transition-colors duration-300 ' +
        (isVisible ? 'bg-slate-900/45 backdrop-blur-[2px]' : 'bg-slate-900/0 pointer-events-none')
      }
      onClick={onClose}
    >
      {/* Slide-Over Drawer Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        className={
          'w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between transform transition-all duration-300 ' +
          (isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0')
        }
      >
        {/* Top Colored Status Strip */}
        <div className={'h-1.5 w-full shrink-0 ' + styles.bar} />

        {/* Sticky Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-white shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                {renderedLot.id}
              </span>
              <span
                className={
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ' +
                  styles.badge
                }
              >
                <span className={'w-1.5 h-1.5 rounded-full ' + styles.dot} />
                {renderedLot.status}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                {renderedLot.cropClass}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1.5 truncate">
              {renderedLot.hacienda}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>Planter: <strong className="text-slate-800">{renderedLot.planter}</strong></span>
              <span>•</span>
              <span>{renderedLot.sector}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close Inspector (Esc)"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50/80 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={
              'py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ' +
              (activeTab === 'overview'
                ? 'border-emerald-700 text-emerald-800 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Overview & Yield</span>
          </button>
          <button
            onClick={() => setActiveTab('brix')}
            className={
              'py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ' +
              (activeTab === 'brix'
                ? 'border-emerald-700 text-emerald-800 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Brix Analyzer</span>
          </button>
          <button
            onClick={() => setActiveTab('dispatch')}
            className={
              'py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ' +
              (activeTab === 'dispatch'
                ? 'border-emerald-700 text-emerald-800 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Harvest Dispatch</span>
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {savedBanner && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-drawer-item">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedBanner}</span>
            </div>
          )}

          {/* ================= TAB 1: DETAILED OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div key="overview-tab" className="space-y-4">
              {/* 1. Overall Score + 3-Pillar Weighted Breakdown */}
              <div
                style={{ animationDelay: '0ms' }}
                className="p-4 rounded-xl bg-slate-50/90 border border-slate-200 space-y-3.5 animate-drawer-item"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-emerald-700" />
                      Overall Harvest Readiness Score
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {renderedLot.readinessScore} / 100
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={'h-full rounded-full transition-all duration-700 ease-out ' + styles.bar}
                      style={{ width: (animateBars ? renderedLot.readinessScore : 0) + '%' }}
                    />
                  </div>
                </div>

                {/* 3 Weighted Sub-Pillars */}
                <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80 text-[11px]">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Brix Level</span>
                      <span className="font-bold text-slate-800">{renderedLot.brixScore}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-700"
                        style={{ width: (animateBars ? renderedLot.brixScore : 0) + '%' }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Weight: 45% (Avg {renderedLot.avgBrix}°)</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>T/B Equilibrium</span>
                      <span className="font-bold text-slate-800">{renderedLot.ratioScore}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-teal-600 transition-all duration-700"
                        style={{ width: (animateBars ? renderedLot.ratioScore : 0) + '%' }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Weight: 35% ({renderedLot.maturityRatio} Ratio)</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>Crop Age</span>
                      <span className="font-bold text-slate-800">{renderedLot.ageScore}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-cyan-600 transition-all duration-700"
                        style={{ width: (animateBars ? renderedLot.ageScore : 0) + '%' }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Weight: 20% ({renderedLot.cropAgeMonths} mos)</div>
                  </div>
                </div>
              </div>

              {/* 2. Agronomist Recommendation Callout */}
              <div
                style={{ animationDelay: '60ms' }}
                className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1 animate-drawer-item"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    Agronomist Field Recommendation
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200">
                    Window: {renderedLot.harvestWindow}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed pt-0.5">
                  {renderedLot.recommendation}
                </p>
              </div>

              {/* 3. Core Agronomic Grid (6 Cards) */}
              <div
                style={{ animationDelay: '120ms' }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs animate-drawer-item"
              >
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                    Cane Variety
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">{renderedLot.variety}</p>
                  <span className="text-[10px] text-slate-400">{renderedLot.cropClass} Cycle</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    Planting Date
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">{renderedLot.plantingDate}</p>
                  <span className="text-[10px] text-slate-400">{renderedLot.cropAgeMonths} Months Old</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-sky-600" />
                    Soil Moisture
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">{renderedLot.soilMoisture}</p>
                  <span className="text-[10px] text-slate-400">Sampled {renderedLot.lastSampled}</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Area & Yield Rate
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">
                    {renderedLot.areaHa} ha • {renderedLot.expectedTcHa || 75} TC/ha
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {renderedLot.estimatedTons.toLocaleString()} MT Total Cane
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-500 flex items-center gap-1">
                    <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
                    Brix & Purity
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">
                    {renderedLot.avgBrix}° Bx ({renderedLot.apparentPurity}% Pur)
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Top {renderedLot.topBrix}° / Bot {renderedLot.bottomBrix}°
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" />
                    Parcel Centroid
                  </span>
                  <p className="font-mono font-bold text-[11px] text-slate-900 mt-1 truncate">
                    {centroid}
                  </p>
                  <span className="text-[10px] text-slate-400">{renderedLot.sector}</span>
                </div>
              </div>

              {/* 4. Mill Production & Sugar Quedan Projection */}
              <div
                style={{ animationDelay: '180ms' }}
                className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-3 animate-drawer-item"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Scale className="w-4 h-4" />
                    Mill Sugar Recovery & Quedan Projection
                  </span>
                  <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-emerald-300">
                    {renderedLot.estimatedLkgTc} LKg/TC
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-300">Total 50kg Sugar Bags</div>
                    <div className="text-lg font-extrabold text-white mt-0.5">
                      {renderedLot.totalSugarBagsLkg.toLocaleString()} LKg
                    </div>
                    <div className="text-[10px] text-slate-400">
                      From {renderedLot.estimatedTons.toLocaleString()} MT Cane
                    </div>
                  </div>

                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-300">Planter Quedan (70%)</div>
                    <div className="text-lg font-extrabold text-emerald-400 mt-0.5">
                      {renderedLot.planterShareBags.toLocaleString()} Bags
                    </div>
                    <div className="text-[10px] text-slate-400">Net Planter Allocation</div>
                  </div>

                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-300">Hauling Requirement</div>
                    <div className="text-lg font-extrabold text-amber-300 mt-0.5">
                      ~{renderedLot.estimatedTruckLoads} Trips
                    </div>
                    <div className="text-[10px] text-slate-400">At 18 MT / 10-Wheeler</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: BRIX ANALYZER ================= */}
          {activeTab === 'brix' && (
            <div key="brix-tab" className="space-y-4">
              {/* Visual Cane Stalk Top vs Bottom Profile */}
              <div
                style={{ animationDelay: '0ms' }}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-drawer-item"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    Stalk Sucrose Gradient (Top vs. Bottom Internodes)
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    Δ {renderedLot.brixDelta > 0 ? '+' : ''}{renderedLot.brixDelta}° Bx
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600 font-medium">Top Internodes (Upper 1/3 Stalk)</span>
                      <span className="font-bold text-slate-900">{renderedLot.topBrix}° Brix</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: Math.min(100, (renderedLot.topBrix / 24) * 100) + '%' }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600 font-medium">Bottom Internodes (Basal 1/3 Stalk)</span>
                      <span className="font-bold text-slate-900">{renderedLot.bottomBrix}° Brix</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-emerald-700 rounded-full transition-all duration-500"
                        style={{ width: Math.min(100, (renderedLot.bottomBrix / 24) * 100) + '%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Refractometer Input Form + Live Simulator */}
              <form
                onSubmit={handleBrixSubmit}
                style={{ animationDelay: '80ms' }}
                className="p-4 rounded-xl border border-slate-200 bg-white space-y-4 animate-drawer-item"
              >
                <div className="text-xs font-bold text-slate-800">
                  Log New Hand-Held Refractometer Reading
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Top Stalk Brix (°Bx)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={topBrixInput}
                      onChange={(e) => setTopBrixInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bottom Stalk Brix (°Bx)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={bottomBrixInput}
                      onChange={(e) => setBottomBrixInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Live Simulated Output Box */}
                {simulatedMetrics && (
                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500">New Avg Brix</div>
                      <div className="font-extrabold text-slate-900">{simulatedMetrics.avgBrix}°</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">New Ratio</div>
                      <div className="font-extrabold text-slate-900">{simulatedMetrics.maturityRatio}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Est. Yield</div>
                      <div className="font-extrabold text-emerald-800">{simulatedMetrics.estimatedLkgTc} LKg</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">New Score</div>
                      <div className="font-extrabold text-emerald-800">{simulatedMetrics.readinessScore}/100</div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-xs"
                >
                  Save Refractometer Sample & Update Lot Status
                </button>
              </form>
            </div>
          )}

          {/* ================= TAB 3: HARVEST DISPATCH ================= */}
          {activeTab === 'dispatch' && (
            <div key="dispatch-tab" className="space-y-4">
              <form
                onSubmit={handleDispatchSubmit}
                style={{ animationDelay: '0ms' }}
                className="p-4 rounded-xl border border-slate-200 bg-white space-y-3.5 animate-drawer-item"
              >
                <div className="text-xs font-bold text-slate-800">
                  Schedule Cutting Brigade & Mill Delivery Permit
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Scheduled Harvest Date
                    </label>
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quedan / Delivery Ticket No.
                    </label>
                    <input
                      type="text"
                      required
                      value={quedanTicket}
                      onChange={(e) => setQuedanTicket(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assigned Cutting Brigade
                    </label>
                    <input
                      type="text"
                      required
                      value={brigadeLeader}
                      onChange={(e) => setBrigadeLeader(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assigned Trucks
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      required
                      value={assignedTrucks}
                      onChange={(e) => setAssignedTrucks(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                >
                  Confirm & Issue Harvest Dispatch Order
                </button>
              </form>

              {/* Printable Cutting & Hauling Permit Preview */}
              <div
                style={{ animationDelay: '90ms' }}
                className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 space-y-3 text-xs animate-drawer-item"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Mill District Harvest Authorization
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Permit #{quedanTicket}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintPermit}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Slip</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Lot & Hacienda:</span>{' '}
                    <strong className="text-slate-900">{renderedLot.id} ({renderedLot.hacienda})</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Planter:</span>{' '}
                    <strong className="text-slate-900">{renderedLot.planter}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Target Cut Date:</span>{' '}
                    <strong className="text-slate-900">{scheduledDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Cutting Crew:</span>{' '}
                    <strong className="text-slate-900">{brigadeLeader}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Est. Total Trips:</span>{' '}
                    <strong className="text-slate-900">
                      {renderedLot.estimatedTruckLoads} Loads ({assignedTrucks} Trucks/Day)
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Est. Clear Duration:</span>{' '}
                    <strong className="text-emerald-700">
                      ~{Math.max(1, Math.ceil(renderedLot.estimatedTruckLoads / (Number(assignedTrucks) * 2)))} Days
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Drawer Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-slate-500 truncate">
            {renderedLot.dispatch ? (
              <span>
                Scheduled: <strong className="text-emerald-700">{renderedLot.dispatch.scheduledDate}</strong>
              </span>
            ) : (
              <span>No cutting brigade dispatched yet</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab !== 'dispatch' && (
              <button
                type="button"
                onClick={() => setActiveTab('dispatch')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-colors"
              >
                <span>Schedule Harvest</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Updated: ' + relativePath);
}
