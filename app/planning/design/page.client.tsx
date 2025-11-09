// Enhanced team + dienstverband sorting in roosterweergave
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability, autofillUnavailability, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType, DienstverbandType } from '@/lib/types/employee';

// === UTIL: Team normalisatie ===
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

// --- TEAM COLOR MAPPING (robust via canonical) ---
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

  useEffect(() => {/* ... */}, [employees]);
  const computedValues = useMemo(() => {/* ... */}, [designData]);
  useEffect(() => {/* ... */}, [rosterId]);
  async function loadHolidaysForPeriod(startISO: string) {/* ... */}
  function updateMaxShiftsHandler(empId: string, maxShifts: number) {/* ... */}
  function toggleUnavailable(empId: string, date: string) {/* ... */}
  function getFirstName(fullName: string): string { return fullName.split(' ')[0]; }
  if (loading) { /* ... */ }
  if (error || !designData) { /* ... */ }
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
            onClick={() => router.push('/dashboard')}
          >
            Terug naar dashboard
          </button>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-blue-800"><strong>Instructies:</strong> Stel voor elke medewerker het maximum aantal diensten in (0-35) en markeer niet-beschikbare dagen met de NB-knoppen. Nederlandse feestdagen zijn automatisch gemarkeerd.</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          {/* ...tabel blijft gelijk... */}
        </div>
        <div className="mt-6 flex items-center justify-end">
          <div className="text-sm text-gray-600">
            Wijzigingen worden automatisch opgeslagen{holidays.length > 0 && (
              <span className="ml-2 text-amber-600">• {holidays.length} feestdagen geladen</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
