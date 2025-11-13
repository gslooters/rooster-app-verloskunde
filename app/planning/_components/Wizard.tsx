'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatWeekRange, computeEnd } from '@/lib/planning/storage';
import { createRooster } from '@/lib/services/roosters-supabase';
import { initializeRosterDesign } from '@/lib/planning/rosterDesign';
import { initializePeriodEmployeeStaffing } from '@/lib/services/period-employee-staffing';
import { getAllEmployees } from '@/lib/services/employees-storage';

interface WizardProps {
  onClose?: () => void;
}

export default function Wizard({ onClose }: WizardProps) {
  const router = useRouter();
  const [selectedStart, setSelectedStart] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Genereer de eerstvolgende maandag vanaf vandaag
  React.useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    setSelectedStart(nextMonday.toISOString().split('T')[0]);
  }, []);

  async function createRosterConfirmed() {
    if (!selectedStart) {
      setError('Selecteer een startdatum');
      return;
    }
    setIsCreating(true);
    setError('');
    try {
      const endDate = computeEnd(selectedStart);
      console.log('[Wizard] Start rooster creatie met start:', selectedStart, 'end:', endDate);

      // 1. Maak rooster aan in database
      const rooster = await createRooster({ start_date: selectedStart, end_date: endDate });
      const rosterId = rooster.id;
      console.log('[Wizard] Rooster aangemaakt met ID:', rosterId);

      // 2. Initialiseer roster design
      await initializeRosterDesign(rosterId, selectedStart);
      console.log('[Wizard] Roster design geïnitialiseerd');

      // 3. Initialiseer period_employee_staffing
      try {
        const allEmployees = getAllEmployees();
        const activeEmployeeIds = allEmployees
          .filter(emp => emp.actief)
          .map(emp => emp.id);
        await initializePeriodEmployeeStaffing(rosterId, activeEmployeeIds);
        console.log('[Wizard] Period employee staffing geïnitialiseerd');
      } catch (err) {
        console.error('[Wizard] Fout bij initialiseren period employee staffing:', err);
        // Ga door - niet kritiek voor rooster aanmaak
      }
      // 4. Navigeer naar dashboard
      if (onClose) onClose();
      router.push(`/planning/design/dashboard?rosterId=${rosterId}`);
    } catch (err) {
      console.error('[Wizard] Fout bij rooster creatie:', err);
      setError('Er is een fout opgetreden bij het aanmaken van het rooster. Probeer het opnieuw.');
      setIsCreating(false);
    }
  }

  // Bereken eind datum (start + 34 dagen = 5 weken)
  const endDate = selectedStart ? computeEnd(selectedStart) : '';
  const weekRange = selectedStart && endDate ? formatWeekRange(selectedStart, endDate) : '';

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecteer startdatum (maandag)
        </label>
        <input
          type="date"
          value={selectedStart}
          onChange={(e) => setSelectedStart(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isCreating}
        />
        {weekRange && (
          <p className="mt-2 text-sm text-gray-600">
            Planning voor: <span className="font-medium">{weekRange}</span>
          </p>
        )}
      </div>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}
      <div className="flex gap-3 justify-end">
        {onClose && (
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuleren
          </button>
        )}
        <button
          onClick={createRosterConfirmed}
          disabled={!selectedStart || isCreating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isCreating ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Bezig met aanmaken...</span>
            </>
          ) : (
            'Rooster aanmaken'
          )}
        </button>
      </div>
    </div>
  );
}
