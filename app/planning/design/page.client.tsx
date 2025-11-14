// Fase 3: Read-Only badge cell rendering - DRAAD27E
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType, DienstverbandType } from '@/lib/types/employee';
import { getServiceTypeOrDefault, getContrastColor, darkenColor } from '@/lib/services/service-types-loader';
import findAssignmentForCell from '@/lib/planning/assignment-matcher';

// ...helpers extractTeamRaw, normalizeTeam, etc.

function ServiceBadgeReadonly({ code, naam, kleur }: { code: string, naam: string, kleur: string }) {
  const textColor = getContrastColor(kleur);
  const borderColor = darkenColor(kleur, 20);
  return (
    <span className="inline-block w-10 h-6 rounded text-xs leading-6 text-center font-bold align-middle border" style={{ backgroundColor: kleur, color: textColor, border: `2px solid ${borderColor}` }} title={`Dienst: ${naam} (${code})`}>{code}</span>
  );
}

function EmptyCell() {
  return (
    <span className="inline-block w-10 h-6 rounded text-xs leading-6 text-center text-gray-400 border border-gray-300 bg-gray-50 font-normal">—</span>
  );
}

export default function DesignPageClient() {
  // ... bestaande state + helpers ...
  const [designData, setDesignData] = useState<RosterDesignData | null>(null);
  const [employees, setEmployees] = useState<RosterEmployee[]>([]);
  // ... andere states ...
  const sortedEmployees = useMemo(() => {
    const teamOrder: Record<'Groen'|'Oranje'|'Overig', number> = { Groen: 0, Oranje: 1, Overig: 2 };
    const dienstOrder = [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP];
    const normTeam = (teamRaw: any) => {
      if (teamRaw === 'Groen' || teamRaw === 'Oranje' || teamRaw === 'Overig') return teamRaw;
      // extra normalisatie fallback (additioneel, afhankelijk van team objecten)
      if (typeof teamRaw === 'string') {
        if (/^g(ro?e?n)?$/i.test(teamRaw)) return 'Groen';
        if (/^o(ra?nje)?$/i.test(teamRaw)) return 'Oranje';
        if (/overig/i.test(teamRaw)) return 'Overig';
      }
      return 'Overig';
    };
    return [...employees].sort((a, b) => {
      const teamA = normTeam((a as any).team);
      const teamB = normTeam((b as any).team);
      const t = (teamOrder[teamA as 'Groen'|'Oranje'|'Overig'] ?? 3) - (teamOrder[teamB as 'Groen'|'Oranje'|'Overig'] ?? 3);
      if (t !== 0) return t;
      const dienstA = (a as any).dienstverband;
      const dienstB = (b as any).dienstverband;
      const d = dienstOrder.indexOf(dienstA) - dienstOrder.indexOf(dienstB);
      if (d !== 0) return d;
      const nameA = (a as any).voornaam || (a as any).name || '';
      const nameB = (b as any).voornaam || (b as any).name || '';
      return nameA.localeCompare(nameB, 'nl', { sensitivity: 'base' });
    });
  }, [employees]);
  // ... rest van component ...
}