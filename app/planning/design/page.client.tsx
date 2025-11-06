// Enhanced team normalization + robust color mapping + sorting + extended debug + SYNC
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability, autofillUnavailability, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType } from '@/lib/types/employee';

function extractTeamRaw(team: unknown): string { if (team && typeof team === 'object') { const t = team as any; return String(t.name ?? t.label ?? t.code ?? t.value ?? ''); } return String(team ?? ''); }
function normalizeTeam(input: unknown): 'Groen' | 'Oranje' | 'Overig' { const raw = extractTeamRaw(input).normalize('NFKD').replace(/[\u0300-\u036f]/g,''); const s = raw.trim().toLowerCase(); if (/(^|\b)groen(e|en)?\b|green|\bg\b/.test(s)) return 'Groen'; if (/(^|\b)oranje\b|orange|\bo\b/.test(s)) return 'Oranje'; if (/(^|\b)overig(e|en)?\b|other|rest|divers|overige|overigen/.test(s)) return 'Overig'; return 'Overig'; }
const TEAM_COLORS_CANONICAL: Record<'Groen'|'Oranje'|'Overig', string> = { Groen: '#16a34a', Oranje: '#f59e0b', Overig: '#3b82f6' };
function getTeamColor(teamData: any): string { const canonical = normalizeTeam(teamData); return TEAM_COLORS_CANONICAL[canonical] ?? '#94a3b8'; }
function TeamBadge({ team }: { team: TeamType | string }) { const color = getTeamColor(team); return <span aria-label={`Team ${extractTeamRaw(team)}`} title={`Team ${extractTeamRaw(team)}`} className="inline-block align-middle mr-2" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, backgroundColor: color }} /> }
const MONTH_NAMES = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
function formatDutchDate(dateStr: string): string { const date = new Date(dateStr + 'T00:00:00'); return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`; }
function getWeekNumber(date: Date): number { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum); const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7); }
function formatDateCell(dateStr: string, holidaySet: Set<string>, holidays: Holiday[]): { day: string, date: string, month: string, isWeekend: boolean, isHoliday: boolean, holidayName?: string } { const date = new Date(dateStr + 'T00:00:00'); const dayNames = ['ZO','MA','DI','WO','DO','VR','ZA']; const dayIndex = date.getDay(); const day = dayNames[dayIndex]; const dd = String(date.getDate()).padStart(2,'0'); const mm = String(date.getMonth() + 1).padStart(2,'0'); const isWeekend = dayIndex === 0 || dayIndex === 6; const isHoliday = holidaySet.has(dateStr); const holiday = isHoliday ? findHolidayByDate(holidays, dateStr) : undefined; return { day, date: dd, month: mm, isWeekend, isHoliday, holidayName: holiday?.name }; }
function columnClasses(dateStr: string, holidaySet: Set<string>): string { const date = new Date(dateStr + 'T00:00:00'); const d = date.getDay(); const isHoliday = holidaySet.has(dateStr); const leftWeekSep = d === 1 ? ' border-l-4 border-yellow-200' : ''; let rim = ''; if (d === 0 || d === 6) { rim = isHoliday ? ' border-x-2 border-amber-300' : ' border-x-2 border-yellow-300'; } else if (isHoliday) { rim = ' border-x-2 border-amber-300'; } return leftWeekSep + rim; }

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

  const sortedEmployees = useMemo(() => { const order: Record<'Groen'|'Oranje'|'Overig', number> = { Groen: 0, Oranje: 1, Overig: 2 }; return [...employees].sort((a, b) => { const aC = normalizeTeam((a as any).team); const bC = normalizeTeam((b as any).team); if (aC !== bC) return (order[aC] ?? 3) - (order[bC] ?? 3); const nameA = (a as any).voornaam || (a as any).name || ''; const nameB = (b as any).voornaam || (b as any).name || ''; return nameA.localeCompare(nameB, 'nl', { sensitivity: 'base' }); }); }, [employees]);

  const computedValues = useMemo(() => { if (!designData) { return { startISO: new Date().toISOString().split('T')[0], startDate: new Date(), endDate: new Date(), weeks: [], periodTitle: '', dateSubtitle: '' }; } const startISO = (designData as any).start_date || (designData as any).roster_start || new Date().toISOString().split('T')[0]; const startDate = new Date(startISO + 'T00:00:00'); const endDate = new Date(startDate); endDate.setDate(startDate.getDate() + (4 * 7) + 6); const weeks = Array.from({ length: 5 }, (_, i) => { const weekStart = new Date(startDate); weekStart.setDate(startDate.getDate() + (i * 7)); const weekNumber = getWeekNumber(weekStart); return { number: weekNumber, dates: Array.from({ length: 7 }, (_, d) => { const date = new Date(weekStart); date.setDate(weekStart.getDate() + d); return date.toISOString().split('T')[0]; }) }; }); const firstWeek = weeks[0]; const lastWeek = weeks[weeks.length - 1]; const periodTitle = `Rooster Ontwerp : Periode Week ${firstWeek?.number || ''} - Week ${lastWeek?.number || ''} ${startDate.getFullYear()}`; const dateSubtitle = `Van ${formatDutchDate(startISO)} tot en met ${formatDutchDate(endDate.toISOString().split('T')[0])}`; return { startISO, startDate, endDate, weeks, periodTitle, dateSubtitle }; }, [designData]);

  useEffect(() => { if (!rosterId) { setError('Geen roster ID gevonden'); setLoading(false); return; } try { const data = loadRosterDesignData(rosterId); if (data) { syncRosterDesignWithEmployeeData(rosterId); const startISO = (data as any).start_date || (data as any).roster_start; if (startISO) { autofillUnavailability(rosterId, startISO); } const latest = loadRosterDesignData(rosterId) || data; setDesignData(latest); setEmployees(latest.employees); if (startISO) { loadHolidaysForPeriod(startISO); } } else { setError('Geen roster ontwerp data gevonden'); } } catch (err) { console.error('Error loading design data:', err); setError('Fout bij laden van ontwerp data'); } setLoading(false); }, [rosterId]);

  useEffect(() => { if (employees.length) { console.log('TEAM DEBUG (canonical + synced):', employees.map(emp => ({ id: (emp as any).id, name: (emp as any).voornaam || (emp as any).name, raw: (emp as any).team, extracted: extractTeamRaw((emp as any).team), normalized: normalizeTeam((emp as any).team), color: getTeamColor((emp as any).team) }))); } }, [employees]);

  async function loadHolidaysForPeriod(startISO: string) { setHolidaysLoading(true); try { const startDate = new Date(startISO + 'T00:00:00'); const endDate = new Date(startDate); endDate.setDate(startDate.getDate() + (4 * 7) + 6); const startStr = startDate.toISOString().split('T')[0]; const endStr = endDate.toISOString().split('T')[0]; const fetchedHolidays = await fetchNetherlandsHolidays(startStr, endStr); setHolidays(fetchedHolidays); } catch (error) { console.error('Error loading holidays:', error); } finally { setHolidaysLoading(false); } }

  function updateMaxShiftsHandler(empId: string, maxShifts: number) { if (!rosterId || !designData) return; updateEmployeeMaxShifts(rosterId, empId, maxShifts); const updated = loadRosterDesignData(rosterId); if (updated) { setDesignData(updated); setEmployees(updated.employees); } }
  function toggleUnavailable(empId: string, date: string) { if (!rosterId || !designData) return; toggleUnavailability(rosterId, empId, date); const updated = loadRosterDesignData(rosterId); if (updated) { setDesignData(updated); setEmployees(updated.employees); } }
  function goToEditing() { if (!rosterId) return; router.push(`/planning/${rosterId}`); }
  function getFirstName(fullName: string): string { return fullName.split(' ')[0]; }

  function goToStaffing() { if (!rosterId) return; router.push(`/planning/design/staffing?rosterId=${rosterId}`); }

  if (loading) { return (<div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-gray-600">Ontwerp wordt geladen...</p></div></div>); }
  if (error || !designData) { return (<div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center"><div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center"><h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2><p className="text-red-600 mb-4">{error || 'Onbekende fout'}</p><div className="flex items-center justify-center gap-3"><button onClick={() => router.push('/planning')} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">Terug naar overzicht</button><button onClick={() => router.push('/planning/new')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Nieuw rooster starten</button></div></div></div>); }

  const { weeks, periodTitle, dateSubtitle } = computedValues;

  const weekendHeaderClass = 'bg-yellow-100';
  const weekdayHeaderClass = 'bg-yellow-50';
  const holidayHeaderClass = 'bg-amber-100 border-amber-300';
  const weekendHolidayHeaderClass = 'bg-gradient-to-r from-yellow-100 to-amber-100 border-amber-300';
  const weekendBodyClass = 'bg-yellow-50/40';
  const holidayBodyClass = 'bg-amber-50/30';
  const weekendHolidayBodyClass = 'bg-gradient-to-r from-yellow-50/40 to-amber-50/30';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        <nav className="text-sm text-gray-500 mb-3">Dashboard &gt; Rooster Planning &gt; Rooster Ontwerp</nav>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{periodTitle}</h1>
            <p className="text-xs text-gray-500">{dateSubtitle}</p>
            {holidaysLoading && (<p className="text-xs text-blue-600 mt-1">Feestdagen worden geladen...</p>)}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-md"><span className="inline-block w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" /> Weekend</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md"><span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" /> Feestdag</span>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">🎨 Ontwerpfase</div>
            <button onClick={goToStaffing} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Bezetting beheren</button>
            <button onClick={goToEditing} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Ga naar Bewerking →</button>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-blue-800"><strong>Instructies:</strong> Stel voor elke medewerker het maximum aantal diensten in (0-35) en markeer niet-beschikbare dagen met de NB-knoppen. Nederlandse feestdagen zijn automatisch gemarkeerd.</p>
        </div>

        {/* ... rest van de component ongewijzigd ... */}
