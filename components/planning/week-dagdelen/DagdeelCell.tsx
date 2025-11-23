'use client';
import React, { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { DagdeelWaarde, TeamDagdeel, DagdeelStatus } from '@/lib/types/week-dagdelen';
import { getCelDataClient, CelData } from '@/lib/planning/getCelDataClient';
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
 * DRAAD45.3: Complete Data Pipeline - Database Lookup per Cel
 * 
 * PROBLEEM OPGELOST:
 * - ALLE cellen toonden identieke data (groen, MAG, 0)
 * - Data werd opgehaald maar niet correct per cel gematcht
 * - Props waren toegevoegd maar niet gebruikt voor database lookup
 * 
 * NIEUWE IMPLEMENTATIE:
 * - useEffect haalt per cel data op via getCelDataClient()
 * - Match via rosterId + dienstId + datum + dagdeel + team
 * - Query via roster_period_staffing -> roster_period_staffing_dagdelen JOIN
 * - Bij geen match: fallback naar MAG_NIET, grijs, disabled
 * - Loading state tijdens fetch
 * - Error handling met retry optie
 * 
 * DATAFLOW PER CEL:
 * 1. Component mount -> useEffect triggered
 * 2. getCelDataClient() zoekt database record
 * 3. setState met {status, aantal, loading: false}
 * 4. Rendering met correcte kleuren en waarden
 * 
 * VERIFICATIE:
 * - Console: [DRAAD45] logs per cel met input/output
 * - Visual: Rode/groene/grijze cellen
 * - Data: Variërende aantallen per cel
 * 
 * Features behouden:
 * - Inline editing: klik op cel -> input field actief
 * - Status cirkel + aantal invoer horizontaal
 * - Enter/Blur triggert save
 * - Visual feedback tijdens save (spinner -> checkmark)
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
  
  // 🔥 DRAAD45.3: Cel data state met loading indicator
  const [celData, setCelData] = useState<CelData & { loading: boolean }>({
    status: dagdeelWaarde.status,  // Initial fallback from prop
    aantal: dagdeelWaarde.aantal,
    loading: true
  });
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [aantal, setAantal] = useState(celData.aantal);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 🔥 DRAAD45.3: Database lookup per cel
  useEffect(() => {
    let cancelled = false;
    
    async function fetchCelData() {
      console.log('[DRAAD45] Cel init - starting fetch:', {
        rosterId: rosterId.substring(0, 8) + '...',
        dienstId,
        datum,
        dagdeel: dagdeelType,
        team
      });
      
      try {
        const data = await getCelDataClient(
          rosterId,
          dienstId,
          datum,
          dagdeelType,
          team
        );
        
        if (!cancelled) {
          setCelData({
            ...data,
            loading: false
          });
          
          // Update aantal in editing state
          setAantal(data.aantal);
          
          console.log('[DRAAD45] ✅ Cel data loaded:', {
            datum,
            dagdeel: dagdeelType,
            team,
            data
          });
        }
      } catch (error) {
        console.error('[DRAAD45] ❌ Cel data fetch failed:', {
          error: error instanceof Error ? error.message : String(error),
          celInfo: { rosterId: rosterId.substring(0, 8) + '...', dienstId, datum, dagdeel: dagdeelType, team }
        });
        
        if (!cancelled) {
          // Fallback bij error
          setCelData({
            status: 'MAG_NIET',
            aantal: 0,
            loading: false
          });
          setAantal(0);
        }
      }
    }
    
    fetchCelData();
    
    // Cleanup: prevent state updates na unmount
    return () => {
      cancelled = true;
    };
  }, [rosterId, dienstId, datum, dagdeelType, team]);
  
  // Update local aantal when celData changes (after fetch or update)
  useEffect(() => {
    setAantal(celData.aantal);
  }, [celData.aantal]);
  
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
    if (aantal === celData.aantal) {
      setIsEditing(false);
      setError(null);
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    console.log('💾 [DRAAD45] Saving cel update:', {
      rosterId: rosterId.substring(0, 8) + '...',
      dienstId,
      datum,
      dagdeel: dagdeelType,
      team,
      oldAantal: celData.aantal,
      newAantal: aantal
    });
    
    try {
      await onUpdate(celData.status, aantal);
      
      // Update local state
      setCelData(prev => ({
        ...prev,
        aantal: aantal
      }));
      
      // Success animation
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 300);
      
      setIsEditing(false);
      setIsSaving(false);
      
      console.log('✅ [DRAAD45] Save successful');
    } catch (err) {
      setIsSaving(false);
      const errorMsg = err instanceof Error ? err.message : 'Fout bij opslaan';
      setError(errorMsg);
      
      console.error('❌ [DRAAD45] Save failed:', {
        error: errorMsg,
        celData: { rosterId: rosterId.substring(0, 8) + '...', dienstId, datum, dagdeel: dagdeelType, team }
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
      setAantal(celData.aantal); // Reset
      setIsEditing(false);
      setError(null);
    }
  };
  
  /**
   * Handle cell click (enter edit mode)
   */
  const handleCellClick = () => {
    if (!disabled && !isEditing && !celData.loading) {
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
    
    return `${dienstCode}, ${teamLabel}, ${datum} ${dagdeelLabel}, Status ${statusLabels[celData.status]}, Aantal ${celData.aantal}`;
  };
  
  // 🔥 DRAAD45.3: Loading state
  if (celData.loading) {
    return (
      <td
        className="px-2 py-1.5 text-center border border-gray-200 bg-gray-100 min-w-[60px] max-w-[60px] h-12"
      >
        <div className="flex items-center justify-center">
          <Spinner size="sm" className="text-gray-400" />
        </div>
      </td>
    );
  }
  
  // Special highlighting for MOET status with 0 aantal (requires attention)
  const requiresAttention = celData.status === 'MOET' && celData.aantal === 0;
  
  return (
    <td
      role="gridcell"
      aria-label={getAriaLabel()}
      tabIndex={disabled ? -1 : 0}
      onFocus={() => !disabled && !celData.loading && setIsEditing(true)}
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
            : celData.status === 'MOET'
            ? 'bg-red-50 hover:bg-red-100'
            : celData.status === 'MAG'
            ? 'bg-green-50 hover:bg-green-100'
            : celData.status === 'MAG_NIET'
            ? 'bg-gray-50 hover:bg-gray-100'
            : 'bg-blue-50 hover:bg-blue-100' // AANGEPAST
        }
        ${
          !disabled && !isEditing && !celData.loading
            ? 'cursor-pointer'
            : disabled || celData.loading
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
          aria-label={`Bewerk aantal, huidig ${celData.aantal}`}
          disabled={disabled || celData.loading}
        >
          <StatusDot status={celData.status} />
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
            {celData.aantal === 0 ? '-' : celData.aantal}
          </span>
        </button>
      )}
    </td>
  );
}
