'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability, isEmployeeUnavailable, updateRosterDesignStatus } from '@/lib/planning/rosterDesign';
import { validateMaxShifts } from '@/lib/utils/validation';
import { readRosters } from '@/lib/planning/storage';
import type { RosterDesignData } from '@/lib/types/roster';

// Helper functions voor datum formatting (hergebruikt van PlanningGrid)
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
function formatDDMM(iso:string){ const d=toDate(iso); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function dayShort(iso:string){ const map=['ZO','MA','DI','WO','DO','VR','ZA'] as const; return map[toDate(iso).getDay()]; }
function isWeekend(iso:string){ const s=dayShort(iso); return s==='ZA'||s==='ZO'; }
function isoWeekNumber(iso:string){
  const d=toDate(iso); const target=new Date(d.valueOf()); const dayNr=(d.getDay()+6)%7; target.setDate(target.getDate()-dayNr+3);
  const firstThursday=new Date(target.getFullYear(),0,4); const ftDay=(firstThursday.getDay()+6)%7; firstThursday.setDate(firstThursday.getDate()-ftDay+3);
  return 1+Math.round((target.getTime()-firstThursday.getTime())/(7*24*3600*1000));
}

export default function RosterDesignPage() {
  const searchParams = useSearchParams();
  const rosterId = searchParams.get('rosterId');
  
  const [designData, setDesignData] = useState<RosterDesignData | null>(null);
  const [roster, setRoster] = useState<any>(null);
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxShiftsErrors, setMaxShiftsErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!rosterId) {
      setError('Geen roster ID gevonden');
      setLoading(false);
      return;
    }

    // Load roster and design data
    const rosters = readRosters();
    const foundRoster = rosters.find(r => r.id === rosterId);
    if (!foundRoster) {
      setError('Rooster niet gevonden');
      setLoading(false);
      return;
    }

    const loadedDesignData = loadRosterDesignData(rosterId);
    if (!loadedDesignData) {
      setError('Rooster ontwerp data niet gevonden');
      setLoading(false);
      return;
    }

    setRoster(foundRoster);
    setDesignData(loadedDesignData);
    
    // Generate days array (35 days = 5 weeks)
    const startDate = foundRoster.start_date;
    const daysArray = Array.from({ length: 35 }, (_, i) => addDaysISO(startDate, i));
    setDays(daysArray);
    
    setLoading(false);
  }, [rosterId]);

  // Group days by week for header
  const weekGroups = days.length > 0 ? (() => {
    const groups: { week: number; startIndex: number; span: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const w = isoWeekNumber(days[i]);
      let j = i + 1; while (j < days.length && isoWeekNumber(days[j]) === w) j++;
      groups.push({ week: w, startIndex: i, span: j - i }); i = j;
    }
    return groups;
  })() : [];

  const handleMaxShiftsChange = (employeeId: string, value: string) => {
    const validation = validateMaxShifts(value);
    
    if (!validation.isValid) {
      setMaxShiftsErrors(prev => ({...prev, [employeeId]: validation.error || 'Ongeldige waarde'}));
    } else {
      setMaxShiftsErrors(prev => {const newErrors = {...prev}; delete newErrors[employeeId]; return newErrors;});
      
      if (rosterId && validation.normalizedValue !== undefined) {
        const success = updateEmployeeMaxShifts(rosterId, employeeId, validation.normalizedValue);
        if (success) {
          // Reload design data to reflect changes
          const updatedData = loadRosterDesignData(rosterId);
          if (updatedData) setDesignData(updatedData);
        }
      }
    }
  };

  const handleToggleUnavailability = (employeeId: string, date: string) => {
    if (!rosterId) return;
    
    const success = toggleUnavailability(rosterId, employeeId, date);
    if (success) {
      // Reload design data to reflect changes
      const updatedData = loadRosterDesignData(rosterId);
      if (updatedData) setDesignData(updatedData);
    }
  };

  const handleAdvanceToEditing = () => {
    if (!rosterId || !designData) return;
    
    // Check if all employees have max shifts set
    const employeesWithoutShifts = designData.employees.filter(emp => emp.maxShifts === 0);
    if (employeesWithoutShifts.length > 0) {
      alert(`Volgende medewerkers hebben nog geen aantal diensten ingevuld: ${employeesWithoutShifts.map(e => e.name).join(', ')}`);
      return;
    }
    
    // Update status to editing phase
    const success = updateRosterDesignStatus(rosterId, { 
      phase: 'bewerking',
      designComplete: true 
    });
    
    if (success) {
      // Navigate to actual roster planning grid
      window.location.href = `/planning/${rosterId}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Rooster ontwerp laden...</p>
        </div>
      </div>
    );
  }

  if (error || !designData || !roster) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2>
          <p className="text-red-600 mb-4">{error || 'Onbekende fout opgetreden'}</p>
          <a href="/planning/design" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Terug naar overzicht
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <nav className="text-sm text-gray-500 mb-2">Dashboard &gt; Rooster Planning &gt; Ontwerp</nav>
              <h1 className="text-2xl font-bold text-gray-900">Rooster Ontwerpen</h1>
              <p className="text-gray-600">Periode: {formatPeriodDDMM(roster.start_date)}</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => window.location.href = '/planning/design'}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Terug naar overzicht
              </button>
              <button 
                onClick={handleAdvanceToEditing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Door naar Bewerking →
              </button>
            </div>
          </div>

          {/* Status Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Ontwerpfase</h3>
            <p className="text-blue-800 text-sm mb-2">
              In deze fase stelt u de basisgegevens voor het rooster in. Diensten worden nog niet handmatig ingepland.
            </p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Stel voor elke medewerker het aantal diensten in (0-35)</li>
              <li>• Markeer niet-beschikbare dagen met "NB"</li>
              <li>• Alle gegevens worden automatisch opgeslagen</li>
            </ul>
          </div>

          {/* Planning Grid */}
          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 bg-gray-50 border px-3 py-2 text-left w-40" rowSpan={2}>
                    Medewerker
                  </th>
                  <th className="sticky left-40 top-0 z-30 bg-gray-50 border px-2 py-2 text-center w-20" rowSpan={2}>
                    Max<br/>Diensten
                  </th>
                  {weekGroups.map(g => (
                    <th key={`w-${g.week}-${g.startIndex}`} className="sticky top-0 z-20 bg-gray-100 border px-2 py-1 text-center text-xs" colSpan={g.span}>
                      Week {g.week}
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.map(d => {
                    const short = dayShort(d);
                    const weekend = isWeekend(d);
                    const colorClass = weekend ? 'text-red-600' : 'text-gray-800';
                    return (
                      <th key={`d-${d}`} className="sticky top-8 z-20 bg-gray-50 border px-1 py-1 text-xs">
                        <div className={`flex flex-col items-center ${colorClass}`}>
                          <span className="uppercase leading-3">{short}</span>
                          <span className="leading-3">{formatDDMM(d)}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {designData.employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white border px-3 py-2 font-medium">
                      <div className="flex flex-col">
                        <span>{emp.name}</span>
                        <span className="text-xs text-gray-500">ID: {emp.originalEmployeeId}</span>
                      </div>
                    </td>
                    <td className="sticky left-40 z-10 bg-white border px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        max="35"
                        value={emp.maxShifts}
                        onChange={(e) => handleMaxShiftsChange(emp.id, e.target.value)}
                        className={`shifts-input w-full text-center ${
                          maxShiftsErrors[emp.id] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        title="Aantal diensten voor deze periode (0-35)"
                      />
                      {maxShiftsErrors[emp.id] && (
                        <div className="text-xs text-red-600 mt-1">{maxShiftsErrors[emp.id]}</div>
                      )}
                    </td>
                    {days.map(d => {
                      const isUnavailable = isEmployeeUnavailable(rosterId!, emp.id, d);
                      return (
                        <td key={d} className="border p-1 text-center">
                          <button
                            onClick={() => handleToggleUnavailability(emp.id, d)}
                            className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                              isUnavailable 
                                ? 'not-available bg-red-100 border border-red-300 hover:bg-red-200' 
                                : 'bg-white border border-gray-200 hover:bg-gray-100'
                            }`}
                            title={isUnavailable ? 'Niet beschikbaar - klik om beschikbaar te maken' : 'Beschikbaar - klik om niet beschikbaar te maken'}
                          >
                            {isUnavailable ? 'NB' : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
            <div>
              Laatst gewijzigd: {new Date(designData.updated_at).toLocaleString('nl-NL')}
            </div>
            <div>
              Status: <span className="font-medium text-blue-600">Ontwerp</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}