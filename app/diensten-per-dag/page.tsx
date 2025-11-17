'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getDagdeelRegelsVoorRooster,
  updateDagdeelRegelSmart
} from '@/lib/services/roster-period-staffing-dagdelen-storage';
import {
  RosterPeriodStaffingDagdeel,
  DAGDEEL_LABELS,
  TEAM_DAGDEEL_LABELS,
  DAGDEEL_STATUS_COLORS,
  Dagdeel,
  TeamDagdeel,
  DagdeelStatus
} from '@/lib/types/roster-period-staffing-dagdeel';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

interface RosterPeriodStaffing {
  id: string;
  roster_id: string;
  service_id: string;
  date: string;
  dagdelen: RosterPeriodStaffingDagdeel[];
}

interface ServiceInfo {
  id: string;
  code: string;
  naam: string;
}

interface WeekData {
  weekNummer: number;
  startDatum: Date;
  eindDatum: Date;
  dagen: Date[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ROOSTER_WEKEN = [48, 49, 50, 51, 52] as const;
const JAAR = 2025;

const DAGEN_KORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const DAGDELEN: Dagdeel[] = ['0', 'M', 'A'];
const TEAMS: TeamDagdeel[] = ['TOT', 'GRO', 'ORA'];

// ============================================================================
// HELPER FUNCTIES
// ============================================================================

function getWeekData(weekNummer: number, jaar: number): WeekData {
  // ISO week: week begint op maandag
  const jan4 = new Date(jaar, 0, 4);
  const jan4DayOfWeek = jan4.getDay() || 7; // Zondag = 7
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - jan4DayOfWeek + 1);
  
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNummer - 1) * 7);
  
  const dagen: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dag = new Date(weekStart);
    dag.setDate(weekStart.getDate() + i);
    dagen.push(dag);
  }
  
  const weekEind = new Date(weekStart);
  weekEind.setDate(weekStart.getDate() + 6);
  
  return {
    weekNummer,
    startDatum: weekStart,
    eindDatum: weekEind,
    dagen
  };
}

function formatDatum(datum: Date): string {
  const dag = datum.getDate().toString().padStart(2, '0');
  const maand = (datum.getMonth() + 1).toString().padStart(2, '0');
  return `${dag}/${maand}`;
}

function dateToString(datum: Date): string {
  const jaar = datum.getFullYear();
  const maand = (datum.getMonth() + 1).toString().padStart(2, '0');
  const dag = datum.getDate().toString().padStart(2, '0');
  return `${jaar}-${maand}-${dag}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DienstenPerDagPage() {
  const router = useRouter();
  
  // State
  const [huidigWeekIndex, setHuidigWeekIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterId, setRosterId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [dagdelenData, setDagdelenData] = useState<Map<string, RosterPeriodStaffingDagdeel[]>>(new Map());
  const [rpsRecords, setRpsRecords] = useState<RosterPeriodStaffing[]>([]);
  const [bewerkingActief, setBewerkingActief] = useState<string | null>(null);
  const [waarschuwing, setWaarschuwing] = useState<string | null>(null);
  
  const huidigWeek = ROOSTER_WEKEN[huidigWeekIndex];
  const weekData = getWeekData(huidigWeek, JAAR);
  
  // ============================================================================
  // DATA LADEN
  // ============================================================================
  
  useEffect(() => {
    loadData();
  }, [huidigWeekIndex]);
  
  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Haal actief rooster op
      const { data: roosterData, error: roosterError } = await supabase
        .from('rosters')
        .select('id, naam, start_date, end_date')
        .eq('actief', true)
        .single();
      
      if (roosterError) throw new Error('Geen actief rooster gevonden');
      if (!roosterData) throw new Error('Geen rooster data');
      
      setRosterId(roosterData.id);
      
      // 2. Haal services op
      const { data: servicesData, error: servicesError } = await supabase
        .from('service_types')
        .select('id, code, naam')
        .eq('actief', true)
        .order('code');
      
      if (servicesError) throw servicesError;
      setServices(servicesData || []);
      
      // 3. Haal roster_period_staffing op voor huidige week
      const weekStartStr = dateToString(weekData.startDatum);
      const weekEindStr = dateToString(weekData.eindDatum);
      
      const { data: rpsData, error: rpsError } = await supabase
        .from('roster_period_staffing')
        .select('id, roster_id, service_id, date')
        .eq('roster_id', roosterData.id)
        .gte('date', weekStartStr)
        .lte('date', weekEindStr);
      
      if (rpsError) throw rpsError;
      
      // 4. Haal alle dagdelen op voor deze RPS records
      const rpsIds = (rpsData || []).map(r => r.id);
      
      if (rpsIds.length > 0) {
        const { data: dagdelenData, error: dagdelenError } = await supabase
          .from('roster_period_staffing_dagdelen')
          .select('*')
          .in('roster_period_staffing_id', rpsIds)
          .order('team')
          .order('dagdeel');
        
        if (dagdelenError) throw dagdelenError;
        
        // Groepeer dagdelen per RPS ID
        const dagdelenMap = new Map<string, RosterPeriodStaffingDagdeel[]>();
        
        for (const rps of rpsData || []) {
          const regelsVoorRps = (dagdelenData || []).filter(
            d => d.roster_period_staffing_id === rps.id
          ) as RosterPeriodStaffingDagdeel[];
          
          dagdelenMap.set(rps.id, regelsVoorRps);
        }
        
        setDagdelenData(dagdelenMap);
        setRpsRecords((rpsData || []).map(rps => ({
          ...rps,
          dagdelen: dagdelenMap.get(rps.id) || []
        })));
      }
      
    } catch (err) {
      console.error('Fout bij laden data:', err);
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  function getRPSForServiceAndDate(serviceId: string, datum: Date): RosterPeriodStaffing | undefined {
    const datumStr = dateToString(datum);
    return rpsRecords.find(rps => 
      rps.service_id === serviceId && rps.date === datumStr
    );
  }
  
  function getDagdeelRegel(
    rps: RosterPeriodStaffing | undefined,
    dagdeel: Dagdeel,
    team: TeamDagdeel
  ): RosterPeriodStaffingDagdeel | undefined {
    if (!rps) return undefined;
    return rps.dagdelen.find(d => d.dagdeel === dagdeel && d.team === team);
  }
  
  async function handleAantalWijzigen(
    regel: RosterPeriodStaffingDagdeel,
    nieuwAantal: number
  ) {
    if (nieuwAantal < 0 || nieuwAantal > 9) {
      setWaarschuwing('Aantal moet tussen 0 en 9 zijn');
      setTimeout(() => setWaarschuwing(null), 3000);
      return;
    }
    
    const result = await updateDagdeelRegelSmart(
      regel.id,
      regel.status,
      nieuwAantal,
      regel
    );
    
    if (result.waarschuwing) {
      setWaarschuwing(result.waarschuwing);
      setTimeout(() => setWaarschuwing(null), 5000);
    }
    
    if (result.success) {
      // Herlaad data
      await loadData();
      setBewerkingActief(null);
    } else {
      setWaarschuwing('Fout bij opslaan wijziging');
      setTimeout(() => setWaarschuwing(null), 3000);
    }
  }
  
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  function renderDagdeelCel(
    rps: RosterPeriodStaffing | undefined,
    dagdeel: Dagdeel,
    team: TeamDagdeel,
    serviceCode: string,
    datumStr: string
  ) {
    const regel = getDagdeelRegel(rps, dagdeel, team);
    
    if (!regel) {
      return (
        <div className="p-1 text-xs text-gray-400 text-center">
          -
        </div>
      );
    }
    
    const celKey = `${regel.id}`;
    const isBewerken = bewerkingActief === celKey;
    const bgColor = DAGDEEL_STATUS_COLORS[regel.status];
    
    return (
      <div
        key={celKey}
        className="relative p-1 text-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
        style={{ backgroundColor: bgColor + '30' }}
        onClick={() => setBewerkingActief(celKey)}
        title={`${TEAM_DAGDEEL_LABELS[team]} - ${DAGDEEL_LABELS[dagdeel]}\nStatus: ${regel.status}\nAantal: ${regel.aantal}\nKlik om te bewerken`}
      >
        {isBewerken ? (
          <input
            type="number"
            min="0"
            max="9"
            value={regel.aantal}
            onChange={(e) => handleAantalWijzigen(regel, parseInt(e.target.value) || 0)}
            onBlur={() => setBewerkingActief(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setBewerkingActief(null);
              if (e.key === 'Escape') setBewerkingActief(null);
            }}
            className="w-full text-center text-sm font-bold border-2 border-blue-500 rounded px-1"
            style={{ color: bgColor }}
            autoFocus
          />
        ) : (
          <div
            className="text-sm font-bold"
            style={{ color: bgColor }}
          >
            {regel.aantal}
          </div>
        )}
      </div>
    );
  }
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold mb-2">Fout bij laden</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Terug naar Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Diensten per Dag - Dagdeel Bezetting
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Klik op een cel om het aantal personen aan te passen (0-9)
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              ← Terug naar Dashboard
            </button>
          </div>
          
          {/* Week navigatie */}
          <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
            <button
              onClick={() => setHuidigWeekIndex(Math.max(0, huidigWeekIndex - 1))}
              disabled={huidigWeekIndex === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              ← Vorige
            </button>
            
            <div className="text-center">
              <div className="text-lg font-bold text-blue-900">
                Week {huidigWeek} - {JAAR}
              </div>
              <div className="text-sm text-blue-700">
                {formatDatum(weekData.startDatum)} t/m {formatDatum(weekData.eindDatum)}
              </div>
            </div>
            
            <button
              onClick={() => setHuidigWeekIndex(Math.min(ROOSTER_WEKEN.length - 1, huidigWeekIndex + 1))}
              disabled={huidigWeekIndex === ROOSTER_WEKEN.length - 1}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              Volgende →
            </button>
          </div>
          
          {/* Legenda */}
          <div className="mt-3 flex gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: DAGDEEL_STATUS_COLORS.MOET + '80' }}></div>
              <span>MOET (verplicht)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: DAGDEEL_STATUS_COLORS.MAG + '80' }}></div>
              <span>MAG (optioneel)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: DAGDEEL_STATUS_COLORS.MAG_NIET + '80' }}></div>
              <span>MAG_NIET (niet toegestaan)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: DAGDEEL_STATUS_COLORS.AANGEPAST + '80' }}></div>
              <span>AANGEPAST (handmatig)</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Waarschuwing toast */}
      {waarschuwing && (
        <div className="fixed top-20 right-4 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded shadow-lg z-30 max-w-md">
          <div className="flex items-center">
            <span className="text-yellow-700 font-medium">⚠️ {waarschuwing}</span>
          </div>
        </div>
      )}
      
      {/* Grid */}
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 sticky top-[120px] z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 border-r border-gray-300 w-24">
                    Dienst
                  </th>
                  {weekData.dagen.map((dag, idx) => (
                    <th
                      key={idx}
                      className="px-2 py-2 text-center text-xs font-bold text-gray-700 border-r border-gray-300"
                    >
                      <div>{DAGEN_KORT[idx]}</div>
                      <div className="text-gray-500 font-normal">{formatDatum(dag)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 border-r border-gray-300 bg-gray-50">
                      <div className="font-bold">{service.code}</div>
                      <div className="text-xs text-gray-600">{service.naam}</div>
                    </td>
                    {weekData.dagen.map((dag, dagIdx) => {
                      const rps = getRPSForServiceAndDate(service.id, dag);
                      return (
                        <td key={dagIdx} className="border-r border-gray-300 p-0">
                          <div className="grid grid-cols-3 divide-x divide-gray-200">
                            {TEAMS.map((team) => (
                              <div key={team} className="divide-y divide-gray-200">
                                {DAGDELEN.map((dagdeel) => 
                                  renderDagdeelCel(
                                    rps,
                                    dagdeel,
                                    team,
                                    service.code,
                                    dateToString(dag)
                                  )
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Info sectie */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4 text-sm">
          <h3 className="font-bold text-blue-900 mb-2">💡 Gebruiksinstructies</h3>
          <ul className="space-y-1 text-blue-800">
            <li>• <strong>Klik</strong> op een cel om het aantal personen aan te passen (0-9)</li>
            <li>• <strong>Enter</strong> of klik buiten het veld om de wijziging op te slaan</li>
            <li>• <strong>Escape</strong> om te annuleren</li>
            <li>• Elke cel toont 3 dagdelen (Ochtend/Middag/Avond) voor 3 teams (Totaal/Groen/Oranje)</li>
            <li>• Kleur geeft de status weer: Rood=MOET, Groen=MAG, Grijs=MAG_NIET, Blauw=AANGEPAST</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
