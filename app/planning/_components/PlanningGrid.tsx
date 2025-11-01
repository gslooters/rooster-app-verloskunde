'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addDaysYYYYMMDD, displayDate } from '@/lib/planning/dates';
import { getRosters } from '@/lib/planning/storage';
import '@/styles/planning.css';

type Roster = {
  id: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'final';
  created_at: string;
};

const EMPLOYEES = [
  { id: 'emp1', name: 'Anna de Vries' },
  { id: 'emp2', name: 'Bram Peters' },
  { id: 'emp3', name: 'Carla Jansen' },
  { id: 'emp4', name: 'Daan Bakker' },
  { id: 'emp5', name: 'Eva Smit' },
  { id: 'emp6', name: 'Frank Visser' },
  { id: 'emp7', name: 'Greta Mulder' },
  { id: 'emp8', name: 'Hans de Groot' },
];

const SERVICES = [
  { code: 's', label: 'Shift (24u)', color: '#8B5CF6' },
  { code: 'd', label: 'Dag', color: '#3B82F6' },
  { code: 'sp', label: 'Spreekuur', color: '#059669' },
  { code: 'echo', label: 'Echoscopie', color: '#EA580C' },
  { code: 'vrij', label: 'Vrij', color: '#FEF3C7' },
  { code: '-', label: '—', color: '#FFFFFF' },
];

type Cell = { service: string | null; locked: boolean; unavailable?: boolean };

export default function PlanningGrid({ rosterId }: { rosterId: string }) {
  const rosters = getRosters() as Roster[];
  const roster = rosters.find(r => r.id === rosterId);

  if (!roster) {
    return <div className="p-6 text-red-600">Rooster niet gevonden.</div>;
  }

  const start = roster.start_date;
  const days = useMemo<string[]>(
    () => Array.from({ length: 35 }, (_, i) => addDaysYYYYMMDD(start, i)),
    [start]
  );

  const [cells, setCells] = useState<Record<string, Record<string, Cell>>>({});

  useEffect(() => {
    const init: Record<string, Record<string, Cell>> = {};
    days.forEach(d => {
      init[d] = {};
      EMPLOYEES.forEach(e => { init[d][e.id] = { service: null, locked: false }; });
    });
    setCells(init);
  }, [days]);

  function setService(date: string, empId: string, service: string) {
    setCells(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [empId]: { ...prev[date][empId], service }
      }
    }));
  }

  function toggleLock(date: string, empId: string) {
    setCells(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [empId]: { ...prev[date][empId], locked: !prev[date][empId].locked }
      }
    }));
  }

  return (
    <main className="p-4">
      <nav className="text-sm text-gray-500 mb-3">Dashboard &gt; Rooster Planning &gt; Rooster</nav>
      <h1 className="text-xl font-semibold mb-3">
        Periode: {displayDate(start)} t/m {displayDate(days[days.length - 1])}
      </h1>

      <div className="overflow-auto max-h-[80vh] border rounded">
        <table className="min-w-[1200px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-gray-50 border px-3 py-2">Medewerker</th>
              {days.map((d, idx) => (
                <th key={d} className="sticky top-0 z-20 bg-gray-50 border px-3 py-2 text-xs">
                  Week {Math.floor(idx / 7) + 1}<br />{displayDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EMPLOYEES.map(emp => (
              <tr key={emp.id}>
                <td className="sticky left-0 z-10 bg-white border px-3 py-2 font-medium">{emp.name}</td>
                {days.map(d => {
                  const cell = cells[d]?.[emp.id];
                  const code = cell?.service ?? '';
                  const color = SERVICES.find(s => s.code === code)?.color;
                  const style = code === 'vrij'
                    ? { backgroundColor: '#FEF3C7' }
                    : code ? { backgroundColor: color } : {};
                  return (
                    <td key={d} className="border p-1">
                      <div className="flex items-center gap-1">
                        <select
                          value={code}
                          onChange={(e) => setService(d, emp.id, e.target.value)}
                          className="text-xs border rounded px-1 py-1"
                          style={style as React.CSSProperties}
                        >
                          <option value="">—</option>
                          {SERVICES.map(s => (
                            <option key={s.code} value={s.code}>{s.code}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title="Lock"
                          onClick={() => toggleLock(d, emp.id)}
                          className={`text-xs px-1 rounded border ${cell?.locked ? 'bg-gray-800 text-white' : 'bg-white'}`}
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
    </main>
  );
}
