'use client';

import type { WeekDagdeelData, DayDagdeelData, DagdeelAssignment } from '@/lib/planning/weekDagdelenData';

interface WeekDagdelenTableProps {
  weekData: WeekDagdeelData;
}

/**
 * Main table component for displaying week dagdelen data
 * Shows 7 days (Ma-Zo) with 4 dagdelen per day (ochtend, middag, avond, nacht)
 */
export default function WeekDagdelenTable({ weekData }: WeekDagdelenTableProps) {
  if (!weekData || !weekData.days || weekData.days.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-sm">Geen data beschikbaar voor week {weekData?.weekNummer}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {/* Header: Days of week */}
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-gray-100 border border-gray-300 p-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">
              Dagdeel
            </th>
            {weekData.days.map((day, index) => (
              <th
                key={index}
                className="border border-gray-300 p-3 text-center text-sm font-semibold text-gray-700 min-w-[140px] bg-gray-50"
              >
                <div className="font-bold">{day.dagNaam}</div>
                <div className="text-xs font-normal text-gray-500 mt-1">
                  {formatDateShort(day.datum)}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* Row: Ochtend */}
          <DagdeelRow
            label="Ochtend"
            days={weekData.days}
            dagdeelType="ochtend"
          />

          {/* Row: Middag */}
          <DagdeelRow
            label="Middag"
            days={weekData.days}
            dagdeelType="middag"
          />

          {/* Row: Avond */}
          <DagdeelRow
            label="Avond"
            days={weekData.days}
            dagdeelType="avond"
          />

          {/* Row: Nacht */}
          <DagdeelRow
            label="Nacht"
            days={weekData.days}
            dagdeelType="nacht"
          />
        </tbody>
      </table>
    </div>
  );
}

/**
 * Row component for a single dagdeel type across all days
 */
interface DagdeelRowProps {
  label: string;
  days: DayDagdeelData[];
  dagdeelType: 'ochtend' | 'middag' | 'avond' | 'nacht';
}

function DagdeelRow({ label, days, dagdeelType }: DagdeelRowProps) {
  return (
    <tr>
      {/* Row header - dagdeel label */}
      <td className="sticky left-0 z-10 bg-gray-50 border border-gray-300 p-3 text-sm font-medium text-gray-700">
        {label}
      </td>

      {/* Cells for each day */}
      {days.map((day, dayIndex) => {
        const assignments = day.dagdelen[dagdeelType] || [];
        return (
          <DagdeelCell
            key={dayIndex}
            assignments={assignments}
            date={day.datum}
            dagNaam={day.dagNaam}
            dagdeelType={dagdeelType}
          />
        );
      })}
    </tr>
  );
}

/**
 * Individual cell component for a single dagdeel on a single day
 */
interface DagdeelCellProps {
  assignments: DagdeelAssignment[];
  date: string;
  dagNaam: string;
  dagdeelType: string;
}

function DagdeelCell({ assignments, date, dagNaam, dagdeelType }: DagdeelCellProps) {
  // Calculate total aantal from all assignments
  const totalAantal = assignments.reduce((sum, a) => sum + (a.aantal || 0), 0);
  
  // Determine cell background color based on total aantal
  const getBgColor = () => {
    if (totalAantal === 0) return 'bg-gray-50';
    if (totalAantal >= 3) return 'bg-green-50 border-green-200';
    if (totalAantal === 2) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <td
      className={`border border-gray-300 p-2 text-sm hover:bg-blue-50 cursor-pointer transition-colors ${getBgColor()}`}
      title={`${dagNaam} ${date} - ${dagdeelType}`}
    >
      {assignments.length === 0 ? (
        <div className="text-gray-400 text-xs text-center py-2">-</div>
      ) : (
        <div className="space-y-1">
          {assignments.map((assignment, index) => (
            <AssignmentBadge key={index} assignment={assignment} />
          ))}
          {assignments.length > 1 && (
            <div className="text-xs text-gray-500 font-semibold mt-2 pt-1 border-t border-gray-300">
              Totaal: {totalAantal}
            </div>
          )}
        </div>
      )}
    </td>
  );
}

/**
 * Badge component for displaying a single team assignment
 */
interface AssignmentBadgeProps {
  assignment: DagdeelAssignment;
}

function AssignmentBadge({ assignment }: AssignmentBadgeProps) {
  // Determine badge color based on status
  const getStatusColor = () => {
    if (!assignment.status) return 'bg-gray-100 text-gray-700';
    
    const status = assignment.status.toUpperCase();
    if (status.includes('MOET')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (status.includes('MAG')) return 'bg-green-100 text-green-800 border-green-300';
    if (status.includes('NIET')) return 'bg-gray-100 text-gray-600 border-gray-300';
    
    return 'bg-purple-100 text-purple-800 border-purple-300';
  };

  return (
    <div
      className={`flex items-center justify-between px-2 py-1 rounded border text-xs ${getStatusColor()}`}
    >
      <span className="font-medium">
        Team {assignment.team || '?'}
      </span>
      <span className="ml-2 font-bold">
        {assignment.aantal || 0}x
      </span>
    </div>
  );
}

/**
 * Format date string to short format (e.g., "24 nov")
 */
function formatDateShort(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const monthNames = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const month = monthNames[date.getMonth()];
    return `${day} ${month}`;
  } catch (error) {
    return dateStr;
  }
}
