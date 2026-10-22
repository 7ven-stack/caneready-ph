import React from 'react';
import { Pencil } from 'lucide-react';
import { getStatusStyles } from '../utils/caneCalculations';

export default function PlanterTableView({ lots, onSelectLot, onEditLot }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-4">Lot ID & Hacienda</th>
              <th className="py-3.5 px-4">Planter</th>
              <th className="py-3.5 px-4">Variety</th>
              <th className="py-3.5 px-4">Area / Est. Tons</th>
              <th className="py-3.5 px-4">Age</th>
              <th className="py-3.5 px-4">Avg Brix (T/B)</th>
              <th className="py-3.5 px-4">Ratio</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {lots.map((lot) => {
              const styles = getStatusStyles(lot.status);
              return (
                <tr
                  key={lot.id}
                  onClick={() => onSelectLot(lot)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-bold text-slate-900">{lot.id}</div>
                    <div className="text-slate-600 font-medium">{lot.hacienda}</div>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    {lot.planter}
                    <div className="text-[11px] font-normal text-slate-400">{lot.sector}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    <div className="font-medium">{lot.variety}</div>
                    <div className="text-[11px] text-slate-400">{lot.cropClass}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{lot.areaHa} ha</div>
                    <div className="text-[11px] text-slate-500">{lot.estimatedTons.toLocaleString()} MT</div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    {lot.cropAgeMonths} mos
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900">{lot.avgBrix}°</span>
                    <span className="text-slate-400 ml-1">
                      ({lot.topBrix}/{lot.bottomBrix})
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                    {lot.maturityRatio}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ' + styles.badge}
                    >
                      <span className={'w-1.5 h-1.5 rounded-full ' + styles.dot} />
                      {lot.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditLot) onEditLot(lot);
                          else onSelectLot(lot);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                      >
                        <Pencil className="w-3 h-3 text-emerald-700" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLot(lot);
                        }}
                        className="text-emerald-700 hover:text-emerald-900 font-bold"
                      >
                        Inspect
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
