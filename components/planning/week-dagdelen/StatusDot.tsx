'use client';
import React from 'react';
import { DagdeelStatus } from '@/lib/types/week-dagdelen';

const STATUS_COLORS: Record<DagdeelStatus, string> = {
  MOET: '#EF4444',        // Rood
  MAG: '#10B981',         // Groen
  MAG_NIET: '#6B7280',    // Grijs
  AANGEPAST: '#3B82F6'    // Blauw
};

interface StatusDotProps {
  status: DagdeelStatus;
}

/**
 * DRAAD39.5: Status Dot Component
 * 
 * Displays a colored dot indicating the dagdeel status.
 * Used in inline editable cells.
 * 
 * Colors:
 * - MOET (red): Verplicht dagdeel
 * - MAG (green): Optioneel dagdeel
 * - MAG_NIET (gray): Niet toegestaan
 * - AANGEPAST (blue): Handmatig aangepast
 */
export default function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
      style={{ backgroundColor: STATUS_COLORS[status] }}
      aria-hidden="true"
    />
  );
}
