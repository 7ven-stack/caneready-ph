import React, { useState, useEffect, useMemo } from 'react';
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
  XCircle,
  Printer,
  ArrowRight,
  Gauge,
  Layers,
  Pencil,
  Save,
  Trash2,
  User,
  AlertCircle,
  Clock,
} from 'lucide-react';
import {
  evaluateLotMetrics,
  getStatusStyles,
  computeCropAgeMonths,
} from '../utils/caneCalculations';

export default function LotInspectorDrawer({
  lot,
  onClose,
  onUpdateBrix,
  onSaveDispatch,
  onUpdateLotDetails,
  onDeleteLot,
  initialEditMode = false,
  initialTab = 'overview',
}) {
  const [renderedLot, setRenderedLot] = useState(lot);
  const [isVisible, setIsVisible] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedBanner, setSavedBanner] = useState('');

  const [editForm, setEditForm] = useState({
    hacienda: '',
    planter: '',
    sector: 'Sector A - North',
    variety: 'Phil 2006-2289',
    cropClass: 'Plant Cane',
    areaHa: '10',
    expectedTcHa: '75',
    plantingDate: '',
    soilMoisture: '',
  });

  const [topBrixInput, setTopBrixInput] = useState('');
  const [bottomBrixInput, setBottomBrixInput] = useState('');

  const [scheduledDate, setScheduledDate] = useState('');
  const [quedanTicket, setQuedanTicket] = useState('');
  const [brigadeLeader, setBrigadeLeader] = useState('');
  const [assignedTrucks, setAssignedTrucks] = useState(4);

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

  useEffect(() => {
    if (lot) {
      setEditForm({
        hacienda: lot.hacienda || '',
        planter: lot.planter || '',
        sector: lot.sector || 'Sector A - North',
        variety: lot.variety || 'Phil 2006-2289',
        cropClass: lot.cropClass || 'Plant Cane',
        areaHa: String(lot.areaHa ?? 10),
        expectedTcHa: String(lot.expectedTcHa ?? 75),
        plantingDate: lot.plantingDate || '',
        soilMoisture: lot.soilMoisture || '',
      });
      setIsEditingInfo(Boolean(initialEditMode));
      setActiveTab(initialTab || 'overview');
      setConfirmDelete(false);
      setTopBrixInput(
        lot.topBrix !== null && lot.topBrix !== undefined ? String(lot.topBrix) : ''
      );
      setBottomBrixInput(
        lot.bottomBrix !== null && lot.bottomBrix !== undefined
          ? String(lot.bottomBrix)
          : ''
      );
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
        lot.dispatch
          ? lot.dispatch.assignedTrucks
          : Math.max(2, Math.min(8, Math.ceil((lot.areaHa || 10) / 3)))
      );
      setSavedBanner('');
    }
  }, [lot, initialEditMode, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lot) {
        if (isEditingInfo) setIsEditingInfo(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lot, isEditingInfo, onClose]);

  const simulatedMetrics = useMemo(() => {
    if (!renderedLot) return null;
    if (topBrixInput.trim() === '' || bottomBrixInput.trim() === '') return null;
    return evaluateLotMetrics({
      ...renderedLot,
      topBrix: parseFloat(topBrixInput),
      bottomBrix: parseFloat(bottomBrixInput),
    });
  }, [renderedLot, topBrixInput, bottomBrixInput]);

  if (!renderedLot) return null;

  const styles = getStatusStyles(renderedLot.status);
  const bd = renderedLot.breakdown;
  const centroid =
    renderedLot.coordinates && renderedLot.coordinates[0]
      ? renderedLot.coordinates[0][0].toFixed(4) +
        '° N, ' +
        renderedLot.coordinates[0][1].toFixed(4) +
        '° E'
      : '10.8185° N, 123.0124° E';

  const handleSaveInfoSubmit = (e) => {
    e.preventDefault();
    const derivedAge = computeCropAgeMonths(
      editForm.plantingDate,
      renderedLot.cropAgeMonths
    );
    const cleanedUpdates = {
      hacienda: editForm.hacienda.trim() || renderedLot.hacienda,
      planter: editForm.planter.trim() || renderedLot.planter,
      sector: editForm.sector,
      variety: editForm.variety,
      cropClass: editForm.cropClass,
      areaHa: Math.max(0.1, parseFloat(editForm.areaHa) || renderedLot.areaHa),
      expectedTcHa: Math.max(10, parseFloat(editForm.expectedTcHa) || 75),
      plantingDate: editForm.plantingDate,
      cropAgeMonths: derivedAge,
      soilMoisture: editForm.soilMoisture.trim() || null,
    };
    onUpdateLotDetails(renderedLot.id, cleanedUpdates);
    setIsEditingInfo(false);
    setSavedBanner('Planter & Farm Lot details updated and synced to database.');
    setTimeout(() => setSavedBanner(''), 3500);
  };

  const handleBrixSubmit = (e) => {
    e.preventDefault();
    onUpdateBrix(
      renderedLot.id,
      parseFloat(topBrixInput),
      parseFloat(bottomBrixInput)
    );
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

  return (
    <div
      className={
        'fixed inset-0 z-[1000] overflow-hidden flex justify-end transition-colors duration-300 ' +
        (isVisible
          ? 'bg-slate-900/45 backdrop-blur-[2px]'
          : 'bg-slate-900/0 pointer-events-none')
      }
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        className={
          'w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between transform transition-all duration-300 ' +
          (isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0')
        }
      >
        <div className={'h-1.5 w-full shrink-0 ' + styles.bar} />

        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-white shrink-0">
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
                {renderedLot.statusDisplay || renderedLot.status}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                {renderedLot.cropClass}
              </span>
              {renderedLot.isUnverifiedDefault && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                  <AlertCircle className="w-3 h-3" />
                  unverified (form default)
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1.5 truncate">
              {renderedLot.hacienda}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                Planter:{' '}
                <strong className="text-slate-800">{renderedLot.planter}</strong>
              </span>
              <span>•</span>
              <span>{renderedLot.sector}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview');
                setIsEditingInfo((prev) => !prev);
              }}
              className={
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ' +
                (isEditingInfo
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50')
              }
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{isEditingInfo ? 'Editing Info' : 'Edit Planter'}</span>
            </button>

            <button
              onClick={onClose}
              title="Close Inspector (Esc)"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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
            <span>Overview & Gates</span>
          </button>
          <button
            onClick={() => {
              setIsEditingInfo(false);
              setActiveTab('brix');
            }}
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
            onClick={() => {
              setIsEditingInfo(false);
              setActiveTab('dispatch');
            }}
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {savedBanner && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-drawer-item">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedBanner}</span>
            </div>
          )}

          {activeTab === 'overview' && (
            <div key="overview-tab" className="space-y-4">
              {isEditingInfo && (
                <form
                  onSubmit={handleSaveInfoSubmit}
                  className="p-4 rounded-xl border-2 border-emerald-600/30 bg-emerald-50/20 space-y-4 animate-drawer-item text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <Pencil className="w-4 h-4 text-emerald-700" />
                        Edit Planter & Sugarcane Lot Profile
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Crop age is automatically derived from the planting / last cut date.
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-500">
                      {renderedLot.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Planter Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.planter}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            planter: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Hacienda / Farm Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.hacienda}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            hacienda: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Mill District Sector
                      </label>
                      <select
                        value={editForm.sector}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            sector: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-300 bg-white"
                      >
                        <option>Sector A - North</option>
                        <option>Sector B - Central</option>
                        <option>Sector C - Upland</option>
                        <option>Sector D - Mill District</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Cane Variety
                      </label>
                      <select
                        value={editForm.variety}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            variety: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-300 bg-white"
                      >
                        <option>Phil 2006-2289</option>
                        <option>VMC 84-524</option>
                        <option>Phil 99-1793</option>
                        <option>Phil 8013</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Crop Class
                      </label>
                      <select
                        value={editForm.cropClass}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            cropClass: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-300 bg-white"
                      >
                        <option>Plant Cane</option>
                        <option>Ratoon 1</option>
                        <option>Ratoon 2</option>
                        <option>Ratoon 3</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Area (Hectares)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        required
                        value={editForm.areaHa}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            areaHa: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Expected TC/Ha (Default: 75)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="20"
                        required
                        value={editForm.expectedTcHa}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            expectedTcHa: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {editForm.cropClass.startsWith('Ratoon')
                          ? 'Last Cut Date'
                          : 'Planting Date'}
                      </label>
                      <input
                        type="date"
                        required
                        value={editForm.plantingDate}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            plantingDate: e.target.value,
                          }))
                        }
                        className="w-full px-2 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-rose-700 hover:bg-rose-50 font-semibold transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Lot</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteLot(renderedLot.id);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 font-semibold"
                        >
                          Keep
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingInfo(false)}
                        className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Planter Info</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* 2c. "Why this status?" Gate Checklist + 2d. Estimated Ready Date */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 animate-drawer-item">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-extrabold text-slate-900">
                    Why this status? ({renderedLot.statusDisplay || renderedLot.status})
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <Clock className="w-3.5 h-3.5" />
                    Est. Ready: {renderedLot.estimatedReady?.label}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {renderedLot.gateChecklist?.map((gate) => (
                    <div
                      key={gate.key}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        {gate.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-800">
                          {gate.summary}
                        </span>
                      </div>
                      <span
                        className={
                          'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ' +
                          (gate.passed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800')
                        }
                      >
                        {gate.passed ? 'Pass' : 'Unmet'}
                      </span>
                    </div>
                  ))}
                </div>

                {renderedLot.estimatedReady?.reason && (
                  <p className="text-[11px] text-slate-500 pt-1">
                    {renderedLot.estimatedReady.reason}
                  </p>
                )}
              </div>

              {/* 2c. Readiness index & breakdown object */}
              <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200 space-y-3.5 animate-drawer-item">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-emerald-700" />
                      Readiness index
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {renderedLot.hasBrixSample
                        ? `${renderedLot.readinessScore}% (${renderedLot.readinessScore} / 100)`
                        : 'No sample yet'}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                    {renderedLot.hasBrixSample && (
                      <div
                        className={
                          'h-full rounded-full transition-all duration-700 ease-out ' +
                          styles.bar
                        }
                        style={{
                          width:
                            (animateBars ? renderedLot.readinessScore : 0) + '%',
                        }}
                      />
                    )}
                  </div>
                </div>

                {bd && (
                  <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80 text-[11px]">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                      <div className="flex justify-between text-slate-500 font-medium">
                        <span>Brix ({bd.brix.weight}%)</span>
                        <span className="font-bold text-slate-800">
                          {bd.brix.score !== null ? `${bd.brix.score}%` : '—'}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                        {bd.brix.weighted !== null
                          ? `+${bd.brix.weighted} pts (${bd.brix.label})`
                          : bd.brix.label}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                      <div className="flex justify-between text-slate-500 font-medium">
                        <span>Ratio ({bd.ratio.weight}%)</span>
                        <span className="font-bold text-slate-800">
                          {bd.ratio.score !== null ? `${bd.ratio.score}%` : '—'}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                        {bd.ratio.weighted !== null
                          ? `+${bd.ratio.weighted} pts (${bd.ratio.label})`
                          : bd.ratio.label}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                      <div className="flex justify-between text-slate-500 font-medium">
                        <span>Age ({bd.age.weight}%)</span>
                        <span className="font-bold text-slate-800">
                          {bd.age.score}%
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                        +{bd.age.weighted} pts ({bd.age.label})
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Agronomist Recommendation Callout */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1 animate-drawer-item">
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

              {/* Core Agronomic Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs animate-drawer-item">
                <div
                  onClick={() => setIsEditingInfo(true)}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500/60 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1">
                      <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                      Cane Variety
                    </span>
                    <Pencil className="w-3 h-3 text-slate-300" />
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">
                    {renderedLot.variety}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {renderedLot.cropClass} Cycle
                  </span>
                </div>

                <div
                  onClick={() => setIsEditingInfo(true)}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500/60 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      {renderedLot.cropClass?.startsWith('Ratoon')
                        ? 'Last Cut Date'
                        : 'Planting Date'}
                    </span>
                    <Pencil className="w-3 h-3 text-slate-300" />
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">
                    {renderedLot.plantingDate || 'Not recorded'}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Derived: {renderedLot.cropAgeMonths} Months Old
                  </span>
                </div>

                <div
                  onClick={() => setIsEditingInfo(true)}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500/60 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-sky-600" />
                      Soil Moisture
                    </span>
                    <Pencil className="w-3 h-3 text-slate-300" />
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">
                    {renderedLot.soilMoisture || 'Not recorded'}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {renderedLot.lastSampled
                      ? `Sampled ${renderedLot.lastSampled}`
                      : 'No sample yet'}
                  </span>
                </div>

                <div
                  onClick={() => setIsEditingInfo(true)}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500/60 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Area & Yield Rate
                    </span>
                    <Pencil className="w-3 h-3 text-slate-300" />
                  </span>
                  <p className="font-extrabold text-slate-900 mt-1">
                    {renderedLot.areaHa} ha • {renderedLot.expectedTcHa || 75} TC/ha
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {renderedLot.estimatedTons.toLocaleString()} MT Total Cane
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('brix')}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500/60 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1">
                      <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
                      Brix & Purity
                    </span>
                    <Pencil className="w-3 h-3 text-slate-300" />
                  </span>
                  {renderedLot.hasBrixSample ? (
                    <>
                      <p className="font-extrabold text-slate-900 mt-1">
                        {renderedLot.avgBrix}° Bx ({renderedLot.apparentPurity}% Pur)
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Top {renderedLot.topBrix}° / Bot {renderedLot.bottomBrix}°
                      </span>
                    </>
                  ) : (
                    <>
                      <p className="font-extrabold text-amber-700 mt-1">
                        No sample yet
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Click to log 1st sample
                      </span>
                    </>
                  )}
                </div>

                <div
                  onClick={() => setIsEditingInfo(true)}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500/60 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-600" />
                      Parcel Centroid
                    </span>
                    <Pencil className="w-3 h-3 text-slate-300" />
                  </span>
                  <p className="font-mono font-bold text-[11px] text-slate-900 mt-1 truncate">
                    {centroid}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {renderedLot.sector}
                  </span>
                </div>
              </div>

              {/* Mill Production & Sugar Quedan Projection */}
              <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-3 animate-drawer-item">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Scale className="w-4 h-4" />
                    Mill Sugar Recovery & Quedan Projection
                  </span>
                  <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-emerald-300">
                    {renderedLot.hasBrixSample
                      ? `${renderedLot.estimatedLkgTc} LKg/TC`
                      : 'Needs Brix Sample'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-300">
                      Total 50kg Sugar Bags
                    </div>
                    <div className="text-lg font-extrabold text-white mt-0.5">
                      {renderedLot.hasBrixSample
                        ? `${renderedLot.totalSugarBagsLkg.toLocaleString()} LKg`
                        : '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      From {renderedLot.estimatedTons.toLocaleString()} MT Cane
                    </div>
                  </div>

                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-300">
                      Planter Quedan (70%)
                    </div>
                    <div className="text-lg font-extrabold text-emerald-400 mt-0.5">
                      {renderedLot.hasBrixSample
                        ? `${renderedLot.planterShareBags.toLocaleString()} Bags`
                        : '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Net Planter Allocation
                    </div>
                  </div>

                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-300">
                      Hauling Requirement
                    </div>
                    <div className="text-lg font-extrabold text-amber-300 mt-0.5">
                      ~{renderedLot.estimatedTruckLoads} Trips
                    </div>
                    <div className="text-[10px] text-slate-400">
                      At 18 MT / 10-Wheeler
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'brix' && (
            <div key="brix-tab" className="space-y-4">
              {renderedLot.hasBrixSample ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-drawer-item">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Stalk Sucrose Gradient (Top vs. Bottom Internodes)
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      Δ {renderedLot.brixDelta > 0 ? '+' : ''}
                      {renderedLot.brixDelta}° Bx
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-600 font-medium">
                          Top Internodes (Upper 1/3 Stalk)
                        </span>
                        <span className="font-bold text-slate-900">
                          {renderedLot.topBrix}° Brix
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{
                            width:
                              Math.min(100, (renderedLot.topBrix / 24) * 100) +
                              '%',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-600 font-medium">
                          Bottom Internodes (Basal 1/3 Stalk)
                        </span>
                        <span className="font-bold text-slate-900">
                          {renderedLot.bottomBrix}° Brix
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-emerald-700 rounded-full transition-all duration-500"
                          style={{
                            width:
                              Math.min(100, (renderedLot.bottomBrix / 24) * 100) +
                              '%',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold">
                  No refractometer sample has been recorded for {renderedLot.id}{' '}
                  yet. Enter the first Top and Bottom stalk Brix readings below.
                </div>
              )}

              <form
                onSubmit={handleBrixSubmit}
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
                      inputMode="decimal"
                      step="0.1"
                      min="1"
                      max="32"
                      required
                      placeholder="e.g. 20.2"
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
                      inputMode="decimal"
                      step="0.1"
                      min="1"
                      max="32"
                      required
                      placeholder="e.g. 20.6"
                      value={bottomBrixInput}
                      onChange={(e) => setBottomBrixInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {simulatedMetrics && simulatedMetrics.hasBrixSample && (
                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500">New Avg Brix</div>
                      <div className="font-extrabold text-slate-900">
                        {simulatedMetrics.avgBrix}°
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">New Ratio</div>
                      <div className="font-extrabold text-slate-900">
                        {simulatedMetrics.maturityRatio}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Est. Yield</div>
                      <div className="font-extrabold text-emerald-800">
                        {simulatedMetrics.estimatedLkgTc} LKg
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">
                        Readiness index
                      </div>
                      <div className="font-extrabold text-emerald-800">
                        {simulatedMetrics.readinessScore}%
                      </div>
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

          {activeTab === 'dispatch' && (
            <div key="dispatch-tab" className="space-y-4">
              <form
                onSubmit={handleDispatchSubmit}
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

              <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 space-y-3 text-xs animate-drawer-item">
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
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Slip</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Lot & Hacienda:</span>{' '}
                    <strong className="text-slate-900">
                      {renderedLot.id} ({renderedLot.hacienda})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Planter:</span>{' '}
                    <strong className="text-slate-900">
                      {renderedLot.planter}
                    </strong>
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
                      {renderedLot.estimatedTruckLoads} Loads ({assignedTrucks}{' '}
                      Trucks/Day)
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Est. Clear Duration:</span>{' '}
                    <strong className="text-emerald-700">
                      ~
                      {Math.max(
                        1,
                        Math.ceil(
                          renderedLot.estimatedTruckLoads /
                            (Number(assignedTrucks) * 2)
                        )
                      )}{' '}
                      Days
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-slate-500 truncate">
            {renderedLot.dispatch ? (
              <span>
                Scheduled:{' '}
                <strong className="text-emerald-700">
                  {renderedLot.dispatch.scheduledDate}
                </strong>
              </span>
            ) : (
              <span>No cutting brigade dispatched yet</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab !== 'dispatch' && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingInfo(false);
                  setActiveTab('dispatch');
                }}
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
