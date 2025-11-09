'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, AlertTriangle, Home } from 'lucide-react';
import { 
  PeriodDayStaffing, 
  makeCellKey,
  isValidBezetting 
} from '@/lib/types/period-day-staffing';
import { 
  getPeriodStaffingForRoster,
  savePeriodStaffingForRoster,
  updateSingleCell,
  updateTeamScopeForService,
  periodStaffingExists,
  initializePeriodStaffingForRoster
} from '@/lib/services/period-day-staffing-storage';
import { getAllServices } from '@/lib/services/diensten-storage';
import { Dienst } from '@/lib/types/dienst';
import { TeamScope } from '@/lib/types/daytype-staffing';
import { getDatesForRosterPeriod, groupDatesByWeek } from '@/lib/utils/roster-date-helpers';
import TeamSelector from '@/app/_components/TeamSelector';

/**
 * Client Component voor NB/period-staffing scherm (Ontwerpfase)
 * Periode-specifieke bezettingsregels voor een rooster van 35 dagen (5 weken)
 * 
 * VERSIE: Draad 22b - Grid aanpassingen:
 * - Verwijderd: "Ga naar bewerking" button
 * - Verwijderd: Weekend/Feestdag/Ontwerpfase visuele indicaties
 * - Toegevoegd: Grote blauwe "Terug naar Dashboard" button rechtsboven
 */
export default function PeriodStaffingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rosterId = searchParams.get('id');

  const [staffingData, setStaffingData] = useState<PeriodDayStaffing[]>([]);
  const [diensten, setDiensten] = useState<Dienst[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [readOnly, setReadOnly] = useState(false);

  // Load data
  useEffect(() => {
    if (!rosterId) {
      alert('Geen rooster ID gevonden');
      router.push('/planning/design');
      return;
    }

    async function loadData() {
      try {
        setIsLoading(true);
        // Haal diensten op
        const dienstenAlle = await getAllServices();
        const activeDiensten = dienstenAlle.filter(s => s.actief);
        setDiensten(activeDiensten);

        // Haal period staffing op
        let data = getPeriodStaffingForRoster(rosterId!);
        if (data.length === 0) {
          console.warn('[PeriodStaffing] Data not found, initializing...');
          data = [];
        }
        setStaffingData(data);
        validateAllData(data);
      } catch (error) {
        console.error('[PeriodStaffing] Error loading data:', error);
        alert('Fout bij laden van diensten per dag data');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [rosterId, router]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !readOnly) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, readOnly]);

  const validateAllData = (data: PeriodDayStaffing[]) => {
    const errors = new Set<string>();
    data.forEach(item => {
      if (item.minBezetting > item.maxBezetting) {
        errors.add(makeCellKey(item.dienstId, item.dagIndex));
      }
    });
    setValidationErrors(errors);
  };

  const handleCellChange = useCallback((
    dienstId: string,
    dagIndex: number,
    field: 'minBezetting' | 'maxBezetting',
    value: number
  ) => {
    setStaffingData(prev => {
      const updated = prev.map(item => {
        if (item.dienstId === dienstId && item.dagIndex === dagIndex) {
          const newItem = { ...item, [field]: value, updated_at: new Date().toISOString() };
          const cellKey = makeCellKey(dienstId, dagIndex);
          if (newItem.minBezetting > newItem.maxBezetting) {
            setValidationErrors(prev => new Set([...prev, cellKey]));
          } else {
            setValidationErrors(prev => {
              const newSet = new Set(prev);
              newSet.delete(cellKey);
              return newSet;
            });
          }
          return newItem;
        }
        return item;
      });
      setIsDirty(true);
      return updated;
    });
  }, []);

  const handleTeamScopeChange = useCallback((dienstId: string, newScope: TeamScope) => {
    setStaffingData(prev => {
      const updated = prev.map(item => {
        if (item.dienstId === dienstId) {
          return { ...item, teamScope: newScope, updated_at: new Date().toISOString() };
        }
        return item;
      });
      setIsDirty(true);
      return updated;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (validationErrors.size > 0) {
      alert('Er zijn nog validatiefouten. Los deze eerst op voordat je opslaat.');
      return;
    }
    setIsSaving(true);
    try {
      savePeriodStaffingForRoster(rosterId!, staffingData);
      setIsDirty(false);
      setTimeout(() => setIsSaving(false), 800);
    } catch (error) {
      console.error('[PeriodStaffing] Error saving:', error);
      alert('Fout bij opslaan: ' + (error as Error).message);
      setIsSaving(false);
    }
  }, [rosterId, staffingData, validationErrors]);

  const handleBackToDashboard = useCallback(() => {
    if (isDirty && !readOnly) {
      const confirmed = confirm('Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je terug wilt naar het dashboard?');
      if (!confirmed) return;
    }
    router.push(`/planning/design/dashboard?rosterId=${rosterId}`);
  }, [isDirty, readOnly, rosterId, router]);

  // Groepeer data per dienst
  const dataByService = useMemo(() => {
    const grouped: { [dienstId: string]: PeriodDayStaffing[] } = {};
    diensten.forEach(dienst => {
      grouped[dienst.id] = staffingData
        .filter(s => s.dienstId === dienst.id)
        .sort((a, b) => a.dagIndex - b.dagIndex);
    });
    return grouped;
  }, [diensten, staffingData]);

  // Genereer datum-info (alleen voor headers)
  const dateInfo = useMemo(() => {
    if (staffingData.length === 0) return [];
    const first = staffingData[0];
    return getDatesForRosterPeriod(first.dagDatum, []);
  }, [staffingData]);

  const weekGroups = useMemo(() => {
    return groupDatesByWeek(dateInfo);
  }, [dateInfo]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Diensten per dag laden...</p>
        </div>
      </div>
    );
  }

  const title = weekGroups.length > 0 
    ? `NB Bezetting per Dag : Week ${weekGroups[0].weekNumber} - Week ${weekGroups[weekGroups.length - 1].weekNumber} ${weekGroups[0].year}`
    : 'NB Bezetting per Dag';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-xl shadow-lg">
          {/* Header met Terug naar Dashboard button rechtsboven */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
                <span className="text-2xl mr-3">📅</span>
                {title}
              </h1>
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 px-8 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md hover:shadow-lg font-semibold text-lg"
              >
                <Home className="w-5 h-5" />
                Terug naar Dashboard
              </button>
            </div>
            {/* Opslaan button onder titel */}
            {!readOnly && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving || validationErrors.size > 0}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                    isDirty && !isSaving && validationErrors.size === 0
                      ? 'text-white bg-green-600 hover:bg-green-700 shadow-md'
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
                </button>
              </div>
            )}
          </div>

          {/* Warning voor validatie errors */}
          {validationErrors.size > 0 && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-200">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {validationErrors.size} validatiefout{validationErrors.size > 1 ? 'en' : ''}: 
                  Minimum mag niet groter zijn dan Maximum
                </span>
              </div>
            </div>
          )}

          {/* Tabel */}
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10">
                      Dienst / Team
                    </th>
                    {dateInfo.map((d, idx) => (
                      <th key={idx} className="border border-gray-300 px-2 py-2 text-center text-sm font-medium text-gray-700 min-w-[80px]">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">{d.dayName}</span>
                          <span className="font-semibold">{d.date}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diensten.map(dienst => {
                    const dienstData = dataByService[dienst.id] || [];
                    return (
                      <tr key={dienst.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 sticky left-0 bg-white z-10">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span 
                                className="inline-block w-3 h-3 rounded-full" 
                                style={{ backgroundColor: dienst.kleur }}
                              ></span>
                              <span className="font-medium text-gray-900">{dienst.code}</span>
                            </div>
                            <div className="text-xs text-gray-600">{dienst.naam}</div>
                            <div className="mt-1">
                              {/* FIX: Gebruik nu de correcte prop voor TeamSelector */}
                              <TeamSelector
                                currentScope={dienstData[0]?.teamScope || 'TEAM_A'}
                                onChange={(newScope) => handleTeamScopeChange(dienst.id, newScope)}
                                disabled={readOnly}
                              />
                            </div>
                          </div>
                        </td>
                        {dateInfo.map((d, idx) => {
                          const cellData = dienstData.find(item => item.dagIndex === idx);
                          const cellKey = makeCellKey(dienst.id, idx);
                          const hasError = validationErrors.has(cellKey);
                          
                          return (
                            <td 
                              key={idx} 
                              className={`border border-gray-300 px-2 py-2 text-center ${
                                hasError ? 'bg-red-50' : ''
                              }`}
                            >
                              {cellData ? (
                                <div className="flex flex-col gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    value={cellData.minBezetting}
                                    onChange={(e) => handleCellChange(
                                      dienst.id, 
                                      idx, 
                                      'minBezetting', 
                                      parseInt(e.target.value) || 0
                                    )}
                                    disabled={readOnly}
                                    className={`w-full px-1 py-1 text-center border rounded text-sm ${
                                      hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                    } disabled:bg-gray-100`}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    value={cellData.maxBezetting}
                                    onChange={(e) => handleCellChange(
                                      dienst.id, 
                                      idx, 
                                      'maxBezetting', 
                                      parseInt(e.target.value) || 0
                                    )}
                                    disabled={readOnly}
                                    className={`w-full px-1 py-1 text-center border rounded text-sm ${
                                      hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                    } disabled:bg-gray-100`}
                                  />
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer status */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span className="font-medium">{diensten.length}</span> diensten
                <span className="mx-2">·</span>
                <span className="font-medium">{dateInfo.length}</span> dagen
              </div>
              {isDirty && !readOnly && (
                <span className="text-amber-600 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  Niet-opgeslagen wijzigingen
                </span>
              )}
            </div>
            <div className="mt-4 text-xs text-gray-500">
              <p>Gebruik de button rechtsboven om terug te keren naar het Dashboard.</p>
              <p className="mt-1">Via het Dashboard kun je naar de roosterbewerkingsfase gaan.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
