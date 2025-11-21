'use client';

import React from 'react';
import { WeekTableHeader } from './WeekTableHeader';
import WeekTableBody from './WeekTableBody';
import type { WeekDagdelenData, DienstDagdelenWeek, DagdeelStatus } from '@/lib/types/week-dagdelen';
import type { TeamFilters } from './ActionBar';

interface WeekDagdelenTableProps {
  weekData: WeekDagdelenData;
  teamFilters?: TeamFilters;
  onDagdeelUpdate?: (dagdeelId: string, nieuweStatus: DagdeelStatus, nieuwAantal: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * WeekDagdelenTable Component
 * 
 * 🔥 DRAAD40B5 #8 - CONTAINER STRUCTURE FIX:
 * ✅ Removed overflow-hidden wrapper (blocked sticky)
 * ✅ Direct overflow-auto on table container
 * ✅ Position relative for z-index stacking context
 * ✅ Vertical scroll with max-height
 */
export default function WeekDagdelenTable({
  weekData,
  teamFilters,
  onDagdeelUpdate,
  disabled = false
}: WeekDagdelenTableProps) {
  if (!weekData || !weekData.diensten || weekData.diensten.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-base font-medium text-gray-700 mb-2">Geen rooster data beschikbaar</p>
        <p className="text-sm text-gray-500">
          {weekData?.context?.weekNumber 
            ? `Week ${weekData.context.weekNumber} bevat geen diensten` 
            : 'Selecteer een week om de rooster data te bekijken'}
        </p>
      </div>
    );
  }

  // ============================================================================
  // DATA FILTERING
  // ============================================================================
  
  /**
   * Filter diensten based on team filters
   * Als alle teams uitstaan: toon lege table
   * Anders: filter diensten met minimaal 1 team dat data heeft voor geselecteerde teams
   */
  const filteredDiensten = teamFilters
    ? weekData.diensten.filter(dienst => {
        // Check if any selected team has data
        const hasGroenData = teamFilters.GRO && dienst.teams.groen;
        const hasOranjeData = teamFilters.ORA && dienst.teams.oranje;
        const hasTotaalData = teamFilters.TOT && dienst.teams.totaal;
        
        return hasGroenData || hasOranjeData || hasTotaalData;
      })
    : weekData.diensten;

  // Check if no teams are selected
  const noTeamsSelected = teamFilters && !teamFilters.GRO && !teamFilters.ORA && !teamFilters.TOT;

  if (noTeamsSelected) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-base font-medium text-gray-700 mb-2">Geen teams geselecteerd</p>
        <p className="text-sm text-gray-500">
          Gebruik de team filters bovenaan om minimaal één team te selecteren
        </p>
      </div>
    );
  }

  if (filteredDiensten.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </div>
        <p className="text-base font-medium text-gray-700 mb-2">Geen diensten gevonden</p>
        <p className="text-sm text-gray-500">
          De geselecteerde team filters tonen geen resultaten voor deze week
        </p>
      </div>
    );
  }

  // ============================================================================
  // BUILD WEEK DAGEN ARRAY
  // ============================================================================
  
  /**
   * Extract unique days from first dienst (all diensten have same days)
   * Build WeekDag array for header
   */
  const weekDagen = filteredDiensten[0].teams.groen.dagen.map(dag => ({
    datum: dag.datum,
    dagSoort: dag.dagNaam as 'ma' | 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo'
  }));

  // Validate we have 7 days
  if (weekDagen.length !== 7) {
    console.warn(`⚠️ Week heeft ${weekDagen.length} dagen ipv 7. Data mogelijk incompleet.`);
  }

  // ============================================================================
  // RENDER TABLE
  // ============================================================================
  
  return (
    <div className="relative">
      {/* 🔥 DRAAD40B5 #8 FIX: Direct scroll container zonder blocking overflow wrapper */}
      <div 
        className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto"
        style={{
          position: 'relative' // Stacking context for z-index
        }}
      >
        <table className="w-full border-collapse">
          {/* Header: Datum row + Dagdeel row met emoji's */}
          <WeekTableHeader weekDagen={weekDagen} />
          
          {/* Body: Dienst groepen met team rijen */}
          <WeekTableBody
            diensten={filteredDiensten}
            onDagdeelUpdate={onDagdeelUpdate}
            disabled={disabled}
          />
        </table>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600 font-mono">
          <div>Debug Info:</div>
          <div>- Totaal diensten: {weekData.diensten.length}</div>
          <div>- Gefilterde diensten: {filteredDiensten.length}</div>
          <div>- Week periode: {weekData.context.startDate} → {weekData.context.endDate}</div>
          <div>- Aantal dagen: {weekDagen.length}</div>
        </div>
      )}
    </div>
  );
}
