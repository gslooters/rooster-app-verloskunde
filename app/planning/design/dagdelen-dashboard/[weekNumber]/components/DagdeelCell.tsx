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
 * Toont team toewijzingen voor een specifiek dagdeel.
 * Bevat kleurcodering per team en status indicatie.
 * 
 * AANGEPAST: Toont nu team + aantal (geen individuele medewerkers)
 */
export function DagdeelCell({ assignments, dagdeel, datum }: DagdeelCellProps) {
  // Team kleurcodering
  const getTeamColor = (team: string): string => {
    const teamUpper = team?.toUpperCase() || '';
    
    switch (teamUpper) {
      case 'A':
        return 'bg-blue-100 border-blue-300 text-blue-900';
      case 'B':
        return 'bg-green-100 border-green-300 text-green-900';
      case 'C':
        return 'bg-purple-100 border-purple-300 text-purple-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  // Status kleurcodering
  const getStatusColor = (status: string): string => {
    const statusUpper = status?.toUpperCase() || '';
    
    if (statusUpper.includes('MOET')) return 'text-red-700';
    if (statusUpper.includes('MAG')) return 'text-blue-700';
    return 'text-gray-700';
  };

  // Bepaal achtergrondkleur op basis van bezetting
  const getBgColor = (): string => {
    const totalAantal = assignments.reduce((sum, a) => sum + (a.aantal || 0), 0);
    
    if (totalAantal === 0) return 'bg-red-50';
    if (totalAantal === 1) return 'bg-yellow-50';
    return 'bg-white';
  };

  // Bereken totaal aantal
  const totalAantal = assignments.reduce((sum, a) => sum + (a.aantal || 0), 0);

  // Als leeg, toon placeholder
  if (assignments.length === 0 || totalAantal === 0) {
    return (
      <div className={`p-3 min-h-[80px] border border-gray-300 rounded-lg ${getBgColor()}`}>
        <div className="text-xs text-gray-400 italic text-center">Geen bezetting</div>
      </div>
    );
  }

  return (
    <div className={`p-3 min-h-[80px] border border-gray-300 rounded-lg ${getBgColor()}`}>
      <div className="space-y-2">
        {assignments.map((assignment, index) => (
          <div
            key={`${assignment.team}-${index}`}
            className={`p-2 rounded-md border-2 ${getTeamColor(assignment.team)} transition-all hover:shadow-sm`}
          >
            <div className="flex items-center justify-between">
              {/* Team Label */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  Team {assignment.team?.toUpperCase() || '?'}
                </span>
                <span className="text-xs text-gray-600">
                  ({assignment.aantal || 0}x)
                </span>
              </div>
              
              {/* Status Badge */}
              {assignment.status && assignment.status !== 'NIET_TOEGEWEZEN' && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getStatusColor(assignment.status)}`}>
                  {assignment.status}
                </span>
              )}
            </div>
          </div>
        ))}
        
        {/* Totaal indicator */}
        {assignments.length > 1 && (
          <div className="pt-2 border-t border-gray-200 text-xs text-gray-600 text-center font-medium">
            Totaal: {totalAantal} medewerker{totalAantal !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
