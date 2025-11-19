'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface WeekInfo {
  weekNumber: number;
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
  
  const [weekData, setWeekData] = useState<WeekInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosterInfo, setRosterInfo] = useState<any>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (rosterId && periodStart) {
      loadWeekData();
    }
  }, [rosterId, periodStart]);

  const loadWeekData = async () => {
    try {
      setLoading(true);

      // Haal rooster informatie op
      const { data: roster } = await supabase
        .from('roosters')
        .select('*')
        .eq('id', rosterId)
        .single();

      setRosterInfo(roster);

      // ✅ DRAAD37K2-FIX: Forceer UTC parsing en verwijder onnodige normalisatie
      // periodStart komt AL correct binnen vanaf Dashboard (maandag 24-11-2025)
      const startDate = new Date(periodStart! + 'T00:00:00Z');
      
      console.log('🔍 Period Start (input):', periodStart);
      console.log('📅 Parsed as UTC Date:', startDate.toISOString());
      console.log('📆 UTC Day:', startDate.getUTCDay(), '(0=zondag, 1=maandag)');
      console.log('✅ Week berekening start vanaf:', startDate.toLocaleDateString('nl-NL'));
      
      const weeks: WeekInfo[] = [];

      // Genereer exact 5 weken vanaf startDate (ZONDER normalisatie)
      for (let i = 0; i < 5; i++) {
        // ✅ Gebruik UTC methoden om timezone issues te voorkomen
        const weekStart = new Date(startDate);
        weekStart.setUTCDate(startDate.getUTCDate() + (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

        const weekNumber = getWeekNumber(weekStart);
        
        console.log(`✅ Week ${i + 1}: Weeknr ${weekNumber}, Start: ${formatDateNL(weekStart)}, End: ${formatDateNL(weekEnd)}`);

        // Check voor wijzigingen in deze week
        const weekStartStr = formatDateForQuery(weekStart);
        const weekEndStr = formatDateForQuery(weekEnd);
        
        console.log(`🔎 Supabase query: date >= ${weekStartStr} AND date <= ${weekEndStr}`);

        const { data: changes, error: queryError } = await supabase
          .from('roster_period_staffing_dagdelen')
          .select('updated_at, status')
          .eq('roster_id', rosterId)
          .gte('date', weekStartStr)
          .lte('date', weekEndStr)
          .eq('status', 'AANGEPAST');

        if (queryError) {
          console.error(`❌ Supabase error week ${weekNumber}:`, queryError);
        }

        const hasChanges: boolean = !!(changes && changes.length > 0);
        const lastUpdated = changes && changes.length > 0 
          ? changes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at
          : null;

        weeks.push({
          weekNumber,
          startDate: formatDate(weekStart),
          endDate: formatDate(weekEnd),
          hasChanges,
          lastUpdated
        });
      }

      setWeekData(weeks);
      console.log('📊 Gegenereerde weken:', weeks.map(w => `Week ${w.weekNumber}: ${w.startDate}-${w.endDate}`).join(', '));
      
    } catch (error) {
      console.error('❌ Fout bij laden weekdata:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Berekent ISO-8601 weeknummer voor een gegeven datum
   * ✅ Gebruikt UTC om consistentie te garanderen
   */
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7; // Zondag=7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  /**
   * Format datum voor Nederlandse weergave (dd/mm)
   * ✅ Gebruikt UTC om timezone issues te voorkomen
   */
  const formatDate = (date: Date): string => {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  /**
   * Format datum voor Nederlandse volledige weergave
   * ✅ Helper voor logging
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
   * ✅ VERBETERING 3: Format datum voor volledige Nederlandse weergave
   * Gebruikt voor rooster periode weergave onder titel
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
   * ✅ Gebruikt UTC om exacte datum te garanderen
   */
  const formatDateForQuery = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleWeekClick = (weekNumber: number) => {
    router.push(`/planning/design/dagdelen-dashboard/${weekNumber}?roster_id=${rosterId}&period_start=${periodStart}`);
  };

  const handleExportPDF = async () => {
    // Implementeer PDF export later
    alert('PDF export wordt geïmplementeerd in volgende fase');
  };

  // ✅ VERBETERING 1: Correcte terugnavigatie naar Dashboard Rooster Ontwerp
  const handleBack = () => {
    router.push(`/planning/design/dashboard?roster_id=${rosterId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  const firstWeek = weekData[0];
  const lastWeek = weekData[4];
  
  // ✅ VERBETERING 2: Titel ZONDER datums tussen haakjes
  const periodTitle = firstWeek && lastWeek 
    ? `Week ${firstWeek.weekNumber} – Week ${lastWeek.weekNumber}`
    : '';

  // ✅ VERBETERING 3: Rooster info met volledige datums
  const periodStartDate = new Date(periodStart! + 'T00:00:00Z');
  const periodEndDate = new Date(periodStartDate);
  periodEndDate.setUTCDate(periodStartDate.getUTCDate() + 34); // 5 weken - 1 dag
  
  const rosterPeriodText = `${formatDateFull(periodStartDate)} - ${formatDateFull(periodEndDate)}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
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
          
          {/* ✅ VERBETERING 3: Rooster info met volledige datums in kleine letters */}
          <p className="text-sm text-gray-600 mt-2">
            rooster: {rosterPeriodText}
          </p>
        </div>

        {/* Week Buttons */}
        <div className="space-y-4">
          {weekData.map((week) => (
            <button
              key={week.weekNumber}
              onClick={() => handleWeekClick(week.weekNumber)}
              className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm hover:shadow-md transition-all p-6 text-left border-2 border-blue-200 hover:border-blue-400 relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Week {week.weekNumber}: {week.startDate} – {week.endDate}
                  </h3>
                  
                  {week.lastUpdated && (
                    <p className="text-sm text-gray-500">
                      Laatst gewijzigd: {new Date(week.lastUpdated).toLocaleString('nl-NL')}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  {week.hasChanges && (
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
          ))}
        </div>

        {/* Info sectie */}
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
      </div>
    </div>
  );
}
