import React, { useState, useEffect } from 'react';
import { X, MapPin } from 'lucide-react';

export function QuickBrixModal({ isOpen, onClose, lots, onUpdateBrix }) {
  const [selectedLotId, setSelectedLotId] = useState(lots[0] ? lots[0].id : '');
  const [topBrix, setTopBrix] = useState('20.2');
  const [bottomBrix, setBottomBrix] = useState('20.6');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedLotId) return;
    onUpdateBrix(selectedLotId, parseFloat(topBrix), parseFloat(bottomBrix));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-900">
            Log Field Refractometer Sample
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Farm Lot
            </label>
            <select
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} — {l.hacienda} ({l.planter})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Top Stalk Brix (°Bx)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={topBrix}
                onChange={(e) => setTopBrix(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bottom Stalk Brix (°Bx)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={bottomBrix}
                onChange={(e) => setBottomBrix(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium"
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
      </div>
    </div>
  );
}

export function RegisterLotModal({
  isOpen,
  onClose,
  onAddLot,
  initialCoordinates,
  initialAreaHa,
}) {
  const [hacienda, setHacienda] = useState('');
  const [planter, setPlanter] = useState('');
  const [sector, setSector] = useState('Sector A - North');
  const [variety, setVariety] = useState('Phil 2006-2289');
  const [cropClass, setCropClass] = useState('Plant Cane');
  const [areaHa, setAreaHa] = useState('10.5');
  const [cropAgeMonths, setCropAgeMonths] = useState('11.8');
  const [topBrix, setTopBrix] = useState('20.0');
  const [bottomBrix, setBottomBrix] = useState('20.5');

  useEffect(() => {
    if (initialAreaHa) {
      setAreaHa(String(initialAreaHa));
    }
  }, [initialAreaHa]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddLot({
      id: 'LOT-' + Math.floor(100 + Math.random() * 899),
      hacienda,
      planter,
      sector,
      variety,
      cropClass,
      areaHa: parseFloat(areaHa),
      expectedTcHa: 75,
      plantingDate: '2025-10-25',
      cropAgeMonths: parseFloat(cropAgeMonths),
      topBrix: parseFloat(topBrix),
      bottomBrix: parseFloat(bottomBrix),
      soilMoisture: 'Optimal (18%)',
      lastSampled: new Date().toISOString().split('T')[0],
      coordinates: initialCoordinates || null,
      dispatch: null,
    });
    setHacienda('');
    setPlanter('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Register New Sugarcane Lot
            </h3>
            {initialCoordinates && initialCoordinates.length >= 3 && (
              <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                Attached Drawn Polygon ({initialCoordinates.length} vertices • {initialAreaHa} ha)
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hacienda / Farm Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Hda. Sta. Teresa"
                value={hacienda}
                onChange={(e) => setHacienda(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Planter Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rafael Lacson"
                value={planter}
                onChange={(e) => setPlanter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sector
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option>Sector A - North</option>
                <option>Sector B - Central</option>
                <option>Sector C - Upland</option>
                <option>Sector D - Mill District</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Cane Variety
              </label>
              <select
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option>Phil 2006-2289</option>
                <option>VMC 84-524</option>
                <option>Phil 99-1793</option>
                <option>Phil 8013</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Crop Class
              </label>
              <select
                value={cropClass}
                onChange={(e) => setCropClass(e.target.value)}
                className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option>Plant Cane</option>
                <option>Ratoon 1</option>
                <option>Ratoon 2</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Area (ha)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Age (mos)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={cropAgeMonths}
                onChange={(e) => setCropAgeMonths(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Top Brix
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={topBrix}
                onChange={(e) => setTopBrix(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bot. Brix
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={bottomBrix}
                onChange={(e) => setBottomBrix(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
            >
              Register Lot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
