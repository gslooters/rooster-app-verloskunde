'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability } from '@/lib/planning/rosterDesign';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';

export default function DesignPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = searchParams.get('rosterId');
  
  const [designData, setDesignData] = useState<RosterDesignData | null>(null);
  const [employees, setEmployees] = useState<RosterEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rosterId) {
      setError('Geen roster ID gevonden');
      setLoading(false);
      return;
    }

    try {
      const data = loadRosterDesignData(rosterId);
      if (data) {
        setDesignData(data);
        setEmployees(data.employees);
      } else {
        setError('Geen roster ontwerp data gevonden');
      }
    } catch (err) {
      console.error('Error loading design data:', err);
      setError('Fout bij laden van ontwerp data');
    }
    setLoading(false);
  }, [rosterId]);

  function updateMaxShiftsHandler(empId: string, maxShifts: number) {
    if (!rosterId || !designData) return;
    updateEmployeeMaxShifts(rosterId, empId, maxShifts);
    const updated = loadRosterDesignData(rosterId);
    if (updated) { setDesignData(updated); setEmployees(updated.employees); }
  }

  function toggleUnavailable(empId: string, date: string) {
    if (!rosterId || !designData) return;
    toggleUnavailability(rosterId, empId, date);
    const updated = loadRosterDesignData(rosterId);
    if (updated) { setDesignData(updated); setEmployees(updated.employees); }
  }

  function goToEditing() {
    if (!rosterId) return;
    router.push(`/planning/${rosterId}`);
  }

  // Extract first name only
  function getFirstName(fullName: string): string {
    return fullName.split(' ')[0];
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ontwerp wordt geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !designData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2>
          <p className="text-red-600 mb-4">{error || 'Onbekende fout'}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => router.push('/planning')} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">Terug naar overzicht</button>
            <button onClick={() => router.push('/planning/new')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Nieuw rooster starten</button>
          </div>
        </div>
      </div>
    );
  }

  // Bepaal startdatum: in de RosterDesignData hebben we rosterId en geen geneste roster.
  const startISO = (designData as any).start_date || (designData as any).roster_start || new Date().toISOString().split('T')[0];
  const startDate = new Date(startISO + 'T00:00:00');

  const weeks = Array.from({ length: 5 }, (_, i) => {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + (i * 7));
    const weekNumber = getWeekNumber(weekStart);
    return { number: weekNumber, dates: Array.from({ length: 7 }, (_, d) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + d);
      return date.toISOString().split('T')[0];
    })};
  });

  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const day = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'][date.getDay()];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${day} ${dd}-${mm}`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        <nav className="text-sm text-gray-500 mb-3">
          Dashboard &gt; Rooster Planning &gt; Rooster Ontwerp
        </nav>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Rooster Ontwerp
            </h1>
            <p className="text-gray-600">
              Periode: 5 weken vanaf {startISO}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              🎨 Ontwerpfase
            </div>
            <button 
              onClick={goToEditing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Ga naar Bewerking →
            </button>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-blue-800">
            <strong>Instructies:</strong> Stel voor elke medewerker het maximum aantal diensten in (0-35) en markeer niet-beschikbare dagen met de NB-knoppen.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white border-b px-3 py-2 text-left font-semibold text-gray-900 w-32">
                  Medewerker
                </th>
                <th className="border-b px-3 py-2 text-center font-semibold text-gray-900 w-24">
                  Max Diensten
                </th>
                {weeks.map(week => (
                  <th key={week.number} colSpan={7} className="border-b px-2 py-2 text-center font-semibold text-gray-900 bg-gray-50">
                    Week {week.number}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 bg-white border-b"></th>
                <th className="border-b"></th>
                {weeks.map(week => 
                  week.dates.map(date => (
                    <th key={date} className="border-b px-1 py-1 text-xs text-gray-600 bg-gray-50 min-w-[50px]">
                      {formatDate(date)}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, empIndex) => (
                <tr key={emp.id} className={`${empIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} h-8`}>
                  <td className="sticky left-0 bg-inherit border-b px-3 py-1 font-medium text-gray-900 h-8">
                    {getFirstName(emp.name)}
                  </td>
                  <td className="border-b px-3 py-1 text-center h-8">
                    <input
                      type="number"
                      min="0"
                      max="35"
                      value={emp.maxShifts}
                      onChange={(e) => updateMaxShiftsHandler(emp.id, parseInt(e.target.value) || 0)}
                      className="w-16 px-1 py-0.5 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  {weeks.map(week =>
                    week.dates.map(date => {
                      const isUnavailable = designData.unavailabilityData?.[emp.id]?.[date] || false;
                      return (
                        <td key={date} className="border-b p-0.5 text-center h-8">
                          <button
                            onClick={() => toggleUnavailable(emp.id, date)}
                            className={`w-10 h-6 rounded text-xs font-bold transition-colors ${
                              isUnavailable 
                                ? 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200' 
                                : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'
                            }`}
                            title={isUnavailable ? 'Klik om beschikbaar te maken' : 'Klik om niet-beschikbaar te markeren'}
                          >
                            {isUnavailable ? 'NB' : '—'}
                          </button>
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button 
            onClick={() => router.push('/planning')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            ← Terug naar Dashboard
          </button>
          
          <div className="text-sm text-gray-600">
            Wijzigingen worden automatisch opgeslagen
          </div>
          
          <button 
            onClick={goToEditing}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Gereed - Ga naar Bewerking →
          </button>
        </div>
      </div>
    </div>
  );
}