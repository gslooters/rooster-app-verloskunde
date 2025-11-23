'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface WeekInfo {
  weekNumber: number; // ISO weeknummer (48-52)
  weekIndex: number;   // 🔥 Week positie binnen roosterperiode (1-5)
  startDate: string;
  endDate: string;
  hasChanges: boolean;
  lastUpdated: string | null;
}

export default function DagdelenDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rosterId = searchParams.get('roster_id');
  const periodStart = searchParams.get('period_start');
  
  // ✅ FASE 1: Loading State Management
  const [weekData, setWeekData] = useState<WeekInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rosterInfo, setRosterInfo] = useState<any>(null);
  const [isDataReady, setIsDataReady] = useState(false);
  
  const supabase = createClientComponentClient();

  // 🔧 DRAAD2A FIX: useCallback voor loadWeekData om dependency issues te voorkomen
  const loadWeekData = useCallback(async () => {
    try {
      // ✅ Reset states
      setIsLoading(true);
      setHasError(false);
      setError(null);
      setIsDataReady(false);

      console.log('🔄 Start laden weekdata voor roster:', rosterId, 'periode:', periodStart);

      // Haal rooster informatie op
      const { data: roster, error: rosterError } = await supabase
        .from('roosters')
        .select('*')
        .eq('id', rosterId)
        .single();

      if (rosterError) {
        throw new Error(`Fout bij ophalen rooster: ${rosterError.message}`);
      }

      setRosterInfo(roster);
      console.log('✅ Rooster info opgehaald:', roster);

      // ✅ DRAAD37K2-FIX: Forceer UTC parsing
      const startDate = new Date(periodStart! + 'T00:00:00Z');
      
      console.log('🔍 Period Start (input):', periodStart);
      console.log('📅 Parsed as UTC Date:', startDate.toISOString());
      console.log('📆 UTC Day:', startDate.getUTCDay(), '(0=zondag, 1=maandag)');
      console.log('✅ Week berekening start vanaf:', startDate.toLocaleDateString('nl-NL'));
      
      const weeks: WeekInfo[] = [];

      // Genereer exact 5 weken vanaf startDate
      for (let i = 0; i < 5; i++) {
        const weekStart = new Date(startDate);
        weekStart.setUTCDate(startDate.getUTCDate() + (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

        const weekNumber = getWeekNumber(weekStart);
        const weekIndex = i + 1;
        
        console.log(`✅ Week ${weekIndex}: ISO Weeknr ${weekNumber}, Start: ${formatDateNL(weekStart)}, End: ${formatDateNL(weekEnd)}`);

        const weekStartStr = formatDateForQuery(weekStart);
        const weekEndStr = formatDateForQuery(weekEnd);
        
        console.log(`🔎 Supabase query: roster_period_staffing.date >= ${weekStartStr} AND date <= ${weekEndStr}`);

        // ✅ Query parent tabel + JOIN naar dagdelen
        const { data: parentRecords, error: queryError } = await supabase
          .from('roster_period_staffing')
          .select(`
            id,
            date,
            roster_period_staffing_dagdelen (
              updated_at,
              status
            )
          `)
          .eq('roster_id', rosterId)
          .gte('date', weekStartStr)
          .lte('date', weekEndStr);

        if (queryError) {
          console.error(`❌ Supabase error week ${weekIndex}:`, queryError);
        } else {
          console.log(`📊 Week ${weekIndex}: ${parentRecords?.length || 0} parent records opgehaald`);
        }

        // 🔧 DRAAD2A: Verbeterde defensieve data extractie
        const dagdelenRecords = Array.isArray(parentRecords) 
          ? parentRecords.flatMap(parent => {
              if (!parent || typeof parent !== 'object') return [];
              const dagdelen = parent.roster_period_staffing_dagdelen;
              return Array.isArray(dagdelen) ? dagdelen : [];
            })
          : [];
        
        console.log(`📊 Week ${weekIndex}: ${dagdelenRecords.length} dagdelen records gevonden`);
        
        const modifiedChanges = dagdelenRecords.filter((d: any) => 
          d && typeof d === 'object' && d.status === 'AANGEPAST'
        );

        const hasChanges: boolean = modifiedChanges.length > 0;
        
        // 🔧 DRAAD2A: Type-safe lastUpdated met extra validatie
        let lastUpdated: string | null = null;
        if (modifiedChanges.length > 0) {
          try {
            const sorted = modifiedChanges
              .filter((c: any) => c?.updated_at && typeof c.updated_at === 'string')
              .sort((a: any, b: any) => {
                const timeA = new Date(a.updated_at).getTime();
                const timeB = new Date(b.updated_at).getTime();
                return timeB - timeA;
              });
            
            if (sorted.length > 0 && sorted[0]?.updated_at) {
              lastUpdated = sorted[0].updated_at;
            }
          } catch (err) {
            console.warn(`⚠️ Error sorting lastUpdated for week ${weekIndex}:`, err);
          }
        }

        weeks.push({
          weekNumber,
          weekIndex,
          startDate: formatDate(weekStart),
          endDate: formatDate(weekEnd),
          hasChanges,
          lastUpdated
        });
      }

      // 🔧 DRAAD2A: Debug logging vóór setState
      console.log('📊 Gegenereerde weken:', weeks.map(w => `Week ${w.weekIndex} (ISO: ${w.weekNumber}): ${w.startDate}-${w.endDate}`).join(', '));
      
      // ✅ DRAAD2A FIX: Validatie voordat state wordt gezet
      if (!Array.isArray(weeks) || weeks.length === 0) {
        console.error('❌ Geen geldige weken gegenereerd!');
        throw new Error('Geen weekdata kunnen genereren');
      }
      
      if (weeks.length !== 5) {
        console.warn('⚠️ Verwachte 5 weken, maar kreeg:', weeks.length);
      }
      
      console.log('✅ weekData succesvol gezet, aantal weken:', weeks.length);
      
      // ✅ KRITIEK: Eerst weekData zetten, dan pas isDataReady
      setWeekData(weeks);
      
      // ✅ Gebruik setTimeout om render cycle te garanderen
      setTimeout(() => {
        setIsDataReady(true);
        console.log('✅ isDataReady gezet op true');
      }, 50);
      
    } catch (error) {
      console.error('❌ Fout bij laden weekdata:', error);
      setError(error instanceof Error ? error.message : 'Onbekende fout bij laden data');
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [rosterId, periodStart, supabase]);

  useEffect(() => {
    if (rosterId && periodStart) {
      loadWeekData();
    } else {
      setError('Geen roster_id of period_start gevonden in URL');
      setHasError(true);
      setIsLoading(false);
    }
  }, [rosterId, periodStart, loadWeekData]);

  /**
   * Berekent ISO-8601 weeknummer voor een gegeven datum
   * ✅ Gebruikt UTC om consistentie te garanderen
   */
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  /**
   * Format datum voor Nederlandse weergave (dd/mm)
   */
  const formatDate = (date: Date): string => {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  /**
   * Format datum voor Nederlandse volledige weergave
   */
  const formatDateNL = (date: Date): string => {
    return date.toLocaleDateString('nl-NL', { 
      timeZone: 'UTC',
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  };

  /**
   * Format datum voor volledige Nederlandse weergave
   */
  const formatDateFull = (date: Date): string => {
    const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 
                    'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    const day = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
  };

  /**
   * Format datum voor Supabase query (YYYY-MM-DD)
   */
  const formatDateForQuery = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * 🔥 DRAAD2A: Week click handler met period_start parameter
   */
  const handleWeekClick = useCallback((weekIndex: number) => {
    if (!rosterId || !periodStart) {
      console.error('❌ Kan niet navigeren: ontbrekende parameters');
      return;
    }
    
    console.log(`🔗 Navigeren naar week INDEX ${weekIndex}`);
    console.log(`📝 Parameters: rosterId=${rosterId}, weekIndex=${weekIndex}, periodStart=${periodStart}`);
    
    router.push(
      `/planning/design/week-dagdelen/${rosterId}/${weekIndex}?period_start=${periodStart}`
    );
  }, [rosterId, periodStart, router]);

  const handleExportPDF = () => {
    alert('PDF export wordt geïmplementeerd in volgende fase');
  };

  const handleBack = useCallback(() => {
    if (!rosterId) {
      router.push('/planning/design/dashboard');
      return;
    }
    router.push(`/planning/design/dashboard?roster_id=${rosterId}`);
  }, [rosterId, router]);

  /**
   * 🔧 DRAAD2A: Type-safe date formatting
   */
  const formatLastUpdated = (dateString: string | null): string => {
    if (!dateString || typeof dateString !== 'string') return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('⚠️ Invalid date string:', dateString);
        return '';
      }
      return date.toLocaleString('nl-NL');
    } catch (err) {
      console.warn('⚠️ Error formatting date:', dateString, err);
      return '';
    }
  };

  // ✅ FASE 2: Conditional Rendering Guards
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Weekdata laden...</p>
          <p className="text-gray-400 text-sm mt-2">Even geduld...</p>
        </div>
      </div>
    );
  }

  if (hasError || error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Fout bij laden</h3>
          </div>
          <p className="text-gray-600 mb-4">{error || 'Onbekende fout opgetreden'}</p>
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Terug naar Dashboard
            </button>
            <button
              onClick={loadWeekData}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isDataReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-300 rounded mx-auto mb-4"></div>
            <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
          </div>
          <p className="text-gray-500 mt-4 text-sm">Data verwerken...</p>
        </div>
      </div>
    );
  }

  if (!weekData || !Array.isArray(weekData) || weekData.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Geen weekdata</h3>
          </div>
          <p className="text-gray-600 mb-4">Er is geen weekdata beschikbaar voor deze periode.</p>
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Terug
            </button>
            <button
              onClick={loadWeekData}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Opnieuw laden
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Als we hier komen, hebben we gevalideerde data
  const firstWeek = weekData[0];
  const lastWeek = weekData[4] || weekData[weekData.length - 1];
  
  const periodTitle = firstWeek && lastWeek 
    ? `Week ${firstWeek.weekNumber || '?'} – Week ${lastWeek.weekNumber || '?'}`
    : '';

  const periodStartDate = new Date(periodStart! + 'T00:00:00Z');
  const periodEndDate = new Date(periodStartDate);
  periodEndDate.setUTCDate(periodStartDate.getUTCDate() + 34);
  
  const rosterPeriodText = `${formatDateFull(periodStartDate)} - ${formatDateFull(periodEndDate)}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Terug naar Rooster Ontwerp
            </button>
            
            <button
              onClick={handleExportPDF}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF export gehele rooster (5 weken)
            </button>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Diensten per Dagdeel Aanpassen: Periode {periodTitle}
          </h1>
          
          <p className="text-sm text-gray-600 mt-2">
            rooster: {rosterPeriodText}
          </p>
        </div>

        <div className="space-y-4">
          {weekData.map((week, index) => {
            if (!week || typeof week !== 'object') {
              console.warn(`⚠️ Invalid week at index ${index}:`, week);
              return null;
            }
            
            const weekNum = week.weekNumber || 0;
            const weekIdx = week.weekIndex || 0;
            const startDt = week.startDate || '?';
            const endDt = week.endDate || '?';
            const hasChg = Boolean(week.hasChanges);
            const lastUpd = week.lastUpdated;
            
            return (
              <button
                key={`week-${weekIdx}-${index}`}
                onClick={() => handleWeekClick(weekIdx)}
                className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm hover:shadow-lg transition-all duration-200 p-6 text-left border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-100 hover:-translate-y-0.5 cursor-pointer relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Week {weekNum}: {startDt} – {endDt}
                    </h3>
                    
                    {lastUpd && (
                      <p className="text-sm text-gray-500">
                        Laatst gewijzigd: {formatLastUpdated(lastUpd)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    {hasChg && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Aangepast
                      </span>
                    )}
                    
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Klik op een week om de details te bekijken en aan te passen.</p>
              <p>Weken met een "Aangepast" badge bevatten handmatige wijzigingen.</p>
            </div>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 bg-gray-800 text-gray-100 rounded-lg p-4 text-xs font-mono">
            <div className="font-bold mb-2">🐛 Debug Info (DRAAD2A):</div>
            <div>isLoading: {String(isLoading)}</div>
            <div>hasError: {String(hasError)}</div>
            <div>isDataReady: {String(isDataReady)}</div>
            <div>weekData.length: {weekData?.length || 0}</div>
            <div>roster_id: {rosterId}</div>
            <div>period_start: {periodStart}</div>
            <div className="mt-2 text-green-400">✅ DRAAD2A: Type safety + useCallback improvements</div>
            <div className="text-green-400">✅ Display: ISO weeknummer (48-52)</div>
            <div className="text-green-400">✅ Route: /planning/design/week-dagdelen/[rosterId]/[1-5]?period_start=[date]</div>
          </div>
        )}
      </div>
    </div>
  );
}