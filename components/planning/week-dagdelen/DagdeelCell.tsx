'use client';
import React from 'react';
import { DagdeelWaarde, TeamDagdeel, getStatusColorClass, getAantalDisplayLabel } from '@/lib/types/week-dagdelen';

interface DagdeelCellProps {
  dienstId: string;
  team: TeamDagdeel;
  datum: string;
  dagdeelWaarde: DagdeelWaarde;
  onClick?: (dienstId: string, team: TeamDagdeel, datum: string, dagdeel: string) => void;
  disabled?: boolean;
}

/**
 * DRAAD39.4: Dagdeel Cell Component
 * 
 * Displays a single dagdeel value in the week table.
 * Compact design to fit 21 cells per row.
 * 
 * Features:
 * - Color-coded by status (MOET=red, MAG=green, MAG_NIET=gray, AANGEPAST=blue)
 * - Click to edit (when not disabled)
 * - Shows number or '-' for empty
 * - Responsive hover effects
 */
export default function DagdeelCell({
  dienstId,
  team,
  datum,
  dagdeelWaarde,
  onClick,
  disabled = false
}: DagdeelCellProps) {
  
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick(dienstId, team, datum, dagdeelWaarde.dagdeel);
    }
  };

  const statusColorClass = getStatusColorClass(dagdeelWaarde.status);
  const displayLabel = getAantalDisplayLabel(dagdeelWaarde.aantal);
  
  // Special highlighting for MOET status with 0 aantal (requires attention)
  const requiresAttention = dagdeelWaarde.status === 'MOET' && dagdeelWaarde.aantal === 0;
  
  return (
    <td
      onClick={handleClick}
      className={`
        px-2 py-1.5
        text-center
        text-sm
        border border-gray-200
        min-w-[40px]
        max-w-[50px]
        ${statusColorClass}
        ${
          !disabled 
            ? 'cursor-pointer hover:shadow-md hover:scale-105 transition-all' 
            : 'cursor-not-allowed opacity-75'
        }
        ${
          requiresAttention
            ? 'ring-2 ring-red-400 animate-pulse'
            : ''
        }
      `}
      title={`
        Status: ${dagdeelWaarde.status}
        Aantal: ${dagdeelWaarde.aantal}
        Dagdeel: ${dagdeelWaarde.dagdeel === '0' ? 'Ochtend' : dagdeelWaarde.dagdeel === 'M' ? 'Middag' : 'Avond'}
        ${requiresAttention ? '⚠️ Vereist aandacht!' : ''}
      `.trim()}
    >
      <span className={`
        font-mono
        font-medium
        ${
          requiresAttention
            ? 'text-red-600 text-base'
            : ''
        }
      `}>
        {displayLabel}
      </span>
    </td>
  );
}
