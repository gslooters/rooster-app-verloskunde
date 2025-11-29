'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Home } from 'lucide-react';
import { 
  getPrePlanningData,
  savePrePlanningAssignment,
  deletePrePlanningAssignment,
  getEmployeesWithServices
} from '@/lib/services/preplanning-storage';
import { EmployeeWithServices, PrePlanningAssignment } from '@/lib/types/preplanning';
import { getDatesForRosterPeriod, groupDatesByWeek } from '@/lib/utils/roster-date-helpers';
import { loadRosterDesignData } from '@/lib/planning/rosterDesign';
import { getRosterById } from '@/lib/services/roosters-supabase';
import StatusBadge from '@/app/planning/_components/StatusBadge';

/**
 * Client Component voor PrePlanning scherm (Ontwerpfase)
 * 
 * Dit scherm toont:
 * - Grid met 35 dagen (5 weken) als kolommen
 * - Medewerkers als rijen
 * - Dropdown per cel voor dienst-selectie
 * - Alleen diensten die medewerker kan uitvoeren
 * - Data wordt opgeslagen in Supabase roster_assignments
 * 
 * VERSIE: DRAAD 77 - Type fix voor dagdeel/status/service_id
 * - Fix TypeScript error door complete PrePlanningAssignment te creëren
 * - Dagdeel default 'O' voor backwards compatibility
 * - Status 1 (dienst) bij service assignment
 * - service_id null voor legacy mode (wordt later uitgebreid)
 */
export default function PrePlanningClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rosterId = searchParams.get('id');

  const [employees, setEmployees] = useState<EmployeeWithServices[]>([]);
  const [assignments, setAssignments] = useState<PrePlanningAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [rosterStatus, setRosterStatus] = useState<'draft' | 'in_progress' | 'final'>('draft');

  // Load data
  useEffect(() => {
    if (!rosterId) {
      alert('Geen rooster ID gevonden');
      router.push('/planning/design');
      return;
    }

    async function loadData() {
      try {
        setIsLoading(true);
        
        // Haal roster op voor status en periode info
        const roster = await getRosterById(rosterId!);
        if (!roster) {
          alert('Rooster niet gevonden');
          router.push('/planning/design');
          return;
        }

        // Sla rooster status op
        setRosterStatus(roster.status);

        // Gebruik start_date uit roster
        const start = roster.start_date;
        if (!start) {
          alert('Geen startdatum gevonden voor rooster');
          return;
        }

        // Bereken einddatum (34 dagen na start = 35 dagen totaal)
        const startDateObj = new Date(start);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + 34);
        const end = endDateObj.toISOString().split('T')[0];

        setStartDate(start);
        setEndDate(end);

        // Haal medewerkers met hun diensten op
        const employeesData = await getEmployeesWithServices();
        setEmployees(employeesData);

        // Haal bestaande assignments op
        const assignmentsData = await getPrePlanningData(rosterId!, start, end);
        setAssignments(assignmentsData);

      } catch (error) {
        console.error('[PrePlanning] Error loading data:', error);
        alert('Fout bij laden van preplanning data');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [rosterId, router]);

  // Genereer datum-info voor headers
  const dateInfo = useMemo(() => {
    if (!startDate) return [];
    return getDatesForRosterPeriod(startDate, []);
  }, [startDate]);

  const weekGroups = useMemo(() => {
    return groupDatesByWeek(dateInfo);
  }, [dateInfo]);

  // Maak lookup map voor snelle assignment lookups
  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>(); // key: employeeId_date, value: serviceCode
    assignments.forEach(assignment => {
      const key = `${assignment.employee_id}_${assignment.date}`;
      map.set(key, assignment.service_code);
    });
    return map;
  }, [assignments]);

  // Handler voor dropdown change
  const handleServiceChange = useCallback(async (
    employeeId: string,
    date: string,
    serviceCode: string
  ) => {
    if (!rosterId) return;

    setIsSaving(true);
    
    try {
      if (serviceCode === '') {
        // Leeg = verwijder assignment
        const success = await deletePrePlanningAssignment(rosterId, employeeId, date);
        if (success) {
          // Update local state
          setAssignments(prev => 
            prev.filter(a => !(a.employee_id === employeeId && a.date === date))
          );
        } else {
          alert('Fout bij verwijderen dienst. Probeer opnieuw.');
        }
      } else {
        // Sla assignment op
        const success = await savePrePlanningAssignment(rosterId, employeeId, date, serviceCode);
        if (success) {
          // Update local state - FIXED: Complete PrePlanningAssignment object
          setAssignments(prev => {
            const filtered = prev.filter(a => !(a.employee_id === employeeId && a.date === date));
            const newAssignment: PrePlanningAssignment = {
              id: crypto.randomUUID(),
              roster_id: rosterId,
              employee_id: employeeId,
              service_code: serviceCode,
              date: date,
              // DRAAD 77: Nieuwe vereiste velden
              dagdeel: 'O', // Default ochtend voor backwards compatibility
              status: 1, // Status 1 = dienst
              service_id: null, // Legacy mode - wordt later uitgebreid met service lookup
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            return [...filtered, newAssignment];
          });
        } else {
          alert('Fout bij opslaan dienst. Probeer opnieuw.');
        }
      }
    } catch (error) {
      console.error('[PrePlanning] Error handling service change:', error);
      alert('Fout bij wijzigen dienst.');
    } finally {
      setIsSaving(false);
    }
  }, [rosterId]);

  const handleBackToDashboard = useCallback(() => {
    router.push(`/planning/design/dashboard?rosterId=${rosterId}`);
  }, [rosterId, router]);

  // Status-afhankelijke content
  const headerPrefix = useMemo(() => {
    switch(rosterStatus) {
      case 'draft':
        return 'Pre-planning:';
      case 'in_progress':
        return 'Planrooster:';
      case 'final':
        return 'Planrooster (Afgesloten):';
    }
  }, [rosterStatus]);

  const infoBannerText = useMemo(() => {
    switch(rosterStatus) {
      case 'draft':
        return 'Pre-planning: Wijs specifieke diensten toe aan medewerkers voor deze periode. Alleen diensten die een medewerker kan uitvoeren zijn beschikbaar in een pop-up na klikken de cel in het rooster (medewerker/datum/dagdeel)';
      case 'in_progress':
        return 'Planrooster: Bewerk het rooster door op cellen te klikken. Wijzigingen worden automatisch opgeslagen.';
      case 'final':
        return 'Planrooster (Afgesloten): Dit rooster is afgesloten en kan alleen worden geraadpleegd. Exporteer naar PDF indien nodig.';
    }
  }, [rosterStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">PrePlanning laden...</p>
        </div>
      </div>
    );
  }

  const title = weekGroups.length > 0 
    ? `${headerPrefix} Periode Week ${weekGroups[0].weekNumber} - Week ${weekGroups[weekGroups.length - 1].weekNumber} ${weekGroups[0].year}`
    : `${headerPrefix} Periode`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-xl shadow-lg">
          {/* Header met Status Badge en Terug naar Dashboard button */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
                  <span className="text-2xl mr-3">📅</span>
                  {title}
                </h1>
                <StatusBadge status={rosterStatus} />
              </div>
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 px-8 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md hover:shadow-lg font-semibold text-lg"
              >
                <Home className="w-5 h-5" />
                Terug naar Dashboard
              </button>
            </div>
            {isSaving && (
              <div className="flex justify-center mt-4">
                <span className="text-sm text-blue-600 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  Wijziging opslaan...
                </span>
              </div>
            )}
          </div>

          {/* Info tekst - status afhankelijk */}
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
            <p className="text-blue-800 text-sm">
              <strong>{infoBannerText}</strong>
            </p>
          </div>

          {/* Tabel */}
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10">
                      Medewerker
                    </th>
                    {dateInfo.map((d, idx) => (
                      <th key={idx} className="border border-gray-300 px-2 py-2 text-center text-sm font-medium text-gray-700 min-w-[100px]">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">{d.dayName}</span>
                          <span className="font-semibold">{d.date}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(employee => {
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 sticky left-0 bg-white z-10">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-900">
                              {employee.voornaam} {employee.achternaam}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {employee.team}
                              </span>
                              <span className="text-xs text-gray-600">{employee.dienstverband}</span>
                            </div>
                          </div>
                        </td>
                        {dateInfo.map((d, idx) => {
                          const assignmentKey = `${employee.id}_${d.date}`;
                          const currentService = assignmentMap.get(assignmentKey) || '';
                          
                          return (
                            <td 
                              key={idx} 
                              className="border border-gray-300 px-2 py-2 text-center"
                            >
                              <select
                                value={currentService}
                                onChange={(e) => handleServiceChange(employee.id, d.date, e.target.value)}
                                disabled={isSaving}
                                className="w-full px-2 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                              >
                                <option value="">-</option>
                                {employee.serviceCodes.map(code => (
                                  <option key={code} value={code}>{code}</option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer status */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span className="font-medium">{employees.length}</span> medewerkers
                <span className="mx-2">·</span>
                <span className="font-medium">{dateInfo.length}</span> dagen
                <span className="mx-2">·</span>
                <span className="font-medium">{assignments.length}</span> diensten toegewezen
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
