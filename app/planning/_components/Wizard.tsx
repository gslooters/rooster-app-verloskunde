'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { computeDefaultStart, validateStartMonday, computeEnd, readRosters, writeRosters, type Roster } from '@/lib/planning/storage';
import { getActiveEmployees, type Employee } from '@/lib/planning/employees';

function genId() { return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

export default function Wizard() {
  const defaultStart = useMemo(() => computeDefaultStart(), []);
  const [start, setStart] = useState<string>(defaultStart);
  const [weeks, setWeeks] = useState<number>(5);

  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveEmployees(getActiveEmployees());
  }, []);

  function openConfirm() {
    const isValidMonday = validateStartMonday(start);
    if (!isValidMonday) { 
      setError('Startdatum moet een maandag zijn'); 
      return; 
    }
    setError(null);
    setShowConfirm(true);
  }

  function createRosterConfirmed() {
    const id = genId();
    const end = computeEnd(start); // Remove second parameter - function only takes one
    const roster: Roster = {
      id,
      start_date: start,
      end_date: end,
      status: 'draft',
      created_at: new Date().toISOString(),
    };
    const list = readRosters().filter(x => x.id !== roster.id);
    list.push(roster);
    writeRosters(list);
    window.location.href = `/planning/${roster.id}`;
  }

  return (
    <section className="p-4 border rounded bg-white">
      <h2 className="text-lg font-semibold mb-3">Nieuw rooster</h2>

      {error && <p className="text-red-600 mb-2">{error}</p>}

      <div className="flex flex-col gap-3 max-w-md">
        <label className="flex items-center justify-between gap-3">
          <span>Startdatum (moet maandag zijn)</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span>Aantal weken</span>
          <input
            type="number"
            min={5}
            max={12}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
        </label>

        <button
          type="button"
          onClick={openConfirm}
          className="px-3 py-2 border rounded bg-gray-900 text-white w-fit"
        >
          Creëer rooster
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl p-4 w-[520px] max-w-[90vw]">
            <h3 className="text-md font-semibold mb-2">Bevestig actieve medewerkers</h3>
            <p className="text-sm text-gray-600 mb-2">
              Dit rooster wordt aangemaakt voor alle medewerkers die nu op <span className="font-medium">actief</span> staan. Controleer en bevestig om door te gaan.
            </p>
            <div className="max-h-[220px] overflow-auto border rounded mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1">Naam</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map(emp => (
                    <tr key={emp.id} className="border-t">
                      <td className="px-2 py-1">{emp.name}</td>
                      <td className="px-2 py-1">{emp.active ? 'actief' : 'inactief'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-2 border rounded bg-white"
              >
                Annuleer
              </button>
              <button
                onClick={createRosterConfirmed}
                className="px-3 py-2 border rounded bg-blue-600 text-white"
              >
                Bevestig en maak rooster
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}