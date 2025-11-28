'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getRosterIdFromParams } from '@/lib/utils/getRosterIdFromParams';
import { loadRosterDesignData, toggleNBAssignment } from '@/lib/planning/rosterDesign';
import { isDagdeelUnavailable, DagdeelAvailability } from '@/lib/types/roster';

/**
 * ✅ FIX DRAAD26R: Genereer 35 dagen beginnend op MAANDAG
 * 
 * Probleem: Het rooster begint altijd op maandag (bijv. 24-11-2025),
 * maar de oude code gebruikte simpelweg start_date uit database (vaak zondag 23-11).
 * 
 * Oplossing: Forceer altijd de eerste maandag als startdatum
 * 
 * @param referenceDate - Referentie datum (meestal uit database)
 * @returns Array van 35 Date objecten, beginnend op de eerste maandag
 */
function getDaysInRangeStartingMonday(referenceDate: Date): Date[] {
  // Clone de datum om mutatie te voorkomen
  const refDate = new Date(referenceDate);
  
  // Vind de eerste maandag (dag 1 in JS Date, zondag = 0)
  const dayOfWeek = refDate.getDay(); // 0 = zo, 1 = ma, 2 = di, etc.
  
  let daysToAdd = 0;
  if (dayOfWeek === 0) {
    // Als het zondag is, ga 1 dag vooruit naar maandag
    daysToAdd = 1;
  } else if (dayOfWeek > 1) {
    // Als het dinsdag of later is, ga terug naar vorige maandag
    daysToAdd = 1 - dayOfWeek; // negatief getal
  }
  // Als dayOfWeek === 1 (maandag), blijft daysToAdd 0
  
  const firstMonday = new Date(refDate);
  firstMonday.setDate(refDate.getDate() + daysToAdd);
  firstMonday.setHours(0, 0, 0, 0); // Reset tijd naar middernacht
  
  console.log('📅 getDaysInRangeStartingMonday:', {
    inputDate: referenceDate.toISOString().split('T')[0],
    inputDayOfWeek: ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'][dayOfWeek],
    daysToAdd,
    firstMonday: firstMonday.toISOString().split('T')[0],
    firstMondayDayOfWeek: firstMonday.getDay() === 1 ? 'maandag ✅' : `FOUT: ${firstMonday.getDay()}`
  });
  
  // Genereer 35 dagen vanaf deze eerste maandag
  const dates: Date[] = [];
  for (let i = 0; i < 35; i++) {
    const date = new Date(firstMonday);
    date.setDate(firstMonday.getDate() + i);
    dates.push(date);
  }
  
  console.log('📊 Gegenereerde periode:', {
    start: dates[0].toISOString().split('T')[0],
    eind: dates[34].toISOString().split('T')[0],
    totaalDagen: dates.length
  });
  
  return dates;
}

/**
 * ✨ Helper: Team kleur bepalen voor indicator cirkel
 */
function getTeamColor(team: string): string {
  if (team === 'Groen') return 'bg-green-500';
  if (team === 'Oranje') return 'bg-orange-500';
  return 'bg-blue-600'; // Overig
}

/**
 * ✨ Helper: Medewerkers sorteren volgens specificatie
 * 1. Team (Groen → Oranje → Overig)
 * 2. Dienstverband (Maat → Loondienst → ZZP)
 * 3. Voornaam (alfabetisch A-Z)
 */
function sortEmployees(empArray: any[]): any[] {
  const teamOrder: Record<string, number> = { 'Groen': 0, 'Oranje': 1, 'Overig': 2 };
  const dienstOrder: Record<string, number> = { 'Maat': 0, 'Loondienst': 1, 'ZZP': 2 };
  
  return empArray.slice().sort((a, b) => {
    // 1. Team sortering
    const teamA = teamOrder[a.team] ?? 999;
    const teamB = teamOrder[b.team] ?? 999;
    if (teamA !== teamB) {
      return teamA - teamB;
    }
    
    // 2. Dienstverband sortering
    const dienstA = dienstOrder[a.dienstverband] ?? 999;
    const dienstB = dienstOrder[b.dienstverband] ?? 999;
    if (dienstA !== dienstB) {
      return dienstA - dienstB;
    }
    
    // 3. Voornaam alfabetisch
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rosterId) {
      router.push('/planning');
      return;
    }
    (async function loadData() {
      try {
        const data = await loadRosterDesignData(rosterId);
        setDesignData(data);
        
        console.log('✅ Loaded unavailability data (DRAAD68 - dagdeel ondersteuning):', {
          rosterId,
          employeeCount: data?.employees?.length || 0,
          startDate: data?.start_date
        });
      } catch (error) {
        console.error('❌ Error loading unavailability data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [rosterId, router]);

  /**
   * DRAAD68: Toggle NB per dagdeel
   */
  async function handleToggleUnavailable(emp: any, date: string, dagdeel: 'O' | 'M' | 'A') {
    if (!rosterId) return;
    
    const employeeId = emp.originalEmployeeId || emp.id;
    
    console.log('🔍 Toggle NB click:', {
      rosterId,
      employeeId,
      date,
      dagdeel,
      empName: emp.voornaam || emp.name
    });
    
    // TODO LATER: check roster_assignments per dagdeel
    // Voor nu: simpele toggle zonder check
    
    const success = await toggleNBAssignment(rosterId, employeeId, date, dagdeel);
    
    if (success) {
      console.log('✅ Toggle succeeded, reloading data');
      const updated = await loadRosterDesignData(rosterId);
      setDesignData(updated);
      console.log('✅ UI updated with new NB status');
    } else {
      console.error('❌ Toggle failed');
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
  
  // ✅ FIX DRAAD26R: Gebruik getDaysInRangeStartingMonday() voor correcte startdatum
  const referenceDate = designData.start_date 
    ? new Date(designData.start_date + 'T00:00:00')
    : new Date();
  
  const dates = getDaysInRangeStartingMonday(referenceDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Niet Beschikbaar aanpassen (per dagdeel)</h1>
            <p className="text-gray-600 text-sm">Klik op een cel om een medewerker niet-beschikbaar te markeren voor specifiek dagdeel (O/M/A)</p>
          </div>
          <button 
            onClick={()=>router.push(`/planning/design/dashboard?rosterId=${rosterId}`)} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <span>←</span>
            <span>Terug naar Dashboard</span>
          </button>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            <strong>Instructie:</strong> Klik op een <strong>lege cel</strong> om een medewerker niet-beschikbaar (NB) te maken voor dat dagdeel. 
            Klik op een <strong>rode cel (NB)</strong> om deze beschikbaar te maken. 
            Elke dag heeft 3 kolommen: <strong>O</strong> (Ochtend 09:00-13:00), <strong>M</strong> (Middag 13:00-18:00), <strong>A</strong> (Avond/Nacht 18:00-09:00).
          </p>
        </div>
        
        {/* ✨ Responsive container met overflow-x */}
        <div className="bg-white rounded-xl shadow-lg p-6 overflow-x-auto" style={{ maxWidth: '100vw' }}>
          <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th className="border border-gray-300 p-3 bg-gray-100 sticky left-0 z-10 font-semibold text-gray-900">
                  Medewerker
                </th>
                {dates.map((date, idx) => {
                  const dayOfWeek = date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  return (
                    <th 
                      key={idx}
                      colSpan={3} // DRAAD68: 3 kolommen per dag
                      className={`border border-gray-300 p-2 text-xs font-medium ${
                        isWeekend ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold">
                        {['Zo','Ma','Di','Wo','Do','Vr','Za'][dayOfWeek]}
                      </div>
                      <div className="text-gray-600">
                        {date.getDate()}/{date.getMonth()+1}
                      </div>
                      {/* DRAAD68: Dagdeel labels */}
                      <div className="flex justify-around mt-1 text-[10px] text-gray-500">
                        <span>O</span>
                        <span>M</span>
                        <span>A</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* ✨ Gesorteerde medewerkers met team-indicator en naam-truncatie */}
              {sortEmployees(designData.employees || []).map((emp: any) => {
                const employeeId = emp.originalEmployeeId || emp.id;
                const fullName = emp.voornaam || emp.name || 'Onbekend';
                const shortName = fullName.length > 10 ? fullName.slice(0, 10) + '...' : fullName;
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
                          className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${teamColor}`} 
                          title={`Team ${emp.team || 'Overig'}`}
                        ></span>
                        <span>{shortName}</span>
                      </div>
                    </td>
                    {dates.map((date, dateIdx) => {
                      const dateStr = date.toISOString().split('T')[0];
                      
                      // Haal unavailability data op voor deze medewerker en datum
                      const unavailData = designData.unavailabilityData?.[employeeId]?.[dateStr];
                      
                      // DRAAD68: Render 3 cellen per dag (O, M, A)
                      return ['O', 'M', 'A'].map((dagdeel) => {
                        // Check of dit dagdeel NB is
                        const isNB = isDagdeelUnavailable(unavailData, dagdeel as 'O' | 'M' | 'A');
                        
                        // TODO LATER: check roster_assignments per dagdeel voor ingeplande diensten
                        
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
                          <td 
                            key={`${dateIdx}-${dagdeel}`}
                            className={cellClass + cursorClass}
                            onClick={() => handleToggleUnavailable(emp, dateStr, dagdeel as 'O' | 'M' | 'A')}
                            title={title}
                          >
                            {isNB && (
                              <span className="text-lg font-bold text-red-800">✕</span>
                            )}
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
        
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3 text-gray-900">Legenda</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white border border-gray-300 rounded"></div>
              <span className="text-gray-700">Beschikbaar (leeg)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-200 border border-gray-300 rounded flex items-center justify-center text-lg font-bold text-red-800">✕</div>
              <span className="text-gray-700">Niet Beschikbaar (NB)</span>
            </div>
            {/* DRAAD68: Dagdeel labels */}
            <div className="border-l pl-4 ml-2">
              <span className="text-gray-600 font-medium">Dagdelen:</span>
              <div className="flex gap-3 mt-1">
                <span className="text-gray-700">O = Ochtend (09:00-13:00)</span>
                <span className="text-gray-700">M = Middag (13:00-18:00)</span>
                <span className="text-gray-700">A = Avond/Nacht (18:00-09:00)</span>
              </div>
            </div>
            {/* ✨ Team kleuren legenda */}
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-gray-700">Team Groen</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span>
              <span className="text-gray-700">Team Oranje</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-600"></span>
              <span className="text-gray-700">Team Overig</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-center text-sm text-gray-600">
          Wijzigingen worden automatisch opgeslagen
        </div>
      </div>
    </div>
  );
}