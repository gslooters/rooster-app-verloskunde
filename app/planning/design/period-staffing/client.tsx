'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Save, AlertTriangle } from 'lucide-react';
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
 * Client Component voor Diensten per dag scherm
 * Periode-specifieke bezettingsregels voor een rooster van 35 dagen (5 weken)
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

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Haal diensten op
      const activeDiensten = getAllServices().filter(s => s.actief);
      setDiensten(activeDiensten);

      // Haal period staffing op
      let data = getPeriodStaffingForRoster(rosterId!);
      
      // Als data niet bestaat, initialiseer (zou niet moeten gebeuren, maar safety check)
      if (data.length === 0) {
        console.warn('[PeriodStaffing] Data not found, initializing...');
        // TODO: Haal roster data op voor startDate en holidays
        // Voor nu: dummy init
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
  };

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
          
          // Validate
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
      
      // Success feedback
      setTimeout(() => setIsSaving(false), 800);
    } catch (error) {
      console.error('[PeriodStaffing] Error saving:', error);
      alert('Fout bij opslaan: ' + (error as Error).message);
      setIsSaving(false);
    }
  }, [rosterId, staffingData, validationErrors]);

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
    
    // Haal eerste record op voor startdatum info
    const first = staffingData[0];
    // TODO: Haal echte roster data op voor startDate en holidays
    // Voor nu: gebruik datum uit eerste record
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

  // Bepaal titel met week-info
  const title = weekGroups.length > 0 
    ? `Diensten per dag : Periode Week ${weekGroups[0].weekNumber} - Week ${weekGroups[weekGroups.length - 1].weekNumber} ${weekGroups[0].year}`
    : 'Diensten per dag';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-xl shadow-lg">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => router.push('/planning/design')}
                className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Terug naar Rooster Ontwerp
              </button>
              
              {!readOnly && (
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving || validationErrors.size > 0}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                    isDirty && !isSaving && validationErrors.size === 0
                      ? 'text-white bg-blue-600 hover:bg-blue-700'
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Opslaan...' : 'Opslaan'}
                </button>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
              <span className="text-2xl mr-3">📅</span>
              {title}
            </h1>
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
                  {/* Week headers */}
                  <tr>
                    <th className="sticky left-0 z-20 bg-white border-r-2 border-gray-300" rowSpan={3}>
                      <div className="p-3 font-semibold text-gray-900 text-left">Dienst</div>
                    </th>
                    <th className="sticky left-[200px] z-20 bg-white border-r-2 border-gray-300" rowSpan={3}>
                      <div className="p-3 font-semibold text-gray-900 text-center">Team</div>
                    </th>
                    {weekGroups.map((week, idx) => (
                      <th 
                        key={idx}
                        colSpan={week.days.length}
                        className="bg-blue-50 text-center border-r-2 border-blue-200 py-2 px-1"
                      >
                        <span className="text-sm font-bold text-blue-900">
                          Week {week.weekNumber}
                        </span>
                      </th>
                    ))}
                  </tr>
                  
                  {/* Dag headers (MA, DI, etc.) */}
                  <tr>
                    {dateInfo.map((date, idx) => (
                      <th 
                        key={idx}
                        className="min-w-[60px] bg-gray-50 border-r border-gray-200 py-1 px-1"
                      >
                        <div className="text-xs font-bold text-gray-700">{date.dayName}</div>
                      </th>
                    ))}
                  </tr>
                  
                  {/* Datum headers (25, 26, etc.) */}
                  <tr>
                    {dateInfo.map((date, idx) => (
                      <th 
                        key={idx}
                        className="min-w-[60px] bg-gray-50 border-r border-gray-200 border-b-2 border-gray-300 py-1 px-1"
                      >
                        <div className="text-xs text-gray-600">
                          {date.dateShort} {date.isFeestdag && '🎉'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                
                <tbody>
                  {diensten.map((dienst, serviceIdx) => {
                    const serviceDays = dataByService[dienst.id] || [];
                    const firstDay = serviceDays[0];
                    
                    return (
                      <tr key={dienst.id} className={serviceIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {/* Sticky dienst kolom */}
                        <td className="sticky left-0 z-10 bg-inherit border-r-2 border-gray-300 p-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-sm flex-shrink-0" 
                              style={{ backgroundColor: dienst.kleur }}
                            />
                            <span className="text-sm font-medium text-gray-900">{dienst.naam}</span>
                          </div>
                        </td>
                        
                        {/* Sticky team kolom */}
                        <td className="sticky left-[200px] z-10 bg-inherit border-r-2 border-gray-300 p-2">
                          <TeamSelector
                            currentScope={firstDay?.teamScope || 'total'}
                            onChange={(scope) => handleTeamScopeChange(dienst.id, scope)}
                            disabled={readOnly}
                          />
                        </td>
                        
                        {/* Dag cellen */}
                        {serviceDays.map((dayData) => {
                          const cellKey = makeCellKey(dienst.id, dayData.dagIndex);
                          const hasError = validationErrors.has(cellKey);
                          
                          return (
                            <td key={dayData.dagIndex} className="border-r border-gray-200 p-1">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={8}
                                  value={dayData.minBezetting}
                                  onChange={(e) => handleCellChange(
                                    dienst.id,
                                    dayData.dagIndex,
                                    'minBezetting',
                                    parseInt(e.target.value) || 0
                                  )}
                                  disabled={readOnly}
                                  className={`w-8 h-7 text-center text-xs border rounded focus:ring-2 focus:ring-blue-500 ${
                                    hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                  } ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                                />
                                <span className="text-gray-400 text-xs">│</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={9}
                                  value={dayData.maxBezetting}
                                  onChange={(e) => handleCellChange(
                                    dienst.id,
                                    dayData.dagIndex,
                                    'maxBezetting',
                                    parseInt(e.target.value) || 0
                                  )}
                                  disabled={readOnly}
                                  className={`w-8 h-7 text-center text-xs border rounded focus:ring-2 focus:ring-blue-500 ${
                                    hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                  } ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                                />
                              </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-2">Actieve Diensten</h3>
                <div className="text-2xl font-bold text-blue-600">{diensten.length}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-2">Validatiefouten</h3>
                <div className={`text-2xl font-bold ${
                  validationErrors.size > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {validationErrors.size}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-2">Status</h3>
                <div className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${
                  isDirty ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                }`}>
                  {isDirty ? 'Niet opgeslagen' : 'Opgeslagen'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating unsaved indicator */}
      {isDirty && !readOnly && (
        <div className="fixed bottom-4 right-4 bg-orange-100 border border-orange-300 rounded-lg p-3 shadow-lg animate-pulse">
          <div className="flex items-center gap-2 text-orange-800">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span className="text-sm font-medium">Niet-opgeslagen wijzigingen</span>
          </div>
        </div>
      )}
    </div>
  );
}
