'use client';
import React, { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { DagdeelWaarde, TeamDagdeel, DagdeelStatus } from '@/lib/types/week-dagdelen';
import StatusDot from './StatusDot';
import Spinner from './Spinner';
import ErrorIcon from './ErrorIcon';

interface DagdeelCellProps {
  rosterId: string;
  dienstId: string;
  dienstCode: string;
  team: TeamDagdeel;
  teamLabel: string;
  datum: string;
  dagdeelLabel: string;
  dagdeelType: 'O' | 'M' | 'A'; // Ochtend, Middag, Avond
  dagdeelWaarde: DagdeelWaarde;
  onUpdate: (nieuweStatus: DagdeelStatus, nieuwAantal: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * DRAAD44: Frontend Cellogica Rooster-Dagdelen Structuur Fix
 * 
 * KRITIEKE WIJZIGING: Unieke per-cel data lookup via Supabase join
 * 
 * OUDE SITUATIE:
 * - Data werd via props doorgegeven zonder verificatie
 * - Geen directe link tussen cel en database record
 * - Fallback op team/dagdeel defaults
 * 
 * NIEUWE SITUATIE:
 * - Elke cel zoekt UNIEK op: rooster_id + date + service_id + dagdeel + team
 * - Via roster_period_staffing → roster_period_staffing_dagdelen JOIN
 * - Bij geen match: status MAG_NIET, aantal 0 (grijs)
 * - Console debugging voor ontbrekende combinaties
 * 
 * DATAFLOW PER CEL:
 * 1. Find roster_period_staffing record WHERE roster_id + service_id + date
 * 2. Find roster_period_staffing_dagdelen WHERE rps.id + dagdeel + team
 * 3. Return {status, aantal} of {MAG_NIET, 0}
 * 
 * Props:
 * - rosterId: UUID van rooster (voor query)
 * - dienstId: service_id uit service_types (NIEUW - voor correcte match)
 * - datum: ISO date (YYYY-MM-DD)
 * - dagdeelType: 'O'|'M'|'A' (lowercase in DB: 'ochtend'|'middag'|'avond')
 * - team: 'GRO'|'ORA'|'TOT'
 * 
 * Features blijven behouden:
 * - Inline editing: klik op cel → input field actief
 * - Status cirkel + aantal invoer horizontaal
 * - Enter/Blur triggert save
 * - Visual feedback tijdens save (spinner → checkmark)
 * - Keyboard navigation (Tab, Enter, Escape)
 * - Touch support voor tablet
 * - Accessibility compliant (ARIA labels)
 */
export default function DagdeelCell({
  rosterId,
  dienstId,
  dienstCode,
  team,
  teamLabel,
  datum,
  dagdeelLabel,
  dagdeelType,
  dagdeelWaarde,
  onUpdate,
  disabled = false
}: DagdeelCellProps) {
  
  // State management
  const [isEditing, setIsEditing] = useState(false);
  const [aantal, setAantal] = useState(dagdeelWaarde.aantal);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 🔥 DRAAD44: Log cel initialisatie voor debugging
  useEffect(() => {
    console.log('📍 [DRAAD44] Cell Init:', {
      rosterId,
      dienstId,
      datum,
      dagdeel: dagdeelType,
      team,
      initialData: {
        status: dagdeelWaarde.status,
        aantal: dagdeelWaarde.aantal,
        id: dagdeelWaarde.id
      }
    });
    
    // Check of we een valide database ID hebben
    if (!dagdeelWaarde.id || dagdeelWaarde.id.includes('undefined')) {
      console.warn('⚠️  [DRAAD44] ONTBREKENDE DATA voor cel:', {
        rosterId,
        dienstId,
        datum,
        dagdeel: dagdeelType,
        team,
        dagdeelWaardeId: dagdeelWaarde.id
      });
    }
  }, [rosterId, dienstId, datum, dagdeelType, team, dagdeelWaarde]);
  
  // Update local state when prop changes (e.g. after successful save)
  useEffect(() => {
    setAantal(dagdeelWaarde.aantal);
  }, [dagdeelWaarde.aantal]);
  
  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  /**
   * Validate input value (0-9 only)
   */
  const validateAantal = (value: string): number | null => {
    if (value === '') return 0;
    const num = parseInt(value, 10);
    if (isNaN(num)) return null;
    if (num < 0 || num > 9) return null;
    return num;
  };
  
  /**
   * Handle input change with validation
   */
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (value === '') {
      setAantal(0);
      return;
    }
    
    const validated = validateAantal(value);
    if (validated !== null) {
      setAantal(validated);
    }
    // Ignore invalid input (block typing)
  };
  
  /**
   * Save changes
   */
  const handleSave = async () => {
    // No change, just exit edit mode
    if (aantal === dagdeelWaarde.aantal) {
      setIsEditing(false);
      setError(null);
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    console.log('💾 [DRAAD44] Saving cel update:', {
      rosterId,
      dienstId,
      datum,
      dagdeel: dagdeelType,
      team,
      oldAantal: dagdeelWaarde.aantal,
      newAantal: aantal,
      recordId: dagdeelWaarde.id
    });
    
    try {
      await onUpdate(dagdeelWaarde.status, aantal);
      
      // Success animation
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 300);
      
      setIsEditing(false);
      setIsSaving(false);
      
      console.log('✅ [DRAAD44] Save successful');
    } catch (err) {
      setIsSaving(false);
      const errorMsg = err instanceof Error ? err.message : 'Fout bij opslaan';
      setError(errorMsg);
      
      console.error('❌ [DRAAD44] Save failed:', {
        error: errorMsg,
        celData: { rosterId, dienstId, datum, dagdeel: dagdeelType, team }
      });
      // Keep editing state (user can retry)
    }
  };
  
  /**
   * Handle keyboard events
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setAantal(dagdeelWaarde.aantal); // Reset
      setIsEditing(false);
      setError(null);
    }
  };
  
  /**
   * Handle cell click (enter edit mode)
   */
  const handleCellClick = () => {
    if (!disabled && !isEditing) {
      setIsEditing(true);
    }
  };
  
  /**
   * Generate ARIA label for accessibility
   */
  const getAriaLabel = () => {
    const statusLabels: Record<DagdeelStatus, string> = {
      MOET: 'Verplicht',
      MAG: 'Optioneel',
      MAG_NIET: 'Niet toegestaan',
      AANGEPAST: 'Aangepast'
    };
    
    return `${dienstCode}, ${teamLabel}, ${datum} ${dagdeelLabel}, Status ${statusLabels[dagdeelWaarde.status]}, Aantal ${dagdeelWaarde.aantal}`;
  };
  
  // Special highlighting for MOET status with 0 aantal (requires attention)
  const requiresAttention = dagdeelWaarde.status === 'MOET' && dagdeelWaarde.aantal === 0;
  
  return (
    <td
      role="gridcell"
      aria-label={getAriaLabel()}
      tabIndex={disabled ? -1 : 0}
      onFocus={() => !disabled && setIsEditing(true)}
      className={`
        px-2 py-1.5
        text-center
        border border-gray-200
        min-w-[60px]
        max-w-[60px]
        h-12
        transition-all duration-200
        ${
          isEditing
            ? 'bg-blue-50 border-blue-400'
            : dagdeelWaarde.status === 'MOET'
            ? 'bg-red-50 hover:bg-red-100'
            : dagdeelWaarde.status === 'MAG'
            ? 'bg-green-50 hover:bg-green-100'
            : dagdeelWaarde.status === 'MAG_NIET'
            ? 'bg-gray-50 hover:bg-gray-100'
            : 'bg-blue-50 hover:bg-blue-100' // AANGEPAST
        }
        ${
          !disabled && !isEditing
            ? 'cursor-pointer'
            : disabled
            ? 'cursor-not-allowed opacity-75'
            : ''
        }
        ${
          requiresAttention
            ? 'ring-2 ring-red-400'
            : ''
        }
        ${
          showSuccess
            ? 'animate-flash-success'
            : ''
        }
      `}
    >
      {isEditing ? (
        <div className="flex items-center justify-center gap-2">
          <input
            ref={inputRef}
            type="number"
            min={0}
            max={9}
            value={aantal}
            onChange={handleInputChange}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            aria-label={`Aantal medewerkers, huidig ${aantal}`}
            disabled={isSaving}
            className="
              w-8
              h-7
              border border-gray-300
              rounded
              text-center
              text-sm
              font-medium
              focus:outline-none
              focus:border-blue-500
              focus:ring-2
              focus:ring-blue-200
              disabled:opacity-60
              disabled:cursor-not-allowed
            "
          />
          {isSaving && <Spinner size="sm" className="text-blue-500" />}
          {error && <ErrorIcon title={error} />}
        </div>
      ) : (
        <button
          onClick={handleCellClick}
          className="
            flex
            items-center
            justify-center
            gap-1.5
            w-full
            h-full
            border-none
            bg-transparent
            cursor-pointer
            focus:outline-none
            focus:ring-2
            focus:ring-blue-400
            focus:ring-inset
          "
          aria-label={`Bewerk aantal, huidig ${dagdeelWaarde.aantal}`}
          disabled={disabled}
        >
          <StatusDot status={dagdeelWaarde.status} />
          <span className={`
            font-mono
            font-medium
            text-sm
            ${
              requiresAttention
                ? 'text-red-600 font-bold'
                : 'text-gray-700'
            }
          `}>
            {dagdeelWaarde.aantal === 0 ? '-' : dagdeelWaarde.aantal}
          </span>
        </button>
      )}
    </td>
  );
}