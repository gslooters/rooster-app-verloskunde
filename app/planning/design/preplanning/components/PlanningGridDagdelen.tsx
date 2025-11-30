'use client';

import { useMemo, useCallback } from 'react';
import { PrePlanningAssignment, EmployeeWithServices, Dagdeel, CellStatus } from '@/lib/types/preplanning';

/**
 * DRAAD 87: Bevestigingsdialoog voor Status 2 Cellen
 * 
 * Rendert tabel met 3 kolommen per datum (Ochtend/Middag/Avond)
 * Cel rendering op basis van status:
 * - Status 0 (Leeg): `-` grijs op wit
 * - Status 1 (Dienst): Service code wit op dienstkleur
 * - Status 2 (Geblokkeerd): `▓` grijs op lichtgrijs + bevestigingsdialoog bij klik
 * - Status 3 (NB): `NB` zwart op geel
 * 
 * Status 2 cellen:
 * - Visueel: Grijs met ▓ symbool (blijft behouden)
 * - Functionaliteit: Klikbaar met bevestigingsdialoog
 * - Bij annuleren: Geen actie
 * - Bij bevestigen: Modal opent normaal
 * 
 * Medewerkerkolom: Team symbool (gekleurd rondje) + voornaam (18px)
 * Sortering: Team → Dienstverband → Voornaam alfabetisch
 * 
 * Cache: 1733086340000
 */

interface DateInfo {
  date: string; // YYYY-MM-DD
  dayName: string; // "MA", "DI", etc.
  dayLabel: string; // "MA 24-11"
  weekNumber: number;
  year: number;
}

interface PlanningGridDagdelenProps {
  employees: EmployeeWithServices[];
  dateInfo: DateInfo[];
  assignments: PrePlanningAssignment[];
  serviceColors: Record<string, string>; // serviceId -> kleur mapping
  onCellClick: (employeeId: string, date: string, dagdeel: Dagdeel) => void;
  readOnly?: boolean; // Voor status 'final'
}

export default function PlanningGridDagdelen({
  employees,
  dateInfo,
  assignments,
  serviceColors,
  onCellClick,
  readOnly = false
}: PlanningGridDagdelenProps) {

  // Groepeer datums per week voor week headers
  const weekGroups = useMemo(() => {
    const groups: { weekNumber: number; year: number; dates: DateInfo[] }[] = [];
    let currentWeek: { weekNumber: number; year: number; dates: DateInfo[] } | null = null;

    dateInfo.forEach(date => {
      if (!currentWeek || currentWeek.weekNumber !== date.weekNumber) {
        currentWeek = {
          weekNumber: date.weekNumber,
          year: date.year,
          dates: [date]
        };
        groups.push(currentWeek);
      } else {
        currentWeek.dates.push(date);
      }
    });

    return groups;
  }, [dateInfo]);

  // Sorteer employees: team → dienstverband → voornaam
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      // 1. Team sortering: Groen → Oranje → Overig
      const teamOrder: Record<string, number> = { 
        'Groen': 1, 
        'Oranje': 2, 
        'Overig': 3 
      };
      const teamA = teamOrder[a.team] || 99;
      const teamB = teamOrder[b.team] || 99;
      if (teamA !== teamB) return teamA - teamB;

      // 2. Dienstverband sortering: Maat → Loondienst → ZZP
      const dienstOrder: Record<string, number> = { 
        'Maat': 1, 
        'Loondienst': 2, 
        'ZZP': 3 
      };
      const dienstA = dienstOrder[a.dienstverband] || 99;
      const dienstB = dienstOrder[b.dienstverband] || 99;
      if (dienstA !== dienstB) return dienstA - dienstB;

      // 3. Voornaam alfabetisch (Nederlandse locale)
      return a.voornaam.localeCompare(b.voornaam, 'nl');
    });
  }, [employees]);

  // Maak lookup map voor assignments: employeeId_date_dagdeel -> assignment
  const assignmentMap = useMemo(() => {
    const map = new Map<string, PrePlanningAssignment>();
    assignments.forEach(assignment => {
      const key = `${assignment.employee_id}_${assignment.date}_${assignment.dagdeel}`;
      map.set(key, assignment);
    });
    return map;
  }, [assignments]);

  // Helper functie om assignment te vinden voor een cel
  const getAssignmentForCell = useCallback(
    (employeeId: string, date: string, dagdeel: Dagdeel): PrePlanningAssignment | undefined => {
      const key = `${employeeId}_${date}_${dagdeel}`;
      return assignmentMap.get(key);
    },
    [assignmentMap]
  );

  // Helper functie voor team kleur symbool
  const getTeamColor = useCallback((team: string): string => {
    const teamColors: Record<string, string> = {
      'Groen': '#22C55E',
      'Oranje': '#F97316',
      'Overig': '#3B82F6'
    };
    return teamColors[team] || '#3B82F6'; // Fallback naar blauw
  }, []);

  // DRAAD 87: Handler voor cel klik met bevestigingsdialoog voor status 2
  const handleCellClick = useCallback(
    (employeeId: string, date: string, dagdeel: Dagdeel, status: CellStatus) => {
      // Read-only mode: geen klikken
      if (readOnly) return;
      
      // DRAAD 87: Bevestigingsdialoog voor geblokkeerde cellen (status 2)
      if (status === 2) {
        const confirmed = window.confirm(
          '⚠️ LET OP: Je staat op het punt een blokkade (door vorige dienst) te overschrijven.\n\n' +
          'Deze cel is geblokkeerd omdat een eerdere dienst doorloopt.\n\n' +
          'Weet je zeker dat je deze cel wilt wijzigen?'
        );
        
        // Bij annuleren: geen actie
        if (!confirmed) {
          return;
        }
        
        // Bij bevestigen: ga door naar modal
      }
      
      // Open modal voor alle statussen (na eventuele bevestiging)
      onCellClick(employeeId, date, dagdeel);
    },
    [onCellClick, readOnly]
  );

  // Render een cel op basis van status
  const renderCell = useCallback(
    (employeeId: string, date: string, dagdeel: Dagdeel) => {
      const assignment = getAssignmentForCell(employeeId, date, dagdeel);
      const status = assignment?.status ?? 0; // Default status 0 (leeg)

      // Status 0: Leeg
      if (status === 0) {
        return (
          <td
            key={`${employeeId}_${date}_${dagdeel}`}
            className={`border border-gray-300 text-center min-w-[60px] h-[40px] p-1 ${
              readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50 transition-all duration-150'
            }`}
            onClick={() => handleCellClick(employeeId, date, dagdeel, status)}
          >
            <span className="text-gray-400 text-sm">-</span>
          </td>
        );
      }

      // Status 1: Dienst
      if (status === 1 && assignment) {
        const serviceColor = assignment.service_id 
          ? serviceColors[assignment.service_id] || '#3B82F6' // Fallback blauw
          : '#3B82F6';

        return (
          <td
            key={`${employeeId}_${date}_${dagdeel}`}
            className={`border border-gray-400 text-center min-w-[60px] h-[40px] p-1 ${
              readOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80 transition-all duration-150'
            }`}
            style={{ backgroundColor: serviceColor }}
            onClick={() => handleCellClick(employeeId, date, dagdeel, status)}
          >
            <span className="text-white font-medium text-sm">{assignment.service_code}</span>
          </td>
        );
      }

      // DRAAD 87: Status 2: Geblokkeerd - Nu klikbaar met bevestigingsdialoog
      if (status === 2) {
        return (
          <td
            key={`${employeeId}_${date}_${dagdeel}`}
            className={`border border-gray-300 text-center min-w-[60px] h-[40px] p-1 bg-gray-200 opacity-60 ${
              readOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80 transition-all duration-150'
            }`}
            onClick={() => handleCellClick(employeeId, date, dagdeel, status)}
            title="Geblokkeerd door vorige dienst - Klik om te wijzigen"
          >
            <span className="text-gray-600 text-sm">▓</span>
          </td>
        );
      }

      // Status 3: Niet Beschikbaar
      if (status === 3) {
        return (
          <td
            key={`${employeeId}_${date}_${dagdeel}`}
            className={`border border-yellow-300 text-center min-w-[60px] h-[40px] p-1 bg-yellow-100 ${
              readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-yellow-200 transition-all duration-150'
            }`}
            onClick={() => handleCellClick(employeeId, date, dagdeel, status)}
          >
            <span className="text-gray-900 font-semibold text-sm">NB</span>
          </td>
        );
      }

      // Fallback: onbekende status
      return (
        <td
          key={`${employeeId}_${date}_${dagdeel}`}
          className="border border-gray-300 text-center min-w-[60px] h-[40px] p-1 bg-red-100"
        >
          <span className="text-red-600 text-xs">?</span>
        </td>
      );
    },
    [getAssignmentForCell, serviceColors, handleCellClick, readOnly]
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10">
          {/* Rij 1: Weeknummers */}
          <tr>
            <th
              rowSpan={3}
              className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 z-20 min-w-[180px]"
            >
              Medewerker
            </th>
            {weekGroups.map((week, idx) => (
              <th
                key={`week-${idx}`}
                colSpan={week.dates.length * 3} // 3 dagdelen per datum
                className="border border-gray-300 px-2 py-1 text-center text-sm font-bold text-gray-700 bg-gray-100"
              >
                Week {week.weekNumber}
              </th>
            ))}
          </tr>

          {/* Rij 2: Datums */}
          <tr>
            {dateInfo.map((date, idx) => (
              <th
                key={`date-${idx}`}
                colSpan={3} // 3 dagdelen (O/M/A)
                className="border border-gray-300 px-1 py-1 text-center text-xs font-medium text-gray-700 bg-gray-50"
              >
                {date.dayLabel}
              </th>
            ))}
          </tr>

          {/* Rij 3: Dagdelen (O/M/A) */}
          <tr>
            {dateInfo.map((date, idx) => (
              <>
                <th
                  key={`dagdeel-o-${idx}`}
                  className="border border-gray-300 px-1 py-1 text-center text-xs font-medium text-gray-600 bg-blue-50 min-w-[60px]"
                >
                  O
                </th>
                <th
                  key={`dagdeel-m-${idx}`}
                  className="border border-gray-300 px-1 py-1 text-center text-xs font-medium text-gray-600 bg-orange-50 min-w-[60px]"
                >
                  M
                </th>
                <th
                  key={`dagdeel-a-${idx}`}
                  className="border border-gray-300 px-1 py-1 text-center text-xs font-medium text-gray-600 bg-purple-50 min-w-[60px]"
                >
                  A
                </th>
              </>
            ))}
          </tr>
        </thead>

        <tbody>
          {sortedEmployees.map(employee => (
            <tr key={employee.id} className="hover:bg-gray-50">
              {/* Sticky left column voor medewerkernaam met team symbool */}
              <td className="border border-gray-300 px-3 py-2 sticky left-0 bg-white z-10 min-w-[180px]">
                <div className="flex items-center gap-2">
                  {/* Team kleur symbool */}
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getTeamColor(employee.team) }}
                    title={`${employee.team} - ${employee.dienstverband}`}
                    aria-label={`Team ${employee.team}`}
                  />
                  
                  {/* Voornaam in grotere tekst */}
                  <span className="font-medium text-gray-900 text-lg leading-tight">
                    {employee.voornaam}
                  </span>
                </div>
              </td>

              {/* Cellen voor elke datum x dagdeel combinatie */}
              {dateInfo.map(date => (
                <>
                  {renderCell(employee.id, date.date, 'O')}
                  {renderCell(employee.id, date.date, 'M')}
                  {renderCell(employee.id, date.date, 'A')}
                </>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}