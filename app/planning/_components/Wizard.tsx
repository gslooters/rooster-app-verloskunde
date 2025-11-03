'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { computeDefaultStart, validateStartMonday, computeEnd, readRosters, writeRosters, type Roster } from '@/lib/planning/storage';
import { getActiveEmployees, type Employee } from '@/lib/planning/employees';
// Sprint 2.1: Import roster design functionality
import { initializeRosterDesign } from '@/lib/planning/rosterDesign';

function genId() { return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

// Sprint 1.1: Vast aantal weken op 5
const FIXED_WEEKS = 5;

export default function Wizard() {
  const defaultStart = useMemo(() => computeDefaultStart(), []);
  const [start, setStart] = useState<string>(defaultStart);
  // Sprint 1.1: Weeks niet meer aanpasbaar
  const weeks = FIXED_WEEKS;

  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Sprint 2.1: Loading state voor roster creatie
  const [isCreating, setIsCreating] = useState<boolean>(false);

  useEffect(() => {
    setActiveEmployees(getActiveEmployees());
  }, []);

  function openConfirm() {
    const isValidMonday = validateStartMonday(start);
    if (!isValidMonday) { 
      setError('Startdatum moet een maandag zijn'); 
      return; 
    }
    
    // Sprint 2.1: Check if we have active employees
    const activeEmployees = getActiveEmployees();
    if (activeEmployees.length === 0) {
      setError('Geen actieve medewerkers gevonden. Voeg eerst medewerkers toe in Medewerkers Beheer.');
      return;
    }
    
    setError(null);
    setShowConfirm(true);
  }

  async function createRosterConfirmed() {
    setIsCreating(true);
    setError(null);
    
    try {
      const id = genId();
      const end = computeEnd(start);
      
      // Sprint 2.1: Create roster with status 'draft'
      const roster: Roster = {
        id,
        start_date: start,
        end_date: end,
        status: 'draft',
        created_at: new Date().toISOString(),
      };
      
      // Save roster to storage
      const list = readRosters().filter(x => x.id !== roster.id);
      list.push(roster);
      writeRosters(list);
      
      // Sprint 2.1: Initialize roster design with employee snapshot
      const designData = initializeRosterDesign(roster.id);
      console.log('Roster design initialized:', designData);
      
      // Sprint 2.1: Redirect to design page instead of direct grid
      window.location.href = `/planning/design?rosterId=${roster.id}`;
      
    } catch (err) {
      console.error('Error creating roster:', err);
      setError('Er is een fout opgetreden bij het aanmaken van het rooster. Probeer opnieuw.');
      setIsCreating(false);
    }
  }

  return (
    <section className="p-4 border rounded bg-white">
      <h2 className="text-lg font-semibold mb-3">Nieuw rooster</h2>

      {error && <p className="text-red-600 mb-2">{error}</p>}

      <div className="flex flex-col gap-3 max-w-md">
        <label className="flex items-center justify-between gap-3">
          <span>Startdatum (moet maandag zijn)</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border rounded px-2 py-1"
            disabled={isCreating}
          />
        </label>

        {/* Sprint 1.1: Toon vast aantal weken, niet meer bewerkbaar */}
        <div className="flex items-center justify-between gap-3">
          <span>Aantal weken</span>
          <div className="border rounded px-2 py-1 w-24 bg-gray-100 text-gray-600 text-center">
            {FIXED_WEEKS}
          </div>
        </div>
        
        <p className="text-sm text-gray-600">
          Alle roosters worden gemaakt voor {FIXED_WEEKS} weken.
        </p>

        <button
          type="button"
          onClick={openConfirm}
          disabled={isCreating}
          className="px-3 py-2 border rounded bg-gray-900 text-white w-fit disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Rooster wordt aangemaakt...' : 'Creëer rooster'}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl p-4 w-[600px] max-w-[90vw]">
            <h3 className="text-md font-semibold mb-2">Bevestig actieve medewerkers</h3>
            <p className="text-sm text-gray-600 mb-2">
              Dit rooster wordt aangemaakt voor alle medewerkers die nu op <span className="font-medium">actief</span> staan. 
              {/* Sprint 2.1: Extra uitleg over snapshot */}
              Er wordt een snapshot gemaakt van deze medewerkers zodat het rooster stabiel blijft, 
              ook als later wijzigingen worden aangebracht in medewerkersbeheer.
            </p>
            <div className="max-h-[220px] overflow-auto border rounded mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1">Naam</th>
                    <th className="text-left px-2 py-1">Status</th>
                    {/* Sprint 2.1: Extra kolom voor diensten info */}
                    <th className="text-left px-2 py-1">Max diensten</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map(emp => (
                    <tr key={emp.id} className="border-t">
                      <td className="px-2 py-1">{emp.name}</td>
                      <td className="px-2 py-1">
                        <span className={`px-2 py-1 rounded text-xs ${
                          emp.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {emp.active ? 'actief' : 'inactief'}
                        </span>
                      </td>
                      {/* Sprint 2.1: Toon dat diensten later ingevuld worden */}
                      <td className="px-2 py-1 text-gray-500 text-xs">
                        Wordt later ingevuld
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Sprint 2.1: Uitleg volgende stappen */}
            <div className="bg-blue-50 p-3 rounded mb-3">
              <p className="text-sm text-blue-800">
                <strong>Volgende stappen:</strong> Na aanmaken kunt u voor elke medewerker het aantal diensten instellen 
                en niet-beschikbare dagen markeren in de ontwerpfase.
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isCreating}
                className="px-3 py-2 border rounded bg-white disabled:bg-gray-100"
              >
                Annuleer
              </button>
              <button
                onClick={createRosterConfirmed}
                disabled={isCreating}
                className="px-3 py-2 border rounded bg-blue-600 text-white disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Aanmaken...
                  </span>
                ) : (
                  'Bevestig en maak rooster'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}