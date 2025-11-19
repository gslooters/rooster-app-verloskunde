'use client';

import React from 'react';
import type { DagdeelAssignment } from '@/lib/planning/weekDagdelenData';

interface DagdeelCellProps {
  assignments: DagdeelAssignment[];
  dagdeel: 'ochtend' | 'middag' | 'avond' | 'nacht';
  datum: string;
}

/**
 * DagdeelCell Component
 * 
 * Toont toegewezen medewerkers voor een specifiek dagdeel.
 * Bevat kleurcodering per team en status indicatie.
 */
export function DagdeelCell({ assignments, dagdeel, datum }: DagdeelCellProps) {
  // Team kleurcodering
  const getTeamColor = (team: string): string => {
    const teamUpper = team?.toUpperCase() || '';
    
    switch (teamUpper) {
      case 'A':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'B':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'C':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  // Bepaal achtergrondkleur op basis van bezetting
  const getBgColor = (): string => {
    if (assignments.length === 0) return 'bg-red-50';
    if (assignments.length === 1) return 'bg-yellow-50';
    return 'bg-white';
  };

  // Als leeg, toon placeholder
  if (assignments.length === 0) {
    return (
      <div className={`p-3 min-h-[80px] border border-gray-200 rounded-lg ${getBgColor()}`}>
        <div className="text-xs text-gray-400 italic">Geen bezetting</div>
      </div>
    );
  }

  return (
    <div className={`p-3 min-h-[80px] border border-gray-200 rounded-lg ${getBgColor()}`}>
      <div className="space-y-2">
        {assignments.map((assignment, index) => (
          <div
            key={`${assignment.employeeId}-${index}`}
            className={`p-2 rounded-md border ${getTeamColor(assignment.team)} transition-all hover:shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                {assignment.employeeName}
              </span>
              {assignment.team && (
                <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded">
                  {assignment.team.toUpperCase()}
                </span>
              )}
            </div>
            {assignment.status === 'tentative' && (
              <div className="mt-1 text-xs text-gray-500 italic">Voorlopig</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
