'use client';

import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar, Sun, Sunset, Moon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface RosterInfo {
  id: string;
  naam: string;
  start_date: string;
  end_date: string;
}

interface Service {
  id: string;
  naam: string;
  code: string;
  kleur: string;
}

interface RosterPeriodStaffing {
  id: string;
  roster_id: string;
  service_id: string;
  date: string;
  min_staff: number;
  max_staff: number;
}

interface DagdeelAssignment {
  id?: string;
  roster_period_staffing_id: string;
  dagdeel: string;
  team: string;
  status: string;
  aantal: number;
  created_at?: string;
  updated_at?: string;
}

interface CellData {
  rpsId: string;
  serviceId: string;
  date: string;
  dagdeel: string;
  team: string;
  status: string;
  aantal: number;
  assignmentId?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekDates(weekNumber: number, year: number): Date[] {
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dayOfWeek = simple.getDay();
  const ISOweekStart = simple;
  if (dayOfWeek <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(ISOweekStart);
    date.setDate(ISOweekStart.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

function getDayName(date: Date): string {
  const days = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];
  return days[date.getDay()];
}

function isWeekendDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ============================================================================
// MAIN CONTENT COMPONENT
// ============================================================================

function DienstenPerDagContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rosterId = searchParams?.get('rosterId');

  // State
  const [rosterInfo, setRosterInfo] = useState<RosterInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [rpsRecords, setRpsRecords] = useState<RosterPeriodStaffing[]>([]);
  const [dagdeelAssignments, setDagdeelAssignments] = useState<DagdeelAssignment[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(getWeekNumber(new Date()));
  const [currentYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dagdelen = ['ochtend', 'middag', 'avond'];
  const teams = ['GRO', 'ORA', 'PRA']; // Groen, Oranje, Praktijk

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    async function loadData() {
      if (!rosterId) {
        setError('Geen rooster ID gevonden');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1. Haal roster info uit localStorage (zoals Dashboard doet)
        if (typeof window === 'undefined') {
          throw new Error('Browser omgeving niet beschikbaar');
        }

        const rostersRaw = localStorage.getItem('verloskunde_rosters');
        if (!rostersRaw) {
          throw new Error('Geen rosters gevonden. Maak eerst een rooster aan.');
        }

        let rosters;
        try {
          rosters = JSON.parse(rostersRaw);
        } catch (parseError) {
          throw new Error('Ongeldige roster data');
        }

        const rosterData = rosters.find((r: any) => r.id === rosterId);
        if (!rosterData) {
          throw new Error(`Rooster niet gevonden`);
        }

        const roster: RosterInfo = {
          id: rosterData.id,
          naam: rosterData.naam || rosterData.name || 'Naamloos Rooster',
          start_date: rosterData.start_date || rosterData.startDate || rosterData.roster_start,
          end_date: rosterData.end_date || rosterData.endDate || rosterData.roster_end
        };

        if (!roster.start_date || !roster.end_date) {
          throw new Error('Roster periode ontbreekt');
        }

        setRosterInfo(roster);

        // 2. Haal roster_period_staffing records voor dit rooster
        const { data: rpsData, error: rpsError } = await supabase
          .from('roster_period_staffing')
          .select('*')
          .eq('roster_id', rosterId);

        if (rpsError) throw rpsError;
        setRpsRecords(rpsData || []);

        // 3. Haal unieke services uit deze RPS records
        const uniqueServiceIds = [...new Set((rpsData || []).map(r => r.service_id))];
        
        if (uniqueServiceIds.length > 0) {
          const { data: servicesData, error: servicesError } = await supabase
            .from('service_types')
            .select('*')
            .in('id', uniqueServiceIds)
            .eq('actief', true)
            .order('naam');

          if (servicesError) throw servicesError;
          setServices(servicesData || []);
        } else {
          setServices([]);
        }

        // 4. Haal alle dagdeel assignments voor dit rooster
        const { data: dagdeelData, error: dagdeelError } = await supabase
          .from('roster_period_staffing_dagdelen')
          .select(`
            *,
            roster_period_staffing!inner(roster_id)
          `)
          .eq('roster_period_staffing.roster_id', rosterId);

        if (dagdeelError) {
          console.error('Error loading dagdeel assignments:', dagdeelError);
        }
        
        setDagdeelAssignments(dagdeelData || []);
        setError(null);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Fout bij laden van gegevens');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [rosterId]);

  // ============================================================================
  // CELL DATA HELPER
  // ============================================================================

  function getCellData(serviceId: string, date: string, dagdeel: string, team: string): CellData | null {
    // Zoek RPS record voor deze dienst + datum
    const rps = rpsRecords.find(r => 
      r.service_id === serviceId && 
      r.date === date
    );

    if (!rps) {
      return null;
    }

    // Zoek dagdeel assignment
    const assignment = dagdeelAssignments.find(a =>
      a.roster_period_staffing_id === rps.id &&
      a.dagdeel === dagdeel &&
      a.team === team
    );

    return {
      rpsId: rps.id,
      serviceId,
      date,
      dagdeel,
      team,
      status: assignment?.status || 'MAG',
      aantal: assignment?.aantal || 0,
      assignmentId: assignment?.id
    };
  }

  // ============================================================================
  // HANDLE CELL CHANGE
  // ============================================================================

  async function handleCellChange(cellData: CellData, newAantal: number) {
    if (!rosterId) return;

    const oldAantal = cellData.aantal;
    const oldStatus = cellData.status;

    // Validatie
    if (newAantal < 0 || newAantal > 9) {
      alert('Aantal moet tussen 0 en 9 zijn');
      return;
    }

    // Bepaal of waarschuwing nodig is
    let needsWarning = false;
    let warningMessage = '';
    let newStatus = oldStatus;

    if (oldStatus === 'MOET' && newAantal === 0) {
      needsWarning = true;
      warningMessage = 'WAARSCHUWING: Dit is een MOET dienst. Weet u zeker dat u deze op 0 wilt zetten?';
      newStatus = 'AANGEPAST';
    } else if (oldStatus === 'MAG NIET' && newAantal !== 0) {
      needsWarning = true;
      warningMessage = 'WAARSCHUWING: Dit is een MAG NIET dienst. Weet u zeker dat u een aantal wilt invoeren?';
      newStatus = 'AANGEPAST';
    } else if (oldStatus === 'MOET' && newAantal !== oldAantal) {
      newStatus = 'AANGEPAST';
    } else if (oldStatus === 'MAG NIET' && newAantal !== 0) {
      newStatus = 'AANGEPAST';
    }

    // Toon waarschuwing indien nodig
    if (needsWarning) {
      const confirmed = confirm(warningMessage);
      if (!confirmed) {
        return; // Gebruiker annuleert
      }
    }

    try {
      if (cellData.assignmentId) {
        // Update bestaande assignment
        const { error } = await supabase
          .from('roster_period_staffing_dagdelen')
          .update({ 
            aantal: newAantal,
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', cellData.assignmentId);

        if (error) throw error;

        // Update lokale state
        setDagdeelAssignments(prev =>
          prev.map(a => 
            a.id === cellData.assignmentId 
              ? { ...a, aantal: newAantal, status: newStatus }
              : a
          )
        );
      } else {
        // Nieuwe assignment aanmaken
        const newAssignment: DagdeelAssignment = {
          roster_period_staffing_id: cellData.rpsId,
          dagdeel: cellData.dagdeel,
          team: cellData.team,
          status: newStatus,
          aantal: newAantal
        };

        const { data, error } = await supabase
          .from('roster_period_staffing_dagdelen')
          .insert(newAssignment)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setDagdeelAssignments(prev => [...prev, data]);
        }
      }
    } catch (err: any) {
      console.error('Error saving:', err);
      alert('Fout bij opslaan: ' + err.message);
    }
  }

  // ============================================================================
  // WEEK NAVIGATION
  // ============================================================================

  function canGoToPreviousWeek(): boolean {
    if (!rosterInfo) return false;
    const weekDates = getWeekDates(currentWeek - 1, currentYear);
    const weekStart = formatDate(weekDates[0]);
    return weekStart >= rosterInfo.start_date;
  }

  function canGoToNextWeek(): boolean {
    if (!rosterInfo) return false;
    const weekDates = getWeekDates(currentWeek + 1, currentYear);
    const weekEnd = formatDate(weekDates[6]);
    return weekEnd <= rosterInfo.end_date;
  }

  function handlePreviousWeek() {
    if (canGoToPreviousWeek()) {
      setCurrentWeek(prev => prev - 1);
    }
  }

  function handleNextWeek() {
    if (canGoToNextWeek()) {
      setCurrentWeek(prev => prev + 1);
    }
  }

  // ============================================================================
  // STATUS COLOR HELPER
  // ============================================================================

  function getStatusColor(status: string): string {
    switch (status) {
      case 'MOET':
        return 'bg-red-500';
      case 'MAG':
        return 'bg-green-500';
      case 'MAG NIET':
        return 'bg-gray-400';
      case 'AANGEPAST':
        return 'bg-blue-500';
      default:
        return 'bg-gray-300';
    }
  }

  // ============================================================================
  // DAGDEEL ICON HELPER
  // ============================================================================

  function getDagdeelIcon(dagdeel: string) {
    switch (dagdeel) {
      case 'ochtend':
        return <Sun className="w-4 h-4" />;
      case 'middag':
        return <Sunset className="w-4 h-4" />;
      case 'avond':
        return <Moon className="w-4 h-4" />;
      default:
        return null;
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  const weekDates = getWeekDates(currentWeek, currentYear);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Diensten per dagdeel wordt geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !rosterInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error || 'Rooster niet gevonden'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Terug naar Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/dashboard?rosterId=${rosterId}`)}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Diensten per Dagdeel
        </h1>
        <p className="text-gray-600">
          Rooster: <span className="font-semibold">{rosterInfo.naam}</span>
        </p>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
        {canGoToPreviousWeek() ? (
          <button
            onClick={handlePreviousWeek}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Vorige Week
          </button>
        ) : (
          <div className="w-32"></div>
        )}
        
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-blue-600" />
          Week {currentWeek}, {currentYear}
        </div>
        
        {canGoToNextWeek() ? (
          <button
            onClick={handleNextWeek}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Volgende Week
            <ChevronRight className="h-4 w-4 ml-2" />
          </button>
        ) : (
          <div className="w-32"></div>
        )}
      </div>

      {/* Instructie */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          <strong>Instructie:</strong> Stel per dienst het minimale en maximale aantal benodigde medewerkers in per dagdeel en team.
          Klik op de cellen om het aantal aan te passen (0-9).
        </p>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h3 className="font-semibold mb-3 text-gray-900">Status Legenda:</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-700"><strong>MOET</strong> - Vereist minimum (standaard: 1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-700"><strong>MAG</strong> - Optioneel (standaard: 1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-400"></div>
            <span className="text-sm text-gray-700"><strong>MAG NIET</strong> - Niet toegestaan (standaard: 0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-sm text-gray-700"><strong>AANGEPAST</strong> - Handmatig gewijzigd van de regel</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {/* Week Header */}
              <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <th className="border border-blue-500 p-3 text-left sticky left-0 bg-blue-600 z-10">
                  <div className="text-sm font-semibold">Week {currentWeek}</div>
                </th>
                {weekDates.map((date, idx) => (
                  <th
                    key={idx}
                    colSpan={3}
                    className={`border border-blue-500 p-2 text-center ${
                      isWeekendDay(date) ? 'bg-blue-800' : ''
                    }`}
                  >
                    <div className="text-xs font-medium">{getDayName(date)}</div>
                    <div className="text-sm font-bold">{formatDateDisplay(date)}</div>
                  </th>
                ))}
              </tr>
              
              {/* Dagdeel Icons Row */}
              <tr className="bg-blue-100">
                <th className="border border-gray-300 p-2 text-left sticky left-0 bg-blue-100 z-10">
                  <span className="text-xs font-semibold text-gray-700">Dienst / Team</span>
                </th>
                {weekDates.map((date, dateIdx) => (
                  dagdelen.map((dagdeel, dagdeelIdx) => (
                    <th
                      key={`${dateIdx}-${dagdeelIdx}`}
                      className={`border border-gray-300 p-2 text-center ${
                        isWeekendDay(date) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center text-gray-600">
                        {getDagdeelIcon(dagdeel)}
                      </div>
                    </th>
                  ))
                ))}
              </tr>
            </thead>

            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td
                    colSpan={22}
                    className="border border-gray-300 p-8 text-center text-gray-500"
                  >
                    Geen diensten gevonden voor dit rooster. Ga naar Dashboard om diensten toe te voegen.
                  </td>
                </tr>
              ) : (
                services.map((service, serviceIdx) => (
                  teams.map((team, teamIdx) => {
                    const isFirstTeamRow = teamIdx === 0;
                    const teamLabel = team === 'GRO' ? 'Groen' : team === 'ORA' ? 'Oranje' : 'Praktijk';
                    const teamColor = team === 'GRO' ? 'bg-green-50' : team === 'ORA' ? 'bg-orange-50' : 'bg-purple-50';

                    return (
                      <tr key={`${service.id}-${team}`} className={`hover:bg-gray-50 ${teamColor}`}>
                        <td className={`border border-gray-300 p-3 sticky left-0 ${teamColor} z-10`}>
                          {isFirstTeamRow && (
                            <div className="font-semibold text-gray-900 mb-1">
                              <span 
                                className="inline-block px-2 py-1 rounded text-xs font-bold text-white mr-2"
                                style={{ backgroundColor: service.kleur || '#666' }}
                              >
                                {service.code}
                              </span>
                              {service.naam}
                            </div>
                          )}
                          <div className="text-sm text-gray-600 font-medium">
                            {teamLabel}
                          </div>
                        </td>

                        {weekDates.map((date, dateIdx) => (
                          dagdelen.map((dagdeel, dagdeelIdx) => {
                            const cellData = getCellData(
                              service.id,
                              formatDate(date),
                              dagdeel,
                              team
                            );

                            if (!cellData) {
                              return (
                                <td
                                  key={`${dateIdx}-${dagdeelIdx}`}
                                  className={`border border-gray-300 p-1 text-center ${
                                    isWeekendDay(date) ? 'bg-gray-100' : 'bg-white'
                                  }`}
                                >
                                  <div className="text-xs text-gray-400">-</div>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={`${dateIdx}-${dagdeelIdx}`}
                                className={`border border-gray-300 p-1 text-center ${
                                  isWeekendDay(date) ? 'bg-gray-50' : 'bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <div
                                    className={`w-3 h-3 rounded-full ${getStatusColor(cellData.status)}`}
                                    title={cellData.status}
                                  ></div>
                                  <input
                                    type="number"
                                    min="0"
                                    max="9"
                                    value={cellData.aantal}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      handleCellChange(cellData, val);
                                    }}
                                    className="w-8 h-7 text-center text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                              </td>
                            );
                          })
                        ))}
                      </tr>
                    );
                  })
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
        <div className="text-sm text-gray-600">
          <p><strong>Totaal diensten:</strong> {services.length}</p>
          <p><strong>Totaal dagdeel records:</strong> {dagdeelAssignments.length}</p>
          <p className="mt-2 text-xs text-gray-500">
            Periode: {rosterInfo.start_date} tot {rosterInfo.end_date}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function DienstenPerDagPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Pagina wordt geladen...</p>
        </div>
      </div>
    }>
      <DienstenPerDagContent />
    </Suspense>
  );
}