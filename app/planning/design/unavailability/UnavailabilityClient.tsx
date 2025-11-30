'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getRosterIdFromParams } from '@/lib/utils/getRosterIdFromParams';
import { loadRosterDesignData, toggleNBAssignment } from '@/lib/planning/rosterDesign';
import { isDagdeelUnavailable, DagdeelAvailability } from '@/lib/types/roster';
import { supabase } from '@/lib/supabase';

// DRAAD73B: VERSION MARKER - Force client bundle regeneration
// DRAAD81: NB opslag fix - lees uit roster_assignments in plaats van unavailability_data
const COMPONENT_VERSION = 'v2.2-draad81-roster-assignments-source';

// DRAAD81: Type voor NB assignments uit roster_assignments tabel
interface NBAssignment {
  employee_id: string;
  date: string;
  dagdeel: 'O' | 'M' | 'A';
  status: number;
}

// DRAAD73: ISO 8601 weeknummer (maandag = start week)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// DRAAD73B: Verbeterde teamkleur met debug logging
function getTeamColor(team: string): string {
  const normalized = (team || '').toLowerCase().trim();
  
  let color = 'bg-blue-600'; // Default: Overig
  if (normalized === 'groen') color = 'bg-green-500';
  if (normalized === 'oranje') color = 'bg-orange-500';
  
  return color;
}

function sortEmployees(empArray: any[]): any[] {
  const teamOrder: Record<string, number> = { 'Groen': 0, 'Oranje': 1, 'Overig': 2 };
  const dienstOrder: Record<string, number> = { 'Maat': 0, 'Loondienst': 1, 'ZZP': 2 };
  return empArray.slice().sort((a, b) => {
    const teamA = teamOrder[a.team] ?? 999;
    const teamB = teamOrder[b.team] ?? 999;
    if (teamA !== teamB) return teamA - teamB;
    const dienstA = dienstOrder[a.dienstverband] ?? 999;
    const dienstB = dienstOrder[b.dienstverband] ?? 999;
    if (dienstA !== dienstB) return dienstA - dienstB;
    const nameA = a.voornaam || a.name || '';
    const nameB = b.voornaam || b.name || '';
    return nameA.localeCompare(nameB, 'nl');
  });
}

export default function UnavailabilityClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = getRosterIdFromParams(searchParams);
  const [designData, setDesignData] = useState<any>(null);
  const [dates, setDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);
  
  // DRAAD81: Nieuwe state voor NB assignments uit roster_assignments
  const [nbAssignments, setNbAssignments] = useState<NBAssignment[]>([]);

  // DRAAD81: Load functie voor NB assignments uit roster_assignments tabel
  async function loadNBAssignments() {
    if (!rosterId) return;
    
    console.log('🔄 [DRAAD81] Laden NB assignments uit roster_assignments...');
    
    const { data, error } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, status')
      .eq('roster_id', rosterId)
      .eq('status', 3); // Status 3 = Niet Beschikbaar
    
    if (error) {
      console.error('❌ [DRAAD81] Database error bij laden NB assignments:', error);
      return;
    }
    
    setNbAssignments(data || []);
    console.log(`✅ [DRAAD81] Loaded ${(data || []).length} NB assignments from roster_assignments`);
  }

  // DRAAD81: Helper functie om te checken of dagdeel NB is
  function isNBForDagdeel(employeeId: string, date: string, dagdeel: 'O' | 'M' | 'A'): boolean {
    return nbAssignments.some(
      nb => nb.employee_id === employeeId && nb.date === date && nb.dagdeel === dagdeel
    );
  }

  useEffect(() => {
    if (!rosterId) {
      router.push('/planning');
      return;
    }
    (async function loadData() {
      try {
        console.log('🔄 [DRAAD81] Laden NB scherm data...');
        
        // Laad roster design data (voor employees)
        const data = await loadRosterDesignData(rosterId);
        if (!data) throw new Error('Geen rooster design data gevonden');
        setDesignData(data);
        
        console.log('👥 [DRAAD81] Employees data geladen:', data.employees?.length, 'medewerkers');
        
        // DRAAD81: Laad NB assignments uit roster_assignments
        await loadNBAssignments();
        
        // Laad start_date uit roosters tabel
        const { data: roster, error: rosterError } = await supabase
          .from('roosters')
          .select('start_date')
          .eq('id', rosterId)
          .single();
        if (rosterError || !roster) throw new Error('Kon start_date niet ophalen uit roosters tabel');
        
        // Genereer datums voor 35 dagen
        const generatedDates: Date[] = [];
        const startDate = new Date(roster.start_date + 'T00:00:00');
        for (let i = 0; i < 35; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          generatedDates.push(date);
        }
        setDates(generatedDates);
        
        console.log('✅ [DRAAD81] Data geladen en NB assignments gesynchroniseerd');
      } catch (error: any) {
        console.error('❌ [DRAAD81] Fout bij laden:', error);
        alert(error.message || 'Fout bij laden van data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [rosterId, router]);

  async function handleToggleUnavailable(emp: any, date: string, dagdeel: 'O' | 'M' | 'A') {
    if (!rosterId) return;
    
    const employeeId = emp.originalEmployeeId || emp.id;
    console.log('🔄 [DRAAD81] Toggle NB voor:', { employeeId, date, dagdeel });
    
    const success = await toggleNBAssignment(rosterId, employeeId, date, dagdeel);
    
    if (success) {
      // DRAAD81: Herlaad NB assignments uit roster_assignments
      await loadNBAssignments();
      console.log('✅ [DRAAD81] NB toggle succesvol, data gesynchroniseerd');
    } else {
      console.error('❌ [DRAAD81] Fout bij opslaan niet-beschikbaarheid');
      alert('Fout bij opslaan niet-beschikbaarheid. Check console voor details.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Niet-beschikbaarheid wordt geladen...</p>
        </div>
      </div>
    );
  }
  if (!designData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2>
          <p className="text-red-600 mb-4">Geen rooster data gevonden</p>
          <button onClick={()=>router.push('/planning')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Terug naar overzicht</button>
        </div>
      </div>
    );
  }
  if (dates.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Geen datums</h2>
          <p className="text-yellow-700 mb-4">Dit rooster heeft geen datums. Initialiseer het rooster eerst.</p>
          <button onClick={()=>router.push('/planning')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Terug naar overzicht</button>
        </div>
      </div>
    );
  }

  // DRAAD73: Bepaal beginnummer en eindnummer voor weken in header
  const weekFirst = getWeekNumber(dates[0]);
  const weekLast = getWeekNumber(dates[dates.length - 1]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER: Titel, periode en weeknummers */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Niet Beschikbaar aanpassen (per dagdeel)</h1>
            <p className="text-gray-600 text-sm">Klik op een cel om een medewerker niet-beschikbaar te markeren voor specifiek dagdeel (O/M/A).</p>
            <p className="text-xs text-green-600 mt-1">
              Periode: {dates[0] && formatDateLocal(dates[0])} tot {dates[dates.length - 1] && formatDateLocal(dates[dates.length - 1])}
              {' '} | Week {weekFirst} - {weekLast} ({dates.length} dagen)
            </p>
            <p className="text-xs text-blue-600 mt-1">
              🔄 DRAAD81: Data bron = roster_assignments (status=3) | Geladen: {nbAssignments.length} NB assignments
            </p>
          </div>
          <button 
            onClick={()=>router.push(`/planning/design/dashboard?rosterId=${rosterId}`)} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <span>←</span>
            <span>Terug naar Dashboard</span>
          </button>
        </div>

        {/* NB Roostertabel */}
        <div className="bg-white rounded-xl shadow-lg p-6 overflow-x-auto" style={{ maxWidth: '100vw' }}>
          <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th className="border border-gray-300 p-3 bg-gray-100 sticky left-0 z-10 font-semibold text-gray-900">Medewerker</th>
                {dates.map((date, idx) => {
                  const dayOfWeek = date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  return (
                    <th key={idx} colSpan={3} className={`border border-gray-300 p-2 text-xs font-medium ${isWeekend ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                      <div className="font-semibold">{['Zo','Ma','Di','Wo','Do','Vr','Za'][dayOfWeek]}</div>
                      <div className="text-gray-600">{date.getDate()}/{date.getMonth()+1}</div>
                      <div className="flex justify-around mt-1 text-[10px] text-gray-500">
                        <span>O</span><span>M</span><span>A</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortEmployees(designData.employees || []).map((emp: any) => {
                const employeeId = emp.originalEmployeeId || emp.id;
                const fullName = emp.voornaam || emp.name || 'Onbekend';
                const firstNameOnly = fullName.split(' ')[0];
                const teamColor = getTeamColor(emp.team || 'Overig');
                
                return (
                  <tr key={emp.id}>
                    <td 
                      className="border border-gray-300 p-3 font-medium bg-gray-50 sticky left-0 z-10"
                      style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={`${fullName} - Team ${emp.team || 'Overig'} - ${emp.dienstverband || 'Onbekend'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className={`inline-block w-4 h-4 rounded-full flex-shrink-0 ${teamColor}`} 
                          title={`Team ${emp.team || 'Overig'}`}
                        ></span>
                        <span>{firstNameOnly}</span>
                      </div>
                    </td>
                    {dates.map((date, dateIdx) => {
                      const dateStr = formatDateLocal(date);
                      return ['O', 'M', 'A'].map((dagdeel) => {
                        // DRAAD81: Gebruik isNBForDagdeel() om uit roster_assignments te lezen
                        const isNB = isNBForDagdeel(employeeId, dateStr, dagdeel as 'O' | 'M' | 'A');
                        
                        let cellClass = 'border border-gray-300 p-2 text-center transition-colors ';
                        let cursorClass = '';
                        let title = '';
                        if (isNB) {
                          cellClass += 'bg-red-200 ';
                          cursorClass = 'cursor-pointer hover:bg-red-300';
                          title = `${dagdeel} - Klik om beschikbaar te maken`;
                        } else {
                          cellClass += 'bg-white ';
                          cursorClass = 'cursor-pointer hover:bg-gray-100';
                          title = `${dagdeel} - Klik om niet-beschikbaar te markeren`;
                        }
                        return (
                          <td key={`${dateIdx}-${dagdeel}`} className={cellClass + cursorClass} onClick={() => handleToggleUnavailable(emp, dateStr, dagdeel as 'O' | 'M' | 'A')} title={title}>
                            {isNB && <span className="text-lg font-bold text-red-800">✕</span>}
                          </td>
                        );
                      });
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* DRAAD73B: Geherstructureerde legenda in 3 secties */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4 text-gray-900">Legenda</h3>
          
          {/* Sectie 1: Beschikbaarheid */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white border-2 border-gray-300 rounded"></div>
                <span className="text-gray-700">Beschikbaar (leeg)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-200 border-2 border-gray-300 rounded flex items-center justify-center">
                  <span className="text-lg font-bold text-red-800">✕</span>
                </div>
                <span className="text-gray-700">Niet Beschikbaar (NB)</span>
              </div>
            </div>
          </div>
          
          {/* Sectie 2: Dagdelen */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="font-medium text-gray-700 mb-2">Dagdelen:</div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
              <span><strong>O</strong> = Ochtend (09:00-13:00)</span>
              <span><strong>M</strong> = Middag (13:00-18:00)</span>
              <span><strong>A</strong> = Avond/Nacht (18:00-09:00)</span>
            </div>
          </div>
          
          {/* Sectie 3: Team kleuren */}
          <div className="mb-4">
            <div className="font-medium text-gray-700 mb-2">Team kleuren:</div>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-green-500"></span>
                <span className="text-gray-700">Team Groen</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-orange-500"></span>
                <span className="text-gray-700">Team Oranje</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-blue-600"></span>
                <span className="text-gray-700">Team Overig</span>
              </div>
            </div>
          </div>
          
          {/* Footer bericht geïntegreerd */}
          <div className="pt-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">💾 Wijzigingen worden automatisch opgeslagen</p>
            <p className="text-xs text-blue-600 mt-1">🔄 DRAAD81: Data wordt nu direct geschreven naar roster_assignments (single source of truth)</p>
          </div>
        </div>
      </div>
    </div>
  );
}