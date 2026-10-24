import React, { useState, useEffect } from 'react';
import { X, MapPin, AlertCircle, Calendar, Compass } from 'lucide-react';
import { generateSequentialLotId } from '../services/lotService';
import {
  computeCropAgeMonths,
  buildPolygonFromLatLng,
  PLANTER_ASSOCIATIONS,
} from '../utils/caneCalculations';

export function SetHarvestDateModal({
  isOpen,
  onClose,
  lot,
  onSaveDispatch,
}) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && lot) {
      setScheduledDate(lot.plannedHarvestDate || '');
      setNotes(lot.harvestNotes || '');
    }
  }, [isOpen, lot]);

  if (!isOpen || !lot) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveDispatch(lot.id, {
      scheduledDate: scheduledDate || null,
      notes: notes.trim(),
      contactNumber: lot.contactNumber,
      association: lot.association,
      barangay: lot.barangay,
      city: lot.city,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Set Planter Harvest Date
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lot.id} — <strong>{lot.planter}</strong> ({lot.hacienda}, {lot.barangay}, {lot.city})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Planned Date of Harvest (Based on Planter) *
            </label>
            <input
              type="date"
              required
              autoFocus
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Planter Remarks / Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Planter confirmed cutting schedule"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
            />
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
              Save Harvest Date
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RegisterLotModal({
  isOpen,
  onClose,
  onAddLot,
  existingLots = [],
  initialCoordinates,
  initialAreaHa,
  initialLatitude,
  initialLongitude,
}) {
  const [lotId, setLotId] = useState('');
  const [planter, setPlanter] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [association, setAssociation] = useState('APSSI');
  const [hacienda, setHacienda] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('Silay City');
  const [areaHa, setAreaHa] = useState('');
  const [plannedHarvestDate, setPlannedHarvestDate] = useState('');
  const [harvestNotes, setHarvestNotes] = useState('');
  const [latitude, setLatitude] = useState('10.8185');
  const [longitude, setLongitude] = useState('123.0145');
  const [variety, setVariety] = useState('Phil 2006-2289');
  const [cropClass, setCropClass] = useState('Plant Cane');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLotId(generateSequentialLotId(existingLots, city));
      setFormError('');
      setAreaHa(initialAreaHa ? String(initialAreaHa) : '');
      setLatitude(initialLatitude ? String(initialLatitude) : '10.8185');
      setLongitude(initialLongitude ? String(initialLongitude) : '123.0145');
    }
  }, [isOpen, city, existingLots, initialAreaHa, initialLatitude, initialLongitude]);

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
        `Lot ID "${normalizedId}" already exists. Suggested next ID: ${generateSequentialLotId(existingLots, city)}`
      );
      return;
    }

    const parsedArea = parseFloat(areaHa);
    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setFormError('Please enter valid Latitude and Longitude coordinates.');
      return;
    }

    const finalCoordinates =
      initialCoordinates && initialCoordinates.length >= 3
        ? initialCoordinates
        : buildPolygonFromLatLng(parsedLat, parsedLng, parsedArea || 10);

    setIsSubmitting(true);
    const result = await onAddLot({
      id: normalizedId,
      planter: planter.trim(),
      contactNumber: contactNumber.trim(),
      association: association.trim() || 'APSSI',
      hacienda: hacienda.trim(),
      barangay: barangay.trim(),
      city: city.trim(),
      sector: `${city.trim()} - ${barangay.trim()}`,
      variety,
      cropClass,
      areaHa: parsedArea,
      expectedTcHa: 75,
      plantingDate: new Date().toISOString().split('T')[0],
      cropAgeMonths: computeCropAgeMonths(new Date().toISOString().split('T')[0], 0),
      plannedHarvestDate: plannedHarvestDate || null,
      harvestNotes: harvestNotes.trim(),
      latitude: parsedLat,
      longitude: parsedLng,
      coordinates: finalCoordinates,
      dispatch: {
        scheduledDate: plannedHarvestDate || null,
        notes: harvestNotes.trim(),
        contactNumber: contactNumber.trim(),
        association: association.trim() || 'APSSI',
        barangay: barangay.trim(),
        city: city.trim(),
      },
    });
    setIsSubmitting(false);

    if (result && result.code === '23505') {
      setFormError(result.error);
      return;
    }

    setPlanter('');
    setContactNumber('');
    setHacienda('');
    setBarangay('');
    setAreaHa('');
    setPlannedHarvestDate('');
    setHarvestNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Register Planter Sugarcane Lot
            </h3>
            {initialCoordinates && initialCoordinates.length >= 3 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                Polygon Drawn ({initialAreaHa} ha • {initialLatitude}°N, {initialLongitude}°E)
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Enter planter details, contact number, association, location, hectarage & harvest date
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Row 1: Planter Name, Contact Number, Planter's Association */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Planter Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Roberto Villanueva"
                value={planter}
                onChange={(e) => setPlanter(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contact Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 0917-552-8410"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Planter's Association *
              </label>
              <select
                value={association}
                onChange={(e) => setAssociation(e.target.value)}
                className="w-full px-2.5 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {PLANTER_ASSOCIATIONS.map((assoc) => (
                  <option key={assoc} value={assoc}>
                    {assoc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Hacienda, Brgy., City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Hacienda *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Hda. Santa Maria"
                value={hacienda}
                onChange={(e) => setHacienda(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Barangay (Brgy.) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Brgy. Guimbala-on"
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                City / Municipality *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Silay City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Row 3: Field Hectarage, Planned Date of Harvest, Lot ID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Field Hectarage (ha) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                placeholder="e.g. 14.5"
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Planned Date of Harvest
              </label>
              <input
                type="date"
                value={plannedHarvestDate}
                onChange={(e) => setPlannedHarvestDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Lot ID *
              </label>
              <input
                type="text"
                required
                value={lotId}
                onChange={(e) => setLotId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Row 4: Longitude & Latitude of Field */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-rose-500" />
              <span>Area Coordinates (Latitude & Longitude)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Latitude (°N) *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Longitude (°E) *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Planter Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Planter target schedule remarks..."
              value={harvestNotes}
              onChange={(e) => setHarvestNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
            />
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
              {isSubmitting ? 'Saving...' : 'Register Planter Lot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

