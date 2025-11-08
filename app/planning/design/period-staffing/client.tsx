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

    async function loadData() {
      try {
        setIsLoading(true);
        // Haal diensten op (nu async!)
        const dienstenAlle = await getAllServices();
        const activeDiensten = dienstenAlle.filter(s => s.actief);
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
                <thead> ... </thead>
                <tbody> ... </tbody>
              </table>
            </div>
          </div>

          {/* Footer status */}
          <div className="p-6 bg-gray-50 border-t border-gray-200"> ... </div>
        </div>
      </div>
      {/* Floating unsaved indicator */} ...
    </div>
  );
}
