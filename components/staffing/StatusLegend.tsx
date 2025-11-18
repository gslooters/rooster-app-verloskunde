/**
 * STATUS LEGEND COMPONENT
 * 
 * Herbruikbare component voor status legenda.
 * Toont de verschillende status types en hun betekenis.
 * 
 * Gebruikt door:
 * - /planning/period-staffing
 * - Andere staffing gerelateerde paginas
 * 
 * Datum: 18 november 2025
 */

import { STATUS_COLORS, STATUS_DESCRIPTIONS, type DagdeelStatus } from '@/types/staffing';

interface StatusLegendProps {
  className?: string;
}

const statusTypes: DagdeelStatus[] = ['MOET', 'MAG', 'MAG NIET', 'AANGEPAST'];

export function StatusLegend({ className = '' }: StatusLegendProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      <h3 className="font-semibold mb-3 text-gray-900">Status Legenda:</h3>
      <div className="flex flex-wrap gap-4">
        {statusTypes.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <div 
              className={`w-4 h-4 rounded-full ${STATUS_COLORS[status]}`}
              aria-label={status}
            />
            <span className="text-sm text-gray-700">
              <strong>{status}</strong> - {STATUS_DESCRIPTIONS[status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}