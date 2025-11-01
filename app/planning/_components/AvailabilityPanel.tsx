'use client';
import React, { useMemo, useState } from 'react';
import { toggleAvailability, isAvailable } from '@/lib/planning/availability';

// Hulpfuncties voor weeknummers
function toDate(iso: string) { return new Date(iso + 'T00:00:00'); }
function isoWeekNumber(iso: string) {
  const d = toDate(iso);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const ftDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - ftDay + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

type Employee = { id: string; name: string };

type Props = {
  rosterId: string;
  employees: Employee[];
  days: string[]; // YYYY-MM-DD
  onChanged?: () => void;
};

export default function AvailabilityPanel({ rosterId, employees, days, onChanged }: Props) {
  const [reason, setReason] = useState<string>('');
  const weekGroups = useMemo(() => {
    const res: { week: number; startIndex: number; span: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const w = isoWeekNumber(days[i]);
      let j = i + 1;
      while (j < days.length && isoWeekNumber(days[j]) === w) j++;
      res.push({ week: w, startIndex: i, span: j - i });
      i = j;
    }
    return res;
  }, [days]);

  return (
    <section className="p-3 border rounded bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Beschikbaarheid beheren</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Reden (optioneel)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} className="border rounded px-2 py-1 text-xs" placeholder="bv. vakantie" />
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[900px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="border px-2 py-1 sticky left-0 bg-gray-50" rowSpan={2}>Medewerker</th>
              {weekGroups.map((g) => (
                <th key={`w-${g.week}-${g.startIndex}`} className="border px-2 py-1 text-xs bg-gray-100" colSpan={g.span}>Week {g.week}</th>
              ))}
            </tr>
            <tr>
              {days.map(d => (<th key={d} className="border px-2 py-1 text-xs">{d.slice(8,10)}-{d.slice(5,7)}</th>))}
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id}>
                <td className="border px-2 py-1 sticky left-0 bg-white">{emp.name}</td>
                {days.map(d => {
                  const available = isAvailable(rosterId, emp.id, d);
                  return (
                    <td key={d} className={`border p-1 ${available ? '' : 'unavailable'}`} title={available ? 'beschikbaar' : 'niet beschikbaar'}>
                      <button
                        type="button"
                        className="w-full h-[24px] text-[11px] border rounded px-1 py-[2px] bg-transparent"
                        onClick={() => { toggleAvailability(rosterId, emp.id, d, reason || undefined); onChanged?.(); }}
                        aria-label={available ? 'Maak niet beschikbaar' : 'Maak beschikbaar'}
                        style={{ color: 'transparent' }} // geen tekst tonen
                      >
                        ·
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
