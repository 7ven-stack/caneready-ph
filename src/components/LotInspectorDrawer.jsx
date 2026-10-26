import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  FileText,
  MapPin,
  CheckCircle2,
  Layers,
  Pencil,
  Save,
  Trash2,
  User,
  Compass,
  Phone,
  Building2,
} from 'lucide-react';
import {
  getStatusStyles,
  computeCropAgeMonths,
  buildPolygonFromLatLng,
  PLANTER_ASSOCIATIONS,
} from '../utils/caneCalculations';

export default function LotInspectorDrawer({
  lot,
  onClose,
  onSaveDispatch,
  onUpdateLotDetails,
  onDeleteLot,
  initialEditMode = false,
  initialTab = 'overview',
}) {
  const [renderedLot, setRenderedLot] = useState(lot);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedBanner, setSavedBanner] = useState('');

  const [editForm, setEditForm] = useState({
    planter: '',
    contactNumber: '',
    association: 'APSSI',
    hacienda: '',
    barangay: '',
    city: 'Silay City',
    areaHa: '10',
    plannedHarvestDate: '',
    harvestNotes: '',
    latitude: '10.8185',
    longitude: '123.0145',
    variety: 'Phil 2006-2289',
    cropClass: 'Plant Cane',
  });

  const [scheduledDate, setScheduledDate] = useState('');
  const [harvestNotes, setHarvestNotes] = useState('');

  useEffect(() => {
    if (lot) {
      setRenderedLot(lot);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setRenderedLot(null), 300);
      return () => clearTimeout(timer);
    }
  }, [lot]);

  useEffect(() => {
    if (lot) {
      setEditForm({
        planter: lot.planter || '',
        contactNumber: lot.contactNumber === 'Not provided' ? '' : lot.contactNumber || '',
        association: lot.association || 'APSSI',
        hacienda: lot.hacienda || '',
        barangay: lot.barangay || '',
        city: lot.city || 'Silay City',
        areaHa: String(lot.areaHa ?? 10),
        plannedHarvestDate: lot.plannedHarvestDate || '',
        harvestNotes: lot.harvestNotes || '',
        latitude: String(lot.latitude ?? 10.8185),
        longitude: String(lot.longitude ?? 123.0145),
        variety: lot.variety || 'Phil 2006-2289',
        cropClass: lot.cropClass || 'Plant Cane',
      });
      setIsEditingInfo(Boolean(initialEditMode));
      setActiveTab(initialTab === 'dispatch' ? 'dispatch' : 'overview');
      setConfirmDelete(false);
      setScheduledDate(lot.plannedHarvestDate || '');
      setHarvestNotes(lot.harvestNotes || '');
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

  if (!renderedLot) return null;

  const styles = getStatusStyles(renderedLot.status);

  const handleSaveInfoSubmit = (e) => {
    e.preventDefault();
    const newLat = parseFloat(editForm.latitude) || renderedLot.latitude;
    const newLng = parseFloat(editForm.longitude) || renderedLot.longitude;
    const newArea = Math.max(0.1, parseFloat(editForm.areaHa) || renderedLot.areaHa);

    const latChanged = Math.abs(newLat - renderedLot.latitude) > 0.00001;
    const lngChanged = Math.abs(newLng - renderedLot.longitude) > 0.00001;

    const updatedCoords =
      latChanged || lngChanged
        ? buildPolygonFromLatLng(newLat, newLng, newArea)
        : renderedLot.coordinates;

    const cleanedUpdates = {
      planter: editForm.planter.trim() || renderedLot.planter,
      contactNumber: editForm.contactNumber.trim(),
      association: editForm.association.trim() || 'APSSI',
      hacienda: editForm.hacienda.trim() || renderedLot.hacienda,
      barangay: editForm.barangay.trim() || renderedLot.barangay,
      city: editForm.city.trim() || renderedLot.city,
      sector: `${editForm.city.trim()} - ${editForm.barangay.trim()}`,
      areaHa: newArea,
      plannedHarvestDate: editForm.plannedHarvestDate || null,
      harvestNotes: editForm.harvestNotes.trim(),
      latitude: newLat,
      longitude: newLng,
      coordinates: updatedCoords,
      variety: editForm.variety,
      cropClass: editForm.cropClass,
      plantingDate: renderedLot.plantingDate,
      cropAgeMonths: computeCropAgeMonths(
        renderedLot.plantingDate,
        renderedLot.cropAgeMonths
      ),
    };

    onUpdateLotDetails(renderedLot.id, cleanedUpdates);
    setIsEditingInfo(false);
    setSavedBanner('Planter details, contact, location & harvest schedule saved.');
    setTimeout(() => setSavedBanner(''), 3500);
  };

  const handleHarvestDateSubmit = (e) => {
    e.preventDefault();
    onSaveDispatch(renderedLot.id, {
      scheduledDate: scheduledDate || null,
      notes: harvestNotes.trim(),
      contactNumber: renderedLot.contactNumber,
      association: renderedLot.association,
      barangay: renderedLot.barangay,
      city: renderedLot.city,
    });
    setSavedBanner(
      scheduledDate
        ? `Planned harvest date set to ${scheduledDate}.`
        : 'Planned harvest date cleared.'
    );
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
          'w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between transform transition-all duration-300 ' +
          (isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0')
        }
      >
        <div className={'h-1.5 w-full shrink-0 ' + styles.bar} />

        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                {renderedLot.id}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Building2 className="w-3 h-3" />
                {renderedLot.association}
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
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1.5 truncate">
              {renderedLot.planter}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                {renderedLot.contactNumber}
              </span>
              <span>•</span>
              <span>
                {renderedLot.hacienda}, {renderedLot.barangay}, {renderedLot.city}
              </span>
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
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50')
              }
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{isEditingInfo ? 'Editing Info' : 'Edit Planter'}</span>
            </button>

            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2 Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={
              'py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ' +
              (activeTab === 'overview'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Planter & Location Details</span>
          </button>
          <button
            onClick={() => {
              setIsEditingInfo(false);
              setActiveTab('dispatch');
            }}
            className={
              'py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ' +
              (activeTab === 'dispatch'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Planned Harvest Date</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {savedBanner && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedBanner}</span>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-4">
              {isEditingInfo ? (
                <form
                  onSubmit={handleSaveInfoSubmit}
                  className="p-4 rounded-xl border-2 border-emerald-600/30 bg-emerald-50/20 space-y-3.5 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Pencil className="w-4 h-4 text-emerald-700" />
                      Edit Planter Profile & Location
                    </h3>
                    <span className="font-mono font-bold text-slate-500">
                      {renderedLot.id}
                    </span>
                  </div>

                  {/* Planter Name, Contact Number, Planter's Association */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Planter Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.planter}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, planter: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
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
                        value={editForm.contactNumber}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            contactNumber: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Planter's Association *
                      </label>
                      <select
                        value={editForm.association}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            association: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
                      >
                        {PLANTER_ASSOCIATIONS.map((assoc) => (
                          <option key={assoc} value={assoc}>
                            {assoc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Hacienda, Brgy., City */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Hacienda *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Hda. Santa Maria"
                        value={editForm.hacienda}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, hacienda: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
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
                        value={editForm.barangay}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, barangay: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
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
                        value={editForm.city}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, city: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  {/* Hectarage & Planned Date of Harvest */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Field Hectarage (ha) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        required
                        value={editForm.areaHa}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, areaHa: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Planned Date of Harvest
                      </label>
                      <input
                        type="date"
                        value={editForm.plannedHarvestDate}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            plannedHarvestDate: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  {/* Lat / Long */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Latitude (°N) *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={editForm.latitude}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, latitude: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Longitude (°E) *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={editForm.longitude}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, longitude: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Planter Notes / Remarks
                    </label>
                    <input
                      type="text"
                      placeholder="Optional notes from planter..."
                      value={editForm.harvestNotes}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          harvestNotes: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-rose-700 hover:bg-rose-50 font-semibold"
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
                        className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  {/* Main Highlight Card: Planned Date of Harvest & Hectarage */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        Planned Date of Harvest
                      </span>
                      <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                        {renderedLot.plannedHarvestDate || 'Not set yet'}
                      </p>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {renderedLot.harvestTimelineLabel}
                      </span>
                    </div>

                    <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        Field Hectarage
                      </span>
                      <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                        {renderedLot.areaHa} Hectares
                      </p>
                      <span className="text-xs text-slate-500">
                        ~{renderedLot.estimatedTons.toLocaleString()} MT Est. Cane
                      </span>
                    </div>
                  </div>

                  {/* Detailed Cards (Click any card to edit) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div
                      onClick={() => setIsEditingInfo(true)}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 cursor-pointer"
                    >
                      <span className="text-slate-500 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          Planter & Contact Number
                        </span>
                        <Pencil className="w-3 h-3 text-slate-400" />
                      </span>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {renderedLot.planter}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {renderedLot.contactNumber}
                      </span>
                    </div>

                    <div
                      onClick={() => setIsEditingInfo(true)}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 cursor-pointer"
                    >
                      <span className="text-slate-500 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          Planter's Association
                        </span>
                        <Pencil className="w-3 h-3 text-slate-400" />
                      </span>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {renderedLot.association}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {renderedLot.variety} ({renderedLot.cropClass})
                      </span>
                    </div>

                    <div
                      onClick={() => setIsEditingInfo(true)}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 cursor-pointer"
                    >
                      <span className="text-slate-500 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          Hacienda, Brgy. & City
                        </span>
                        <Pencil className="w-3 h-3 text-slate-400" />
                      </span>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {renderedLot.hacienda}
                      </p>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {renderedLot.barangay}, {renderedLot.city}
                      </span>
                    </div>

                    <div
                      onClick={() => setIsEditingInfo(true)}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 cursor-pointer"
                    >
                      <span className="text-slate-500 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <Compass className="w-3.5 h-3.5 text-rose-500" />
                          Area Coordinates (Lat, Lng)
                        </span>
                        <Pencil className="w-3 h-3 text-slate-400" />
                      </span>
                      <p className="text-sm font-mono font-extrabold text-slate-900 dark:text-white mt-1">
                        {renderedLot.latitude.toFixed(5)}° N, {renderedLot.longitude.toFixed(5)}° E
                      </p>
                      <span className="text-[11px] text-slate-500">
                        GPS Field Centroid
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'dispatch' && (
            <form
              onSubmit={handleHarvestDateSubmit}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-xs"
            >
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Set Planter's Planned Harvest Date
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Record when <strong>{renderedLot.planter}</strong> ({renderedLot.association}) plans to harvest{' '}
                  <strong>{renderedLot.hacienda}</strong> ({renderedLot.barangay}, {renderedLot.city}).
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Planned Date of Harvest *
                </label>
                <input
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Planter Notes / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Planter requested morning hauling..."
                  value={harvestNotes}
                  onChange={(e) => setHarvestNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {renderedLot.plannedHarvestDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setScheduledDate('');
                      setHarvestNotes('');
                      onSaveDispatch(renderedLot.id, {
                        scheduledDate: null,
                        notes: '',
                        contactNumber: renderedLot.contactNumber,
                        association: renderedLot.association,
                        barangay: renderedLot.barangay,
                        city: renderedLot.city,
                      });
                      setSavedBanner('Planned harvest date cleared.');
                    }}
                    className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold"
                  >
                    Clear Date
                  </button>
                )}

                <button
                  type="submit"
                  className="ml-auto px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs"
                >
                  Save Planned Harvest Date
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-slate-500 truncate">
            {renderedLot.plannedHarvestDate ? (
              <span>
                Planned Harvest:{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {renderedLot.plannedHarvestDate}
                </strong>
              </span>
            ) : (
              <span>No harvest date set by planter yet</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


