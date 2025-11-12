// Restored volledige werkende rooster UI uit commit f3ac2d658f2a0b68cc1614f6145388fe78479f0e
// Alleen router push aangepast naar '/planning/design/dashboard'
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability, autofillUnavailability, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType, DienstverbandType } from '@/lib/types/employee';

function extractTeamRaw(team: unknown): string {
  if (team && typeof team === 'object') {
    const t = team as any;
    return String(t.name ?? t.label ?? t.code ?? t.value ?? '');
  }
  return String(team ?? '');
}
function normalizeTeam(input: unknown): 'Groen' | 'Oranje' | 'Overig' {
  const raw = extractTeamRaw(input).normalize('NFKD').replace(/[-\u000f]/g,'');
  const s = raw.trim().toLowerCase();
  if (/(^|\b)groen(e|en)?\b|green|\bg\b/.test(s)) return 'Groen';
  if (/(^|\b)oranje\b|orange|\bo\b/.test(s)) return 'Oranje';
  if (/(^|\b)overig(e|en)?\b|other|rest|divers|overige|overigen/.test(s)) return 'Overig';
  return 'Overig';
}
function normalizeDienstverband(value: any): DienstverbandType {
  if (!value) return DienstverbandType.LOONDIENST;
  const str = String(value).toLowerCase().trim();
  if (str === 'maat') return DienstverbandType.MAAT;
  if (str === 'loondienst') return DienstverbandType.LOONDIENST;
  if (str === 'zzp') return DienstverbandType.ZZP;
  return DienstverbandType.LOONDIENST;
}
const TEAM_COLORS_CANONICAL: Record<'Groen'|'Oranje'|'Overig', string> = {
  Groen: '#16a34a', Oranje: '#f59e0b', Overig: '#3b82f6'
};
function getTeamColor(teamData: any): string {
  const canonical = normalizeTeam(teamData);
  return TEAM_COLORS_CANONICAL[canonical] ?? '#94a3b8';
}
function TeamBadge({ team }: { team: TeamType | string }) {
  const color = getTeamColor(team);
  return <span aria-label={`Team ${extractTeamRaw(team)}`} title={`Team ${extractTeamRaw(team)}`} className="inline-block align-middle mr-2" style={{
    display: 'inline-block', width: 12, height: 12, borderRadius: 3, backgroundColor: color
  }} />
}
const MONTH_NAMES = [
  'januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'
];
function formatDutchDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
function formatDateCell(dateStr: string, holidaySet: Set<string>, holidays: Holiday[]): { day: string, date: string, month: string, isWeekend: boolean, isHoliday: boolean, holidayName?: string } {
  const date = new Date(dateStr + 'T00:00:00');
  const dayNames = ['ZO','MA','DI','WO','DO','VR','ZA'];
  const dayIndex = date.getDay();
  const day = dayNames[dayIndex];
  const dd = String(date.getDate()).padStart(2,'0');
  const mm = String(date.getMonth() + 1).padStart(2,'0');
  const isWeekend = dayIndex === 0 || dayIndex === 6;
  const isHoliday = holidaySet.has(dateStr);
  const holiday = isHoliday ? findHolidayByDate(holidays, dateStr) : undefined;
  return { day, date: dd, month: mm, isWeekend, isHoliday, holidayName: holiday?.name };
}
function columnClasses(dateStr: string, holidaySet: Set<string>): string {
  const date = new Date(dateStr + 'T00:00:00');
  const d = date.getDay();
  const isHoliday = holidaySet.has(dateStr);
  const leftWeekSep = d === 1 ? ' border-l-4 border-yellow-200' : '';
  let rim = '';
  if (d === 0 || d === 6) { rim = isHoliday ? ' border-x-2 border-amber-300' : ' border-x-2 border-yellow-300'; }
  else if (isHoliday) { rim = ' border-x-2 border-amber-300'; }
  return leftWeekSep + rim;
}
export default function DesignPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = searchParams.get('rosterId');
  const [designData, setDesignData] = useState<RosterDesignData | null>(null);
  const [employees, setEmployees] = useState<RosterEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const holidaySet = useMemo(() => createHolidaySet(holidays), [holidays]);
  const sortedEmployees = useMemo(() => {
    const teamOrder: Record<'Groen'|'Oranje'|'Overig', number> = { Groen: 0, Oranje: 1, Overig: 2 };
    const dienstOrder = [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP];
    return [...employees].sort((a, b) => {
      const teamA = normalizeTeam((a as any).team);
      const teamB = normalizeTeam((b as any).team);
      const t = (teamOrder[teamA] ?? 3) - (teamOrder[teamB] ?? 3);
      if (t !== 0) return t;
      const dienstA = normalizeDienstverband((a as any).dienstverband);
      const dienstB = normalizeDienstverband((b as any).dienstverband);
      const d = dienstOrder.indexOf(dienstA) - dienstOrder.indexOf(dienstB);
      if (d !== 0) return d;
      const nameA = (a as any).voornaam || (a as any).name || '';
      const nameB = (b as any).voornaam || (b as any).name || '';
      return nameA.localeCompare(nameB, 'nl', { sensitivity: 'base' });
    });
  }, [employees]);
  
  useEffect(() => {
    if (!rosterId) { 
      setError('Geen roster ID gevonden'); 
      setLoading(false); 
      return; 
    }
    
    // FIXED: Make entire data loading async with proper await
    async function fetchAndInitializeData() {
      try {
        setLoading(true);
        
        // Load roster design data with await
        const data = await loadRosterDesignData(rosterId);
        
        if (data) {
          // Sync employee data with await
          await syncRosterDesignWithEmployeeData(rosterId);
          
          const startISO = (data as any).start_date || (data as any).roster_start;
          
          // Autofill unavailability with await
          if (startISO) { 
            await autofillUnavailability(rosterId, startISO); 
          }
          
          // Reload data after autofill with await
          const latest = await loadRosterDesignData(rosterId) || data;
          setDesignData(latest);
          setEmployees(latest.employees);
          
          // Load holidays for period
          if (startISO) { 
            loadHolidaysForPeriod(startISO); 
          }
        } else { 
          setError('Geen rooster ontwerp data gevonden'); 
        }
      } catch (err) { 
        console.error('Error loading design data:', err);
        setError('Fout bij laden van ontwerp data'); 
      } finally {
        setLoading(false);
      }
    }
    
    fetchAndInitializeData();
  }, [rosterId]);
  
  async function loadHolidaysForPeriod(startISO: string) {
    setHolidaysLoading(true);
    try {
      const startDate = new Date(startISO + 'T00:00:00');
      const endDate = new Date(startDate); 
      endDate.setDate(startDate.getDate() + (4 * 7) + 6);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const fetchedHolidays = await fetchNetherlandsHolidays(startStr, endStr);
      setHolidays(fetchedHolidays);
    } catch { 
      /* ignore */ 
    }
    setHolidaysLoading(false);
  }
  
  // FIXED: Make updateMaxShiftsHandler async
  async function updateMaxShiftsHandler(empId: string, maxShifts: number) {
    if (!rosterId || !designData) return;
    
    await updateEmployeeMaxShifts(rosterId, empId, maxShifts);
    const updated = await loadRosterDesignData(rosterId);
    
    if (updated) {
      setDesignData(updated);
      setEmployees(updated.employees);
    }
  }
  
  // FIXED: Make toggleUnavailable async
  async function toggleUnavailableHandler(empId: string, date: string) {
    if (!rosterId || !designData) return;
    
    await toggleUnavailability(rosterId, empId, date);
    const updated = await loadRosterDesignData(rosterId);
    
    if (updated) {
      setDesignData(updated);
      setEmployees(updated.employees);
    }
  }
  
  function getFirstName(fullName: string): string { 
    return fullName.split(' ')[0]; 
  }
  
  const computedValues = useMemo(() => {
    if (!designData) {
      return { 
        startISO: new Date().toISOString().split('T')[0], 
        startDate: new Date(), 
        endDate: new Date(), 
        weeks: [], 
        periodTitle: '', 
        dateSubtitle: '' 
      };
    }
    const startISO = (designData as any).start_date || (designData as any).roster_start || new Date().toISOString().split('T')[0];
    const startDate = new Date(startISO + 'T00:00:00');
    const endDate = new Date(startDate); 
    endDate.setDate(startDate.getDate() + (4 * 7) + 6);
    const weeks = Array.from({ length: 5 }, (_, i) => {
      const weekStart = new Date(startDate); 
      weekStart.setDate(startDate.getDate() + (i * 7));
      const weekNumber = getWeekNumber(weekStart);
      return { 
        number: weekNumber, 
        dates: Array.from({ length: 7 }, (_, d) => { 
          const date = new Date(weekStart); 
          date.setDate(weekStart.getDate() + d); 
          return date.toISOString().split('T')[0]; 
        }) 
      };
    });
    const firstWeek = weeks[0];
    const lastWeek = weeks[weeks.length - 1];
    const periodTitle = `Rooster Ontwerp : Periode Week ${firstWeek?.number || ''} - Week ${lastWeek?.number || ''} ${startDate.getFullYear()}`;
    const dateSubtitle = `Van ${formatDutchDate(startISO)} tot en met ${formatDutchDate(endDate.toISOString().split('T')[0])}`;
    return { startISO, startDate, endDate, weeks, periodTitle, dateSubtitle };
  }, [designData]);

  if (loading) { 
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ontwerp wordt geladen...</p>
        </div>
      </div>
    ); 
  }
  
  if (error || !designData) { 
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2>
          <p className="text-red-600 mb-4">{error || 'Onbekende fout'}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => router.push('/planning')} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
              Terug naar overzicht
            </button>
            <button onClick={() => router.push('/planning/new')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Nieuw rooster starten
            </button>
          </div>
        </div>
      </div>
    ); 
  }
  
  const { weeks, periodTitle, dateSubtitle } = computedValues;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        <nav className="text-sm text-gray-500 mb-3">Dashboard &gt; Rooster Planning &gt; Rooster Ontwerp</nav>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{periodTitle}</h1>
            <p className="text-xs text-gray-500">{dateSubtitle}</p>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            onClick={() => router.push(`/planning/design/dashboard?rosterId=${rosterId}`)}
          >
            Terug naar dashboard
          </button>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-blue-800"><strong>Instructies:</strong> Stel voor elke medewerker het maximum aantal diensten in (0-35) en markeer niet-beschikbare dagen met de NB-knoppen. Nederlandse feestdagen zijn automatisch gemarkeerd.</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="min-w-full">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="sticky left-0 bg-white border-b px-3 py-2 text-left font-semibold text-gray-900 w-40">Medewerker</th>
                <th className="border-b px-3 py-2 text-center font-semibold text-gray-900 w-16">Dst</th>
                {weeks.map(week => (
                  <th key={week.number} colSpan={7} className="border-b px-2 py-2 text-center font-semibold text-gray-900 bg-yellow-50">
                    Week {week.number}
                  </th>
                ))}
              </tr>
              {['day','date','month'].map((rowType) => (
                <tr key={rowType}>
                  <th className="sticky left-0 bg-white border-b"></th>
                  <th className="border-b"></th>
                  {weeks.map(week => week.dates.map(date => {
                    const { day, date: dd, month, isWeekend, isHoliday, holidayName } = formatDateCell(date, holidaySet, holidays);
                    return (
                      <th key={`${rowType}-${date}`} className={`border-b px-1 py-1 text-xs ${rowType==='day'?'font-medium text-gray-700':rowType==='date'?'text-gray-600':'text-gray-500'} min-w-[50px] ${rowType==='day'?'relative':''}`} title={rowType==='date' ? (holidayName || undefined) : undefined}>
                        {rowType==='day'? day : rowType==='date'? dd : month}
                        {rowType==='day' && isHoliday && (
                          <span className="absolute top-0 right-0 bg-amber-600 text-white text-xs px-1 rounded-bl text-[10px] font-bold leading-none" style={{ fontSize: '8px', padding: '1px 2px' }}>FD</span>
                        )}
                      </th>
                    );
                  }))}
                </tr>
              ))}
            </thead>
            <tbody>
              {sortedEmployees.map((emp, empIndex) => {
                const team = (emp as any).team as any;
                const firstName = (emp as any).voornaam || getFirstName((emp as any).name || '');
                return (
                  <tr key={(emp as any).id} className={`${empIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} h-8`}>
                    <td className="sticky left-0 bg-inherit border-b px-3 py-1 font-medium text-gray-900 h-8">
                      <TeamBadge team={team} />{firstName}
                    </td>
                    <td className="border-b px-3 py-1 text-center h-8">
                      <input 
                        type="number" 
                        min="0" 
                        max="35" 
                        value={(emp as any).maxShifts} 
                        onChange={(e) => updateMaxShiftsHandler((emp as any).id, parseInt(e.target.value) || 0)} 
                        className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      />
                    </td>
                    {weeks.map(week => week.dates.map(date => {
                      const isUnavailable = (designData as any).unavailabilityData?.[(emp as any).id]?.[date] || false;
                      return (
                        <td key={date} className={`border-b p-0.5 text-center h-8`}>
                          <button 
                            onClick={() => toggleUnavailableHandler((emp as any).id, date)} 
                            className={`w-10 h-6 rounded text-xs font-bold transition-colors ${isUnavailable ? 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200' : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'}`} 
                            title={isUnavailable ? 'Klik om beschikbaar te maken' : 'Klik om niet-beschikbaar te markeren'}
                          >
                            {isUnavailable ? 'NB' : '—'}
                          </button>
                        </td>
                      );
                    }))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex items-center justify-end">
          <div className="text-sm text-gray-600">
            Wijzigingen worden automatisch opgeslagen
            {holidays.length > 0 && (
              <span className="ml-2 text-amber-600">• {holidays.length} feestdagen geladen</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
