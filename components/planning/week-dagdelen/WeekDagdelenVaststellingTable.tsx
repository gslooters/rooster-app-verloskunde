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
}

/**
 * DRAAD42 FASE 9 - Main Container Component
 * 
 * Functionaliteit:
 * - Client-side data fetching voor staffing dagdelen
 * - Passes initial data to child component
 * - Child component handles all state management
 * - Coordinatie tussen header, navigatie en data tabel
 */
export default function WeekDagdelenVaststellingTable({
  rosterId,
  weekNummer,
  actualWeekNumber,
  periodName,
  weekStart,
  weekEnd,
  serviceTypes,
}: WeekDagdelenVaststellingTableProps) {
  const [staffingData, setStaffingData] = useState<StaffingDagdeel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaffingData();
  }, [rosterId, weekStart, weekEnd]);

  async function fetchStaffingData() {
    try {
      setIsLoading(true);
      setError(null);

      // Haal eerst roster_period_staffing op voor deze week
      const { data: staffingRecords, error: staffingError } = await supabase
        .from('roster_period_staffing')
        .select('id, datum, service_type_id')
        .eq('roster_period_id', rosterId)
        .gte('datum', weekStart.split('T')[0])
        .lte('datum', weekEnd.split('T')[0]);

      if (staffingError) throw staffingError;

      if (!staffingRecords || staffingRecords.length === 0) {
        setStaffingData([]);
        setIsLoading(false);
        return;
      }

      const staffingIds = staffingRecords.map(r => r.id);

      // Haal dagdelen data op
      const { data: dagdelenData, error: dagdelenError } = await supabase
        .from('roster_period_staffing_dagdelen')
        .select('*')
        .in('roster_period_staffing_id', staffingIds);

      if (dagdelenError) throw dagdelenError;

      // Combineer data met service_type_id en datum info
      const enrichedData = (dagdelenData || []).map(dagdeel => {
        const staffingRecord = staffingRecords.find(r => r.id === dagdeel.roster_period_staffing_id);
        return {
          ...dagdeel,
          service_type_id: staffingRecord?.service_type_id,
          datum: staffingRecord?.datum,
        };
      });

      setStaffingData(enrichedData as StaffingDagdeel[]);
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
      />

      <WeekNavigation
        currentWeek={weekNummer}
        totalWeeks={5}
        rosterId={rosterId}
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
