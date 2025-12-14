'use client';

import { useState, useEffect } from 'react';
import VaststellingHeader from './VaststellingHeader';
import WeekNavigation from './WeekNavigation';
import VaststellingDataTable from './VaststellingDataTable';
import { supabase } from '@/lib/supabase';
import type { ServiceType, StaffingDagdeel } from '@/types/planning';

interface WeekDagdelenVaststellingTableProps {
  rosterId: string;
  weekNummer: number;
  actualWeekNumber: number;
  periodName: string;
  weekStart: string;
  weekEnd: string;
  serviceTypes: ServiceType[];
  periodStart: string; // 🔥 DRAAD42G: NIEUW - voor routing terug naar dashboard
}

/**
 * 🔥 DRAAD179 FASE 2 FIX
 * 
 * PROBLEEM: Query gebruikte niet-bestaande "roster_period_staffing" tabel
 * OORZAAK: DRAAD176 denormalisering - parent tabel verwijderd
 * 
 * OPLOSSING:
 * - Direct query naar "roster_period_staffing_dagdelen" (denormalized)
 * - Geen JOIN meer nodig - alle velden direct beschikbaar
 * - roster_id, service_id, date zijn nu direct in dagdelen
 * 
 * SCHEMA VERANDERING:
 * OUD: .from('roster_period_staffing') → JOIN naar _dagdelen
 * NIEUW: .from('roster_period_staffing_dagdelen') → direct select *
 */
export default function WeekDagdelenVaststellingTable({
  rosterId,
  weekNummer,
  actualWeekNumber,
  periodName,
  weekStart,
  weekEnd,
  serviceTypes,
  periodStart,
}: WeekDagdelenVaststellingTableProps) {
  const [staffingData, setStaffingData] = useState<StaffingDagdeel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaffingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterId, weekStart, weekEnd]);

  async function fetchStaffingData() {
    try {
      setIsLoading(true);
      setError(null);

      // 🔥 DRAAD179 FASE 2 FIX: Direct query naar denormalized tabel
      // ✅ Geen parent tabel meer - direct naar dagdelen
      // ✅ roster_id, service_id, date zijn denormaliseerd in tabel
      const { data: dagdelenRecords, error: dagdelenError } = await supabase
        .from('roster_period_staffing_dagdelen')
        .select('*')
        .eq('roster_id', rosterId)
        .gte('date', weekStart.split('T')[0])
        .lte('date', weekEnd.split('T')[0])
        .order('date', { ascending: true });

      if (dagdelenError) throw dagdelenError;

      if (!dagdelenRecords || dagdelenRecords.length === 0) {
        setStaffingData([]);
        setIsLoading(false);
        return;
      }

      setStaffingData(dagdelenRecords as StaffingDagdeel[]);
    } catch (err) {
      console.error('Error fetching staffing data:', err);
      setError('Fout bij ophalen van data');
    } finally {
      setIsLoading(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-red-600 font-semibold">⚠️ {error}</p>
          <button
            onClick={() => fetchStaffingData()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Opnieuw proberen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <VaststellingHeader
        weekNummer={actualWeekNumber}
        weekStart={weekStart}
        weekEnd={weekEnd}
        periodName={periodName}
        rosterId={rosterId}
        periodStart={periodStart}
      />

      <WeekNavigation
        currentWeek={weekNummer}
        totalWeeks={5}
        rosterId={rosterId}
        periodStart={periodStart}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Data laden...</p>
          </div>
        </div>
      ) : (
        <VaststellingDataTable
          serviceTypes={serviceTypes}
          initialStaffingData={staffingData}
          weekStart={weekStart}
          weekEnd={weekEnd}
        />
      )}
    </div>
  );
}
