import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, AlertCircle, Calendar, Info } from 'lucide-react';
import { generateSequentialLotId } from '../services/lotService';
import { computeCropAgeMonths, READINESS_CONFIG } from '../utils/caneCalculations';

export function QuickBrixModal({ isOpen, onClose, lots, onUpdateBrix }) {
  const [selectedLotId, setSelectedLotId] = useState(lots[0] ? lots[0].id : '');
  const [topBrix, setTopBrix] = useState('');
  const [bottomBrix, setBottomBrix] = useState('');

  useEffect(() => {
    if (isOpen && lots.length > 0 && !lots.some((l) => l.id === selectedLotId)) {
      setSelectedLotId(lots[0].id);
    }
  }, [isOpen, lots, selectedLotId]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedLotId) return;
    onUpdateBrix(selectedLotId, parseFloat(topBrix), parseFloat(bottomBrix));
    setTopBrix('');
    setBottomBrix('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Log Field Refractometer Sample
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {lots.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No farm lots registered yet. Register a lot first before logging Brix samples.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Farm Lot
              </label>
              <select
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.id} — {l.hacienda} ({l.planter}){!l.hasBrixSample ? ' [No sample yet]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Top Stalk Brix (°Bx)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="32"
                  required
                  placeholder="e.g. 20.2"
                  value={topBrix}
                  onChange={(e) => setTopBrix(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bottom Stalk Brix (°Bx)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="32"
                  required
                  placeholder="e.g. 20.6"
                  value={bottomBrix}
                  onChange={(e) => setBottomBrix(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
              >
                Save Sample
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// 1a. RegisterLotModal: No invented defaults. Brix optional & starts empty ("No sample yet"),
// Planting / Last Cut Date required, Crop Age derived from date, expectedTcHa editable (default 75 labeled),
// Soil Moisture optional, lastSampled stays null unless Brix is entered.
export function RegisterLotModal({
  isOpen,
  onClose,
  onAddLot,
  existingLots = [],
  initialCoordinates,
  initialAreaHa,
}) {
  const defaultTcHa = READINESS_CONFIG.yield.defaultTcHa;

  const [sector, setSector] = useState('Sector A - North');
  const [lotId, setLotId] = useState('');
  const [hacienda, setHacienda] = useState('');
  const [planter, setPlanter] = useState('');
  const [variety, setVariety] = useState('Phil 2006-2289');
  const [cropClass, setCropClass] = useState('Plant Cane');
  const [plantingDate, setPlantingDate] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [expectedTcHa, setExpectedTcHa] = useState(String(defaultTcHa));
  const [soilMoisture, setSoilMoisture] = useState('');
  const [topBrix, setTopBrix] = useState('');
  const [bottomBrix, setBottomBrix] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRatoon = cropClass.toLowerCase().startsWith('ratoon');

  const derivedAgeMonths = useMemo(() => {
    if (!plantingDate) return null;
    return computeCropAgeMonths(plantingDate, null);
  }, [plantingDate]);

  useEffect(() => {
    if (isOpen) {
      setLotId(generateSequentialLotId(existingLots, sector));
      setFormError('');
    }
  }, [isOpen, sector, existingLots]);

  useEffect(() => {
    if (isOpen) {
      setAreaHa(initialAreaHa ? String(initialAreaHa) : '');
    }
  }, [isOpen, initialAreaHa]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const normalizedId = lotId.trim().toUpperCase();

    if (!normalizedId) {
      setFormError('Lot ID is required.');
      return;
    }

    if (existingLots.some((l) => String(l.id).toUpperCase() === normalizedId)) {
      setFormError(
        `Lot ID "${normalizedId}" already exists. Suggested next ID: ${generateSequentialLotId(existingLots, sector)}`
      );
      return;
    }

    if (!plantingDate) {
      setFormError(
        isRatoon
          ? 'Last harvest cut date is required to derive ratoon crop age.'
          : 'Planting date is required to derive crop age.'
      );
      return;
    }

    const hasTop = topBrix.trim() !== '';
    const hasBottom = bottomBrix.trim() !== '';

    if (hasTop !== hasBottom) {
      setFormError(
        'Please enter both Top and Bottom Brix readings, or leave both blank for "No sample yet".'
      );
      return;
    }

    const parsedTop = hasTop ? parseFloat(topBrix) : null;
    const parsedBottom = hasBottom ? parseFloat(bottomBrix) : null;
    const todayIso = new Date().toISOString().split('T')[0];

    setIsSubmitting(true);
    const result = await onAddLot({
      id: normalizedId,
      hacienda: hacienda.trim(),
      planter: planter.trim(),
      sector,
      variety,
      cropClass,
      areaHa: parseFloat(areaHa),
      expectedTcHa: parseFloat(expectedTcHa) || defaultTcHa,
      plantingDate,
      cropAgeMonths: derivedAgeMonths ?? 0,
      topBrix: parsedTop,
      bottomBrix: parsedBottom,
      soilMoisture: soilMoisture.trim() ? soilMoisture.trim() : null,
      lastSampled: hasTop && hasBottom ? todayIso : null,
      sampleVerified: Boolean(hasTop && hasBottom),
      coordinates: initialCoordinates || null,
      dispatch: null,
    });
    setIsSubmitting(false);

    if (result && result.code === '23505') {
      setFormError(result.error);
      return;
    }

    setHacienda('');
    setPlanter('');
    setPlantingDate('');
    setAreaHa('');
    setExpectedTcHa(String(defaultTcHa));
    setSoilMoisture('');
    setTopBrix('');
    setBottomBrix('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Register New Sugarcane Lot
            </h3>
            {initialCoordinates && initialCoordinates.length >= 3 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                Attached Drawn Polygon ({initialCoordinates.length} vertices • {initialAreaHa} ha)
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Crop age is derived from planting/cut date. Brix is optional until first field sample.
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Row 1: Lot ID, Hacienda, Planter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lot ID (Sequential) *
              </label>
              <input
                type="text"
                required
                value={lotId}
                onChange={(e) => setLotId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hacienda / Farm Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Hda. Sta. Teresa"
                value={hacienda}
                onChange={(e) => setHacienda(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Planter Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rafael Lacson"
                value={planter}
                onChange={(e) => setPlanter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Row 2: Sector, Variety, Crop Class */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mill Sector *
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option>Sector A - North</option>
                <option>Sector B - Central</option>
                <option>Sector C - Upland</option>
                <option>Sector D - Mill District</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cane Variety *
              </label>
              <select
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option>Phil 2006-2289</option>
                <option>VMC 84-524</option>
                <option>Phil 99-1793</option>
                <option>Phil 8013</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Crop Class *
              </label>
              <select
                value={cropClass}
                onChange={(e) => setCropClass(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option>Plant Cane</option>
                <option>Ratoon 1</option>
                <option>Ratoon 2</option>
                <option>Ratoon 3</option>
              </select>
            </div>
          </div>

          {/* Row 3: Planting / Last Cut Date (Required) + Derived Age + Area + Expected TC/Ha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRatoon ? 'Last Cut Date (Ratoon) *' : 'Planting Date *'}
              </label>
              <input
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={plantingDate}
                onChange={(e) => setPlantingDate(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>{isRatoon ? 'Counts from last cut' : 'Counts from planting'}</span>
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {derivedAgeMonths !== null ? `${derivedAgeMonths} mos` : 'Select date'}
                </strong>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lot Area (ha) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                placeholder="e.g. 12.5"
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expected TC/ha <span className="font-normal text-slate-400">(Default: {defaultTcHa})</span>
              </label>
              <input
                type="number"
                step="1"
                min="20"
                max="160"
                required
                value={expectedTcHa}
                onChange={(e) => setExpectedTcHa(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Row 4: Optional Brix Readings & Optional Soil Moisture */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                Optional Field Measurements
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Leave Brix blank if not sampled yet ("No sample yet")
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Top Stalk Brix (°Bx)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="32"
                  placeholder="No sample yet"
                  value={topBrix}
                  onChange={(e) => setTopBrix(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Bottom Stalk Brix (°Bx)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="32"
                  placeholder="No sample yet"
                  value={bottomBrix}
                  onChange={(e) => setBottomBrix(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Soil Moisture (Optional)
                </label>
                <select
                  value={soilMoisture}
                  onChange={(e) => setSoilMoisture(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">Not recorded</option>
                  <option value="Optimal (18%)">Optimal (18%)</option>
                  <option value="Optimal (19%)">Optimal (19%)</option>
                  <option value="Moderate (22%)">Moderate (22%)</option>
                  <option value="Dry (14%)">Dry (14%)</option>
                  <option value="High (26%)">High (26%)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Register Lot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
