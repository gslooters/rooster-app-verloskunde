'use client';
import React, { useMemo, useState } from 'react';
import { toggleAvailability, isAvailable } from '@/lib/planning/availability';

function toDate(iso: string) { return new Date(iso + 'T00:00:00'); }
function addDaysISO(iso: string, n: number) { const d = toDate(iso); d.setDate(d.getDate()+n); const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function isoWeekNumber(iso: string) { const d=toDate(iso); const target=new Date(d.valueOf()); const dayNr=(d.getDay()+6)%7; target.setDate(target.getDate()-dayNr+3); const firstThursday=new Date(target.getFullYear(),0,4); const ftDay=(firstThursday.getDay()+6)%7; firstThursday.setDate(firstThursday.getDate()-ftDay+3); return 1+Math.round((target.getTime()-firstThursday.getTime())/(7*24*3600*1000)); }
function dowShort(iso: string) { const map=['Zo','Ma','Di','Wo','Do','Vr','Za'] as const; return map[toDate(iso).getDay()]; }

type Props = {
  rosterId: string;
  employee: { id: string; name: string };
  startDate: string; // roster start
  onClose: () => void;
  onSaved: () => void;
};

export default function AvailabilityPopup({ rosterId, employee, startDate, onClose, onSaved }: Props) {
  // 35 dagen raster
  const days = useMemo<string[]>(() => Array.from({ length: 35 }, (_, i) => addDaysISO(startDate, i)), [startDate]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const weeks = useMemo(() => {
    const res: { week: number; startIndex: number; span: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const w = isoWeekNumber(days[i]);
      let j = i + 1; while (j < days.length && isoWeekNumber(days[j]) === w) j++;
      res.push({ week: w, startIndex: i, span: j - i }); i = j;
    }
    return res;
  }, [days]);

  function toggle(iso: string) {
    setSelected(prev => {
      const cp = new Set(prev);
      if (cp.has(iso)) cp.delete(iso); else cp.add(iso);
      return cp;
    });
  }

  function save() {
    // markeer geselecteerde als niet-beschikbaar
    Array.from(selected).forEach(d => {
      const cur = isAvailable(rosterId, employee.id, d);
      if (cur) toggleAvailability(rosterId, employee.id, d, 'batch');
    });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
      <div className="bg-white rounded shadow-lg w-[900px] max-w-[95vw]">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">Beschikbaarheid – {employee.name}</h3>
          <button className="px-2 py-1 border rounded" onClick={onClose}>Sluiten</button>
        </div>
        <div className="p-3">
          <div className="overflow-auto">
            <table className="min-w-[850px] border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr>
                  <th className="border px-2 py-1 sticky left-0 bg-gray-50" rowSpan={2}>Week</th>
                  <th className="border px-2 py-1" colSpan={7}>Dagen</th>
                </tr>
                <tr>
                  {['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d => <th key={d} className="border px-2 py-1 text-xs">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {weeks.map((w, idx) => (
                  <tr key={idx}>
                    <td className="border px-2 py-1 sticky left-0 bg-white text-center font-medium">{w.week}</td>
                    {Array.from({ length: 7 }, (_, k) => {
                      const i = w.startIndex + k;
                      const iso = days[i];
                      if (!iso) return <td key={k} className="border px-2 py-1" />;
                      const dayNr = toDate(iso).getDate();
                      const selectedCls = selected.has(iso) ? 'bg-red-100 border-red-400' : '';
                      return (
                        <td key={iso} className={`border px-2 py-2 text-center cursor-pointer ${selectedCls}`} onClick={() => toggle(iso)} title={iso}>
                          <span className="text-sm">{dayNr}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="px-3 py-1.5 border rounded" onClick={() => setSelected(new Set())}>Reset selectie</button>
            <button className="px-3 py-1.5 border rounded bg-red-600 text-white" onClick={save}>Opslaan (niet beschikbaar)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
