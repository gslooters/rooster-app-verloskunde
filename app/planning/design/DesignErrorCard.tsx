'use client';

import { useState } from 'react';

export default function DesignErrorCard({ message }: { message: string }) {
  const [navigating, setNavigating] = useState(false);

  function toNewRoster() {
    setNavigating(true);
    window.location.href = '/planning/new?reason=no-roster';
  }

  function toOverview() {
    setNavigating(true);
    window.location.href = '/planning/design';
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
      <h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2>
      <p className="text-red-600 mb-4">{message}</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={toOverview} disabled={navigating} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-60">Terug naar overzicht</button>
        <button onClick={toNewRoster} disabled={navigating} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">Nieuw rooster starten</button>
      </div>
    </div>
  );
}
