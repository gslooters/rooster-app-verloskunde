'use client';
import { useEffect, useState } from 'react';
import { getRosterPeriodStaffing, RosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';
import { getFallbackHolidays } from '@/lib/data/dutch-holidays-fallback';
import { WeekHeader } from './WeekHeader';
import { ServiceRow } from './ServiceRow';

interface Props {
  rosterId: string;
  startDate: string;
  endDate: string;
}

export function PeriodStaffingGrid({ rosterId, startDate, endDate }: Props) {
  const [staffing, setStaffing] = useState<RosterPeriodStaffing[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initializationStatus, setInitializationStatus] = useState<string>('Data voorbereiden...');

  // Genereer dagen array
  const days: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0]);
  }

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        if (!isMounted) return;
        
        setLoading(true);
        setError(null);
        setInitializationStatus('Feestdagen ophalen...');
        
        // Haal feestdagen op
        const holidayList = await getFallbackHolidays(startDate, endDate);
        
        if (!isMounted) return;
        setHolidays(holidayList);
        setInitializationStatus('Bezetting ophalen...');
        
        // Haal BESTAANDE data op (niet genereren!)
        // Data wordt gegenereerd in Wizard.tsx voordat deze component mount
        const records = await getRosterPeriodStaffing(rosterId);
        
        if (!isMounted) return;
        
        if (!records || records.length === 0) {
          setError(
            'Geen bezettingsgegevens gevonden. ' +
            'Data moet eerst worden gegenereerd vanuit de wizard. ' +
            'Ga terug naar het dashboard en maak een nieuw rooster aan.'
          );
          setLoading(false);
          return;
        }
        
        setStaffing(records);
        setInitializationStatus('Gereed!');
        setLoading(false);
        
      } catch (err) {
        console.error('Fout bij initialiseren period staffing:', err);
        if (isMounted) {
          const errorMessage = err instanceof Error 
            ? err.message 
            : 'Onbekende fout bij laden van diensten per dag data';
          setError(errorMessage);
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [rosterId, startDate, endDate]);

  // Groepeer per dienst (service_id)
  const serviceGroups: Record<string, RosterPeriodStaffing[]> = {};
  staffing.forEach(entry => {
    if (!serviceGroups[entry.service_id]) serviceGroups[entry.service_id] = [];
    serviceGroups[entry.service_id].push(entry);
  });

  function handleUpdate(id: string, updates: Partial<RosterPeriodStaffing>) {
    setStaffing(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-lg font-medium text-gray-700">{initializationStatus}</p>
        <p className="text-sm text-gray-500 mt-2">Dit kan enkele seconden duren...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Fout bij laden</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            Pagina verversen
          </button>
        </div>
      </div>
    );
  }

  if (Object.keys(serviceGroups).length === 0) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Geen diensten gevonden</h3>
          <p className="text-yellow-700 mb-4">
            Er zijn nog geen diensten geconfigureerd voor dit rooster. Voeg eerst diensten toe in de instellingen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <div className="min-w-[2400px]">
          {/* 3-niveau header */}
          <WeekHeader days={days} holidays={holidays} />
          
          {/* Dienst rijen */}
          <div className="border-t-2 border-gray-400">
            {Object.entries(serviceGroups)
              .sort(([a], [b]) => a.localeCompare(b, 'nl'))
              .map(([serviceId, records]) => (
                <ServiceRow
                  key={serviceId}
                  serviceId={serviceId}
                  records={records}
                  days={days}
                  holidays={holidays}
                  onUpdate={handleUpdate}
                />
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
