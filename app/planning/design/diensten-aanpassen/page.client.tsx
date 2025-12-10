'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getRosterIdFromParams } from '@/lib/utils/getRosterIdFromParams';
import { fetchNoCache } from '@/lib/utils/fetchNoCache'; // DRAAD163-FIX: Client-side cache busting
import { PlanInformatieModal } from '../componenten/PlanInformatieModal';
import type {
  DienstenAanpassenData,
  Employee,
  ServiceType,
  TeamTotals,
  UpdateServiceRequest
} from '@/types/diensten-aanpassen';

/**
 * Client component voor "Diensten per medewerker aanpassen" scherm
 * DRAAD66J - FIX: Terug-knop navigatie naar correct dashboard
 * DRAAD159 - NEW: Planinformatie modal knop toegevoegd
 * DRAAD163 - FIX: Client-side cache busting met fetchNoCache utility
 */
export default function DienstenAanpassenClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = getRosterIdFromParams(searchParams);

  const [data, setData] = useState<DienstenAanpassenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStates, setSavingStates] = useState<Set<string>>(new Set());
  const [isPlanInformatieOpen, setIsPlanInformatieOpen] = useState(false);

  // Data ophalen bij mount
  useEffect(() => {
    if (!rosterId) {
      setError('Geen roster ID gevonden');
      setLoading(false);
      return;
    }

    fetchData();
  }, [rosterId]);

  // DRAAD163-FIX: Use fetchNoCache instead of plain fetch
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetchNoCache(
        `/api/diensten-aanpassen?rosterId=${rosterId}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Fout bij ophalen gegevens');
      }

      const result: DienstenAanpassenData = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
    } finally {
      setLoading(false);
    }
  };

  // Save functie met optimistic update
  const saveService = useCallback(async (
    employeeId: string,
    serviceId: string,
    aantal: number,
    actief: boolean
  ) => {
    if (!rosterId) return;

    const saveKey = `${employeeId}_${serviceId}`;
    setSavingStates(prev => new Set(prev).add(saveKey));

    try {
      const requestBody: UpdateServiceRequest = {
        rosterId,
        employeeId,
        serviceId,
        aantal,
        actief
      };

      const response = await fetch('/api/diensten-aanpassen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Fout bij opslaan');
      }

      // Success - korte visuele feedback
      setTimeout(() => {
        setSavingStates(prev => {
          const newSet = new Set(prev);
          newSet.delete(saveKey);
          return newSet;
        });
      }, 800);

    } catch (err) {
      console.error('Save error:', err);
      alert('Fout bij opslaan. Probeer opnieuw.');
      setSavingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(saveKey);
        return newSet;
      });
    }
  }, [rosterId]);

  // Checkbox toggle handler
  const handleCheckboxChange = useCallback((employeeId: string, serviceId: string, checked: boolean) => {
    if (!data) return;

    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        employees: prev.employees.map(emp => 
          emp.id === employeeId
            ? {
                ...emp,
                services: emp.services.map(svc =>
                  svc.serviceId === serviceId
                    ? { ...svc, actief: checked, aantal: checked ? (svc.aantal || 1) : 0 }
                    : svc
                )
              }
            : emp
        )
      };
    });

    // Save to backend
    const employee = data.employees.find(e => e.id === employeeId);
    const service = employee?.services.find(s => s.serviceId === serviceId);
    const aantal = checked ? (service?.aantal || 1) : 0;
    
    saveService(employeeId, serviceId, aantal, checked);
  }, [data, saveService]);

  // Aantal input change handler
  const handleAantalChange = useCallback((employeeId: string, serviceId: string, newAantal: number) => {
    if (!data) return;

    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        employees: prev.employees.map(emp => 
          emp.id === employeeId
            ? {
                ...emp,
                services: emp.services.map(svc =>
                  svc.serviceId === serviceId
                    ? { ...svc, aantal: newAantal }
                    : svc
                )
              }
            : emp
        )
      };
    });
  }, [data]);

  // Aantal input blur handler (save)
  const handleAantalBlur = useCallback((employeeId: string, serviceId: string) => {
    if (!data) return;

    const employee = data.employees.find(e => e.id === employeeId);
    const service = employee?.services.find(s => s.serviceId === serviceId);
    
    if (service && service.actief) {
      saveService(employeeId, serviceId, service.aantal, service.actief);
    }
  }, [data, saveService]);

  // Gewogen totaal per medewerker (aantal × dienstwaarde)
  const getEmployeeTotal = useCallback((employee: Employee): number => {
    return employee.services
      .filter(s => s.actief)
      .reduce((sum, s) => sum + (s.aantal * s.dienstwaarde), 0);
  }, []);

  // Team totalen (ongewogen)
  const teamTotals = useMemo((): TeamTotals => {
    if (!data) return {};
    const totals: TeamTotals = {};
    data.serviceTypes.forEach(serviceType => {
      totals[serviceType.id] = {
        groen: 0,
        oranje: 0,
        overig: 0,
        totaal: 0
      };
    });
    data.employees.forEach(employee => {
      employee.services.forEach(service => {
        if (!service.actief) return;
        const teamKey = employee.team.toLowerCase() as 'groen' | 'oranje' | 'overig';
        if (totals[service.serviceId]) {
          totals[service.serviceId][teamKey] += service.aantal;
          totals[service.serviceId].totaal += service.aantal;
        }
      });
    });
    return totals;
  }, [data]);

  // Team kleur helpers
  const getTeamColor = (team: string): string => {
    switch (team.toLowerCase()) {
      case 'groen': return 'bg-green-100 text-green-800';
      case 'oranje': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTeamTextColor = (team: string): string => {
    switch (team.toLowerCase()) {
      case 'groen': return 'text-green-700';
      case 'oranje': return 'text-orange-700';
      default: return 'text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Laden...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error || 'Geen data beschikbaar'}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* DRAAD159: Modal component */}
      <PlanInformatieModal 
        isOpen={isPlanInformatieOpen} 
        onClose={() => setIsPlanInformatieOpen(false)}
        rosterId={rosterId || ''}
      />

      {/* Header - DRAAD66J: GEFIXTE navigatie naar Dashboard Rooster Ontwerp */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => router.push(`/planning/design/dashboard?rosterId=${rosterId}`)}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            <span>←</span>
            <span>Terug naar Dashboard</span>
          </button>
          <div className="flex gap-2">
            {/* DRAAD159: Planinformatie button - rechts boven, links naast bestaande knop */}
            <button
              onClick={() => setIsPlanInformatieOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors flex items-center gap-2"
            >
              📊 Planinformatie
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            >
              🔄 Vernieuwen
            </button>
          </div>
        </div>
        <h1 className="text-3xl font-bold">
          Diensten Toewijzing AANPASSEN : PERIODE Week {data.roster.startWeek} t/m Week {data.roster.endWeek}
        </h1>
      </div>
      {/* rest van UI exact zoals voorheen */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 sticky left-0 bg-gray-100 z-10">Team</th>
              <th className="border border-gray-300 px-3 py-2 sticky left-[80px] bg-gray-100 z-10 w-32">Naam</th>
              <th className="border border-gray-300 px-4 py-2 sticky left-[192px] bg-gray-100 z-10">Telling</th>
              {data.serviceTypes.map(serviceType => (
                <th key={serviceType.id} className="border border-gray-300 px-2 py-2 min-w-[100px]">
                  <div
                    className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: serviceType.kleur || '#e5e7eb',
                      color: '#000'
                    }}
                  >
                    {serviceType.code}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.employees.map(employee => {
              const total = getEmployeeTotal(employee);
              
              return (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className={`border border-gray-300 px-4 py-2 sticky left-0 z-10 ${getTeamColor(employee.team)}`}>
                    {employee.team}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 sticky left-[80px] bg-white z-10 w-32">
                    {employee.voornaam}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 sticky left-[192px] bg-white z-10 font-semibold">
                    {total}
                  </td>
                  {employee.services.map(service => {
                    const saveKey = `${employee.id}_${service.serviceId}`;
                    const isSaving = savingStates.has(saveKey);
                    
                    return (
                      <td key={service.serviceId} className="border border-gray-300 px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="checkbox"
                            checked={service.actief}
                            onChange={(e) => handleCheckboxChange(employee.id, service.serviceId, e.target.checked)}
                            className="w-4 h-4 cursor-pointer"
                          />
                          {service.actief && (
                            <input
                              type="number"
                              min="0"
                              value={service.aantal}
                              onChange={(e) => handleAantalChange(employee.id, service.serviceId, parseInt(e.target.value) || 0)}
                              onBlur={() => handleAantalBlur(employee.id, service.serviceId)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                            />
                          )}
                          {isSaving && (
                            <span className="text-green-500 text-sm">✓</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="bg-gray-100 font-semibold">
              <td colSpan={3} className="border border-gray-300 px-4 py-2 text-right">
                Totalen per team:
              </td>
              {data.serviceTypes.map(serviceType => {
                const totals = teamTotals[serviceType.id];
                if (!totals) return <td key={serviceType.id} />;
                return (
                  <td key={serviceType.id} className="border border-gray-300 px-2 py-2 text-center">
                    <div className="text-xs space-y-1">
                      <div className={getTeamTextColor('groen')}>{totals.groen}</div>
                      <div className={getTeamTextColor('oranje')}>{totals.oranje}</div>
                      <div className="font-bold">{totals.totaal}</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 border border-gray-400 rounded bg-gray-50 text-sm text-gray-700">
        Telling betreft het aantal diensten + de gewogen dienstwaarde per dienst
      </div>
    </div>
  );
}