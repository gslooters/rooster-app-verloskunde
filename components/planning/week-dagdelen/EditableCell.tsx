'use client';

import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  dagdeelId?: string;
  status: 'MOET' | 'MAG' | 'MAG-NIET' | 'AANGEPAST';  // ⭐ DRAAD65A: AANGEPAST toegevoegd
  aantal: number;
  onUpdate: (dagdeelId: string, newAantal: number) => Promise<void>;
}

// ⭐ DRAAD65A: AANGEPAST status met blauw bolletje toegevoegd
const STATUS_COLORS = {
  MOET: '#ef4444',       // Rood
  MAG: '#22c55e',        // Groen
  'MAG-NIET': '#9ca3af', // Grijs
  AANGEPAST: '#3b82f6',  // ⭐ Blauw (door planner gewijzigd)
};

/**
 * DRAAD65A - Bewerkbare Cel Component met Aangepast Status
 * 
 * NIEUW IN DRAAD65A:
 * - Blauw bolletje voor status 'AANGEPAST'
 * - Cijfer 0 wordt getoond als "-" (intern blijft 0)
 * - Gebruiker kan nog steeds 0 invoeren
 * 
 * Bestaande functionaliteit (DRAAD42):
 * - Status cirkel (rood/groen/grijs/blauw)
 * - Inline bewerkbaar getal (0-9)
 * - Auto-save bij blur
 * - Visual feedback tijdens update
 */
export default function EditableCell({
  dagdeelId,
  status,
  aantal,
  onUpdate,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(aantal.toString());
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local value wanneer prop changes (na fetch)
  useEffect(() => {
    setValue(aantal.toString());
  }, [aantal]);

  // Focus input bij edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!dagdeelId) return; // Geen data beschikbaar
    setIsEditing(true);
  };

  const handleBlur = async () => {
    setIsEditing(false);
    
    if (!dagdeelId) return;

    const numValue = parseInt(value);
    
    // Validatie
    if (isNaN(numValue) || numValue < 0 || numValue > 9) {
      setValue(aantal.toString()); // Reset naar originele waarde
      return;
    }

    // Alleen updaten als waarde veranderd is
    if (numValue !== aantal) {
      setIsUpdating(true);
      try {
        await onUpdate(dagdeelId, numValue);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setValue(aantal.toString());
      setIsEditing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Alleen cijfers 0-9 toestaan
    if (newValue === '' || /^[0-9]$/.test(newValue)) {
      setValue(newValue);
    }
  };

  return (
    <td 
      className={`border border-gray-300 p-2 text-center relative ${
        isUpdating ? 'bg-blue-50' : 'bg-white'
      } hover:bg-gray-50 transition-colors`}
    >
      <div className="flex items-center justify-center gap-2">
        {/* Status cirkel */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: STATUS_COLORS[status] }}
          title={status}
        />

        {/* Bewerkbaar getal - ⭐ DRAAD65A: 0 tonen als "-" */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={1}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-10 px-2 py-1 border border-blue-500 rounded text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <span
            onClick={handleClick}
            className={`cursor-pointer px-2 py-1 rounded font-medium min-w-[32px] inline-block ${
              dagdeelId
                ? 'hover:bg-blue-100 hover:text-blue-700'
                : 'text-gray-400 cursor-not-allowed'
            }`}
            title={dagdeelId ? 'Klik om te bewerken' : 'Geen data beschikbaar'}
          >
            {aantal === 0 ? '-' : aantal}
          </span>
        )}

        {/* Loading indicator */}
        {isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-50">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </td>
  );
}
