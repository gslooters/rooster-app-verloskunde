'use client';

import React, { useMemo, useState } from 'react';

// Types
type Roster = {
  id: string;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  status: 'draft' | 'final';
  created_at: string;   // ISO
};

// Kleine ID-generator (zonder extra dependency)
function genId() {
  return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Helpers
function toDate(iso: string) { return new Date(iso + 'T00:00:00'); }
function addDaysISO(iso: string, n: number) {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RKEY = 'verloskunde_rosters';

function readRosters(): Roster[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RKEY) || '[]') as Roster[];
  } catch {
    return [];
  }
}
function writeRosters(list: Roster[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RKEY, JSON.stringify(list));
}
function upsertRoster(r: Roster) {
  const list = readRosters().filter(x => x.id !== r.id);
  list.push(r);
  writeRosters(list);
}

export default function Wizard() {
  const todayISO = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const [start, setStart] = useState<string>(todayISO);
  const [weeks, setWeeks] = useState<number>(5);

  function createRoster() {
    const w = Math.max(1, weeks);
    const end = addDaysISO(start, (w * 7) - 1);
    const id = genId();

    const roster: Roster = {
      id,
      start_date: start,
      end_date: end,
      status: 'draft',
      created_at: new Date().toISOString(),
    };

    upsertRoster(roster);
    window.location.href = `/planning/${roster.id}`;
  }

  return (
    <section className="p-4 border rounded bg-white">
      <h2 className="text-lg font-semibold mb-3">Nieuw rooster</h2>
      <div className="flex flex-col gap-3 max-w-md">
        <label className="flex items-center justify-between gap-3">
          <span>Startdatum</span>
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
            min={1}
            max={12}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
        </label>

        <button
          type="button"
          onClick={createRoster}
          className="px-3 py-2 border rounded bg-gray-900 text-white w-fit"
        >
          Creëer rooster
        </button>
      </div>
    </section>
  );
}
