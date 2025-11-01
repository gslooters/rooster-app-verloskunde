'use client';
import { useState } from 'react';
import { ensureMondayYYYYMMDD, addDaysYYYYMMDD, displayDate } from '@/lib/planning/dates';
import { upsertRoster } from '@/lib/planning/storage';

const DEFAULT_START = '2025-11-24';

export default function Wizard() {
  const [step, setStep] = useState(1);
  const [start, setStart] = useState(DEFAULT_START);
  const [error, setError] = useState<string|null>(null);

  function next() {
    try {
      setError(null);
      if (step === 1) ensureMondayYYYYMMDD(start);
      setStep(s => s + 1);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function createRoster() {
    const end = addDaysYYYYMMDD(start, 34); // 35 dagen inclusief startdag
    const roster = {
      id: crypto.randomUUID(),
      start_date: start,
      end_date: end,
      status: 'draft',
      created_at: new Date().toISOString(),
    };
    upsertRoster(roster);
    window.location.href = `/planning/${roster.id}`;
  }

  return (
    <main className="p-6 max-w-3xl">
      <nav className="text-sm text-gray-500 mb-4">Dashboard &gt; Rooster Planning &gt; Nieuw</nav>
      <h1 className="text-2xl font-semibold mb-4">Nieuw 5-weken rooster</h1>

      {step === 1 && (
        <section className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">Startdatum (maandag)</span>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1 border rounded px-3 py-2" />
          </label>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <p className="text-sm text-gray-600">Periode: {displayDate(start)} t/m {displayDate(addDaysYYYYMMDD(start, 34))}</p>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 className="font-medium mb-2">Medewerkers & targets</h2>
          <p className="text-sm text-gray-600">Gebruik standaard targets; later koppelen aan employees tabel.</p>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="font-medium mb-2">Bevestiging</h2>
          <p className="text-sm">Start: {displayDate(start)} – Einde: {displayDate(addDaysYYYYMMDD(start, 34))}</p>
        </section>
      )}

      <div className="mt-6 flex gap-3">
        {step > 1 && <button className="px-4 py-2 border rounded" onClick={() => setStep(s => s - 1)}>Terug</button>}
        {step < 3 && <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={next}>Volgende</button>}
        {step === 3 && <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={createRoster}>Creëer rooster</button>}
      </div>
    </main>
  );
}
