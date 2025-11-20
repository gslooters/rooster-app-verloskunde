'use client';

import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { WeekBoundary } from '@/lib/planning/weekBoundaryCalculator';

/**
 * DRAAD40B FASE 2: ActionBar Component Update
 * 
 * Functionaliteit:
 * - Week navigatie met boundary logic (geen prev bij week 1, geen next bij week 5)
 * - Team filter toggles (Groen/Oranje/Praktijk)
 * - Autosave status indicator (idle/saving/saved/error)
 * 
 * VERWIJDERD uit oude versie:
 * - "Kritiek (0)" status indicators
 * - Dienst filter toggles
 * - Ongebruikte buttons
 * - PDF Export button (komt in latere fase)
 */

// ============================================================================
// TYPE DEFINITIES
// ============================================================================

export type TeamDagdeel = 'GRO' | 'ORA' | 'TOT';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface TeamFilters {
  GRO: boolean;
  ORA: boolean;
  TOT: boolean;
}

interface ActionBarProps {
  weekBoundary: WeekBoundary;
  teamFilters: TeamFilters;
  onToggleTeam: (team: TeamDagdeel) => void;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  saveStatus: SaveStatus;
}

// ============================================================================
// HELPER COMPONENTEN
// ============================================================================

/**
 * Team toggle button met kleurcodering
 */
interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  team: TeamDagdeel;
}

const TEAM_COLORS: Record<TeamDagdeel, { bg: string; activeBg: string; text: string; activeText: string }> = {
  GRO: {
    bg: 'bg-gray-200',
    activeBg: 'bg-green-600',
    text: 'text-gray-700',
    activeText: 'text-white',
  },
  ORA: {
    bg: 'bg-gray-200',
    activeBg: 'bg-orange-600',
    text: 'text-gray-700',
    activeText: 'text-white',
  },
  TOT: {
    bg: 'bg-gray-200',
    activeBg: 'bg-purple-600',
    text: 'text-gray-700',
    activeText: 'text-white',
  },
};

function ToggleButton({ active, onClick, label, team }: ToggleButtonProps) {
  const colors = TEAM_COLORS[team];
  
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-md text-sm font-medium
        transition-all duration-200
        ${active 
          ? `${colors.activeBg} ${colors.activeText} shadow-md` 
          : `${colors.bg} ${colors.text} hover:bg-gray-300`
        }
      `}
      aria-pressed={active}
      aria-label={`${active ? 'Verberg' : 'Toon'} ${label} team`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActionBar({
  weekBoundary,
  teamFilters,
  onToggleTeam,
  onNavigateWeek,
  saveStatus,
}: ActionBarProps) {
  return (
    <div className="action-bar">
      {/* Week Navigatie Section */}
      <div className="week-navigation">
        {/* Vorige Week Button */}
        {weekBoundary.canGoBack && (
          <button
            onClick={() => onNavigateWeek('prev')}
            className="nav-button"
            aria-label="Ga naar vorige week"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Vorige week</span>
          </button>
        )}

        {/* Week Label */}
        <span className="week-label">
          {weekBoundary.weekLabel}
        </span>

        {/* Volgende Week Button */}
        {weekBoundary.canGoForward && (
          <button
            onClick={() => onNavigateWeek('next')}
            className="nav-button"
            aria-label="Ga naar volgende week"
          >
            <span>Volgende week</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Save Status Indicator */}
      <div className="save-status">
        {saveStatus === 'saved' && (
          <span className="status-saved">
            <Check className="w-4 h-4" />
            Opgeslagen
          </span>
        )}
        {saveStatus === 'saving' && (
          <span className="status-saving">
            <span className="spinner" />
            Opslaan...
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="status-error">
            ⚠️ Fout bij opslaan
          </span>
        )}
      </div>

      {/* Team Filters Section */}
      <div className="team-filters">
        <span className="filters-label">Team filters:</span>
        
        <ToggleButton
          active={teamFilters.GRO}
          onClick={() => onToggleTeam('GRO')}
          label="Groen"
          team="GRO"
        />
        
        <ToggleButton
          active={teamFilters.ORA}
          onClick={() => onToggleTeam('ORA')}
          label="Oranje"
          team="ORA"
        />
        
        <ToggleButton
          active={teamFilters.TOT}
          onClick={() => onToggleTeam('TOT')}
          label="Praktijk"
          team="TOT"
        />
      </div>

      <style jsx>{`
        .action-bar {
          position: sticky;
          top: 80px;
          z-index: 20;
          background: white;
          padding: 1rem;
          border-bottom: 2px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .week-navigation {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .nav-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .nav-button:hover {
          background: #2563eb;
        }

        .nav-button:active {
          background: #1d4ed8;
        }

        .week-label {
          font-weight: 600;
          font-size: 1.125rem;
          color: #1f2937;
          margin: 0 1rem;
          white-space: nowrap;
        }

        .save-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 150px;
        }

        .status-saved {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          color: #059669;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .status-saving {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #3b82f6;
          font-size: 0.875rem;
        }

        .status-error {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          color: #dc2626;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid #3b82f6;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .team-filters {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .filters-label {
          font-size: 0.875rem;
          color: #6b7280;
          font-weight: 500;
        }

        /* Responsive aanpassingen */
        @media (max-width: 1024px) {
          .action-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .week-navigation,
          .save-status,
          .team-filters {
            justify-content: center;
          }

          .week-label {
            margin: 0 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
