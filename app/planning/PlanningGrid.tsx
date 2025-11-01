'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getRosters, isDutchHoliday, isAvailable } from './libAliases';
import AvailabilityPopup from './_components/AvailabilityPopup';
import '@/styles/planning.css';

function toDate(iso: string) { return new Date(iso + 'T00:00:00'); }
function addDaysISO(iso: string, n: number) {
  const d = toDate(iso); d.setDate(d.getDate() + n);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function formatPeriodDDMM(isoStart: string, daysCount=35){
  const d0 = toDate(isoStart), de = toDate(addDaysISO(isoStart, daysCount-1));
  const f = (d: Date) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  return `${f(d0)} t/m ${f(de)}`;
}
function formatDDMM(iso:string){ const d=toDate(iso); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function isoWeekNumber(iso:string){ const d=toDate(iso); const target=new Date(d.valueOf()); const dayNr=(d.getDay()+6)%7; target.setDate(target.getDate()-dayNr+3);
  const firstThursday=new Date(target.getFullYear(),0,4); const ftDay=(firstThursday.getDay()+6)%7; firstThursday.setDate(firstThursday.getDate()-ftDay+3);
  return 1+Math.round((target.getTime()-firstThursday.getTime())/(7*24*3600*1000));}
function dayShort(iso:string){ const map=['ZO','MA','DI','WO','DO','VR','ZA'] as const; return map[toDate(iso).getDay()]; }
function isWeekend(iso:string){ const s=dayShort(iso); return s==='ZA'||s==='ZO'; }

type Roster = { id: string; start_date: string; end_date: string; status: 'draft'|'final'; created_at: string; };
type Cell = { service: string | null; locked: boolean; unavailable?: boolean };

const EMPLOYEES = [
  { id: 'emp1', name: 'Anna' },
  { id: 'emp2', name: 'Bram' },
  { id: 'emp3', name: 'Carla' },
  { id: 'emp4', name: 'Daan' },
  { id: 'emp5', name: 'Eva' },
  { id: 'emp6', name: 'Frank' },
  { id: 'emp7', name: 'Greta' },
  { id: 'emp8', name: 'Hans' },
];

const SERVICES = [
  { code: 's', label: 'Shift (24u)', color: '#8B5CF6' },
  { code: 'd', label: 'Dag', color: '#3B82F6' },
  { code: 'sp', label: 'Spreekuur', color: '#059669' },
  { code: 'echo', label: 'Echoscopie', color: '#EA580C' },
  { code: 'vrij', label: 'Vrij', color: '#FEF3C7' },
  { code: '-', label: '—', color: '#FFFFFF' },
];

export default function PlanningGrid({ rosterId }: { rosterId: string }) {
  const rosters = getRosters() as Roster[];
  const roster = rosters.find(r => r.id === rosterId);
  if (!roster) return <div className="p-6 text-red-600">Rooster niet gevonden.</div>;

  const start = roster.start_date;
  const isDraft = roster.status === 'draft';
  const days = useMemo<string[]>(() => Array.from({ length: 35 }, (_, i) => addDaysISO(start, i)), [start]);

  const weekGroups = useMemo(() => {
    const groups: { week: number; startIndex: number; span: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const w = isoWeekNumber(days[i]);
      let j = i + 1; while (j < days.length && isoWeekNumber(days[j]) === w) j++;
      groups.push({ week: w, startIndex: i, span: j - i }); i = j;
    }
    return groups;
  }, [days]);

  const [cells, setCells] = useState<Record<string, Record<string, Cell>>>({});
  const [popupFor, setPopupFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const init: Record<string, Record<string, Cell>> = {};
    days.forEach(d => { init[d] = {}; EMPLOYEES.forEach(e => { init[d][e.id] = { service: null, locked: false }; }); });
    setCells(init);
  }, [days]);

  function setService(date: string, empId: string, service: string) {
    setCells(prev => ({ ...prev, [date]: { ...prev[date], [empId]: { ...prev[date][empId], service } } }));
  }
  function toggleLock(date: string, empId: string) {
    setCells(prev => ({ ...prev, [date]: { ...prev[date], [empId]: { ...prev[date][empId], locked: !prev[date][empId].locked } } }));
  }

  return (
    <main className="p-4">
      <nav className="text-sm text-gray-500 mb-3">Dashboard &gt; Rooster Planning &gt; Rooster</nav>
      <h1 className="text-xl font-semibold mb-3">Periode: {formatPeriodDDMM(start)}</h1>

      <div className="overflow-auto max-h-[80vh] border rounded">
        <table className="min-w-[1200px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-gray-50 border px-2 py-1 align-top w-[120px]" rowSpan={2}>Medewerker</th>
              {weekGroups.map(g => (
                <th key={`w-${g.week}-${g.startIndex}`} className="sticky top-0 z-20 bg-gray-100 border px-2 py-1 text-[11px] text-gray-800" colSpan={g.span}>
                  Week {g.week}
                </th>
              ))}
            </tr>
            <tr>
              {days.map(d => {
                const short = dayShort(d);
                const weekend = isWeekend(d);
                const holiday = isDutchHoliday(d);
                const colorClass = holiday ? 'text-red-700 font-semibold' : weekend ? 'text-red-600' : 'text-gray-800';
                return (
                  <th key={`d-${d}`} className="sticky top-8 z-20 bg-gray-50 border px-1.5 py-1 text-[11px]">
                    <div className={`flex flex-col items-start ${colorClass}`}>
                      <span className="uppercase leading-3">{short}</span>
                      <span className="leading-3">{formatDDMM(d)}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {EMPLOYEES.map(emp => (
              <tr key={emp.id}>
                <td className="sticky left-0 z-10 bg-white border px-2 py-1 font-medium w-[120px]">
                  <button
                    className={`text-left ${isDraft ? 'underline decoration-dotted' : ''}`}
                    onClick={() => isDraft && setPopupFor(emp)}
                    title={isDraft ? 'Klik om beschikbaarheid te bewerken' : 'Alleen-lezen'}
                  >
                    {emp.name}
                  </button>
                </td>
                {days.map(d => {
                  const available = isAvailable(roster.id, emp.id, d);
                  const cell = cells[d]?.[emp.id];
                  const code = cell?.service ?? '';
                  const svc = SERVICES.find(s => s.code === code);
                  const bg = code === 'vrij' ? '#FEF3C7' : svc?.color ?? undefined;
                  const locked = !!cell?.locked;

                  return (
                    <td key={d} className={`border p-[2px] ${available ? '' : 'unavailable'}`} title={available ? '' : 'Niet beschikbaar'}>
                      <div className="flex items-center gap-[4px]">
                        <select
                          value={code}
                          onChange={(e) => setService(d, emp.id, e.target.value)}
                          className="text-[11px] border rounded px-1 py-[1px] h-[20px] min-w-[34px]"
                          style={bg ? ({ backgroundColor: bg } as React.CSSProperties) : undefined}
                          disabled={!available || !isDraft || locked}
                        >
                          <option value="">—</option>
                          {SERVICES.map(s => (<option key={s.code} value={s.code}>{s.code}</option>))}
                        </select>

                        <button
                          type="button"
                          title={locked ? 'Ontgrendel' : 'Vergrendel'}
                          onClick={() => isDraft && available && toggleLock(d, emp.id)}
                          className={`text-[10px] leading-none w-[20px] h-[20px] rounded border flex items-center justify-center ${locked ? 'bg-gray-800 text-white' : 'bg-white'}`}
                          disabled={!isDraft || !available}
                        >
                          🔒
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {popupFor && isDraft && (
        <AvailabilityPopup
          rosterId={roster.id}
          employee={popupFor}
          startDate={start}
          onClose={() => setPopupFor(null)}
          onSaved={() => {}}
        />
      )}
    </main>
  );
}
