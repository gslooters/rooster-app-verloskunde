'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRosters, isDutchHoliday, isAvailable } from './libAliases';
import AvailabilityPopup from './_components/AvailabilityPopup';
import '@/styles/planning.css';
import '@/styles/compact-service.css';
import '../toolbar.css';
// Sprint 2.2: Import roster design functionality
import { loadRosterDesignData, isEmployeeUnavailable } from '@/lib/planning/rosterDesign';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import { prepareRosterForExport, exportToExcel, exportToCSV, exportRosterToPDF, exportEmployeeToPDF } from '@/lib/export';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getServicesForEmployee } from '@/lib/services/medewerker-diensten-storage';
import { Dienst } from '@/lib/types/dienst';
import { parseUTCDate, toUTCDateString, addUTCDays, getUTCWeekNumber } from '@/lib/utils/date-utc';

function toDate(iso: string) { return parseUTCDate(iso); }
function addDaysISO(iso: string, n: number) {
  const d = parseUTCDate(iso);
  const result = addUTCDays(d, n);
  return toUTCDateString(result);
}
function formatPeriodDDMM(isoStart: string, daysCount=35){
  const d0 = parseUTCDate(isoStart);
  const de = parseUTCDate(addDaysISO(isoStart, daysCount-1));
  const f = (d: Date) => `${String(d.getUTCDate()).padStart(2,'0')}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${d.getUTCFullYear()}`;
  return `${f(d0)} t/m ${f(de)}`;
}
function formatDDMM(iso:string){ 
  const d = parseUTCDate(iso); 
  return `${String(d.getUTCDate()).padStart(2,'0')}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; 
}
function isoWeekNumber(iso:string){ 
  const d = parseUTCDate(iso); 
  const { week } = getUTCWeekNumber(d);
  return week;
}
function dayShort(iso:string){ 
  const map=['ZO','MA','DI','WO','DO','VR','ZA'] as const; 
  return map[parseUTCDate(iso).getUTCDay()]; 
}
function isWeekend(iso:string){ const s=dayShort(iso); return s==='ZA'||s==='ZO'; }
function getFirstName(fullName: string): string { return fullName.split(' ')[0]; }
type Roster = { id: string; start_date: string; end_date: string; status: 'draft'|'in_progress'|'final'; created_at: string; };
type Cell = { service: string | null; locked: boolean; unavailable?: boolean };

// DRAAD75.2: FALLBACK_EMPLOYEES nu volledig type-compliant met RosterEmployee
// Bevat alle verplichte velden: voornaam, achternaam, team, dienstverband
const FALLBACK_EMPLOYEES = [
  { id: 'emp1', name: 'Anna Bakker', voornaam: 'Anna', achternaam: 'Bakker', team: 'Vroedvrouw', dienstverband: 'Loondienst' },
  { id: 'emp2', name: 'Bram de Vries', voornaam: 'Bram', achternaam: 'de Vries', team: 'Vroedvrouw', dienstverband: 'Loondienst' },
  { id: 'emp3', name: 'Carla Janssen', voornaam: 'Carla', achternaam: 'Janssen', team: 'Kraamzorg', dienstverband: 'Freelance' },
  { id: 'emp4', name: 'Daan Peters', voornaam: 'Daan', achternaam: 'Peters', team: 'Vroedvrouw', dienstverband: 'Loondienst' },
  { id: 'emp5', name: 'Eva Smit', voornaam: 'Eva', achternaam: 'Smit', team: 'Kraamzorg', dienstverband: 'Loondienst' },
  { id: 'emp6', name: 'Frank de Jong', voornaam: 'Frank', achternaam: 'de Jong', team: 'Vroedvrouw', dienstverband: 'Freelance' },
  { id: 'emp7', name: 'Greta Mulder', voornaam: 'Greta', achternaam: 'Mulder', team: 'Kraamzorg', dienstverband: 'Loondienst' },
  { id: 'emp8', name: 'Hans Visser', voornaam: 'Hans', achternaam: 'Visser', team: 'Vroedvrouw', dienstverband: 'Freelance' },
];

// Service color mapping
const serviceColorMap: Record<string, string> = {
  'DG': 'bg-blue-200',   // Dag
  'NB': 'bg-purple-200', // Nacht
  'S': 'bg-orange-200',  // Standby
  'ZW': 'bg-gray-200',   // Zwanger
};

export default function PlanningGrid({ rosterId }: { rosterId: string }) {
  const router = useRouter();
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roster, setRoster] = useState<Roster | null>(null);
  const [designData, setDesignData] = useState<RosterDesignData | null>(null);
  const [employees, setEmployees] = useState<RosterEmployee[]>([]);
  const [allServices, setAllServices] = useState<Dienst[]>([]);
  const [employeeServiceMappings, setEmployeeServiceMappings] = useState<Record<string, Dienst[]>>({});
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');

  useEffect(() => {
    async function fetchRosters() {
      try {
        setLoading(true);
        setError('');
        const data = await getRosters();
        setRosters(data);
      } catch (err) {
        setError('Fout bij laden roosters.');
      } finally {
        setLoading(false);
      }
    }
    fetchRosters();
  }, []);

  useEffect(() => {
    const foundRoster = rosters.find(r => r.id === rosterId);
    setRoster(foundRoster || null);
  }, [rosters, rosterId]);

  useEffect(() => {
    async function fetchDesign() {
      try {
        setDesignData(null);
        const loadedDesignData = await loadRosterDesignData(rosterId);
        if (loadedDesignData) {
          setDesignData(loadedDesignData);
          setEmployees(loadedDesignData.employees);
        } else {
          setEmployees(FALLBACK_EMPLOYEES.map(emp => ({
            id: `re_${emp.id}`,
            name: emp.name,
            voornaam: emp.voornaam,
            achternaam: emp.achternaam,
            team: emp.team,
            dienstverband: emp.dienstverband,
            maxShifts: 0,
            availableServices: [],
            isSnapshotActive: true,
            originalEmployeeId: emp.id,
            snapshotDate: new Date().toISOString()
          })));
        }
      } catch (err) {
        setEmployees(FALLBACK_EMPLOYEES.map(emp => ({
          id: `re_${emp.id}`,
          name: emp.name,
          voornaam: emp.voornaam,
          achternaam: emp.achternaam,
          team: emp.team,
          dienstverband: emp.dienstverband,
          maxShifts: 0,
          availableServices: [],
          isSnapshotActive: true,
          originalEmployeeId: emp.id,
          snapshotDate: new Date().toISOString()
        })));
      }
    }
    fetchDesign();
  }, [rosterId]);

  useEffect(() => {
    async function fetchServicesAndMappings() {
      setServicesLoading(true);
      setServicesError('');
      let curEmployees = employees.length ? employees : FALLBACK_EMPLOYEES.map(emp => ({
        id: `re_${emp.id}`,
        name: emp.name,
        voornaam: emp.voornaam,
        achternaam: emp.achternaam,
        team: emp.team,
        dienstverband: emp.dienstverband,
        maxShifts: 0,
        availableServices: [],
        isSnapshotActive: true,
        originalEmployeeId: emp.id,
        snapshotDate: new Date().toISOString()
      }));
      try {
        const services = await getAllServices();
        setAllServices(services);
        const mappings: Record<string, Dienst[]> = {};
        for (const emp of curEmployees) {
          const serviceCodes = await getServicesForEmployee(emp.originalEmployeeId);
          mappings[emp.id] = serviceCodes
            .map(code => services.find(s => s.code === code))
            .filter(Boolean) as Dienst[];
        }
        setEmployeeServiceMappings(mappings);
      } catch (err) {
        setServicesError('Kan diensten niet laden. Controleer je internetverbinding of probeer later opnieuw.');
        setAllServices([]);
        setEmployeeServiceMappings({});
      } finally {
        setServicesLoading(false);
      }
    }
    fetchServicesAndMappings();
  }, [employees]);

  const handleBackToDashboard = () => {
    if (roster?.status === 'draft') {
      router.push(`/planning/design/dashboard?rosterId=${rosterId}`);
    } else if (roster?.status === 'in_progress' || roster?.status === 'final') {
      router.push('/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  // Generate date array for 35 days
  const generateDateArray = (): string[] => {
    if (!roster) return [];
    const dates: string[] = [];
    for (let i = 0; i < 35; i++) {
      dates.push(addDaysISO(roster.start_date, i));
    }
    return dates;
  };

  const dateArray = generateDateArray();
  const weekGroupedDates = Array.from({ length: 5 }).map((_, weekIdx) => 
    dateArray.slice(weekIdx * 7, (weekIdx + 1) * 7)
  );

  // Calculate statistics
  const totalServiceCount = employees.reduce((acc, emp) => acc + (employeeServiceMappings[emp.id]?.length || 0), 0);
  const totalDays = dateArray.length;
  const totalCells = employees.length * dateArray.length;

  if (loading || servicesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Rooster laden...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600 font-semibold">⚠️ {error}</p>
      </div>
    );
  }
  if (!roster) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600 font-semibold">⚠️ Rooster niet gevonden.</p>
      </div>
    );
  }

  return (
    <div className="planning-grid-container bg-white">
      {/* Header met Terug-knop */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planrooster</h1>
          <p className="text-sm text-gray-500 mt-1">{formatPeriodDDMM(roster.start_date, 35)}</p>
        </div>
        <button
          onClick={handleBackToDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          title="Terug naar dashboard"
        >
          ← Terug naar Dashboard
        </button>
      </div>

      {/* Statistics Bar */}
      <div className="flex gap-4 p-4 bg-gray-50 border-b border-gray-200 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Medewerkers:</span>
          <span className="text-lg font-bold text-blue-600">{employees.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Dagen:</span>
          <span className="text-lg font-bold text-green-600">{totalDays}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Totale diensten:</span>
          <span className="text-lg font-bold text-orange-600">{totalServiceCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Status:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            roster.status === 'draft' ? 'bg-yellow-200 text-yellow-900' :
            roster.status === 'in_progress' ? 'bg-blue-200 text-blue-900' :
            'bg-green-200 text-green-900'
          }`}>
            {roster.status === 'draft' ? 'Ontwerp' : roster.status === 'in_progress' ? 'In bewerking' : 'Afgesloten'}
          </span>
        </div>
      </div>

      {/* Rooster Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300 sticky top-[120px] z-9">
              <th className="p-2 text-left font-semibold text-gray-900 bg-gray-100 sticky left-0 z-10 min-w-[150px]">Medewerker</th>
              {weekGroupedDates.map((weekDates, weekIdx) => (
                <React.Fragment key={`week-${weekIdx}`}>
                  {weekDates.map((dateStr, dayIdx) => {
                    const d = toDate(dateStr);
                    const dayName = dayShort(dateStr);
                    const dateNum = d.getUTCDate();
                    const isWeek = isWeekend(dateStr);
                    return (
                      <th
                        key={`header-${weekIdx}-${dayIdx}`}
                        className={`p-2 text-center font-semibold min-w-[60px] ${
                          isWeek ? 'bg-red-100 text-red-900' : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="font-bold">{dayName}</div>
                        <div className="text-xs">{dateNum}</div>
                      </th>
                    );
                  })}
                  {weekIdx < 4 && <th className="w-1 bg-gray-300"></th>}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, empIdx) => (
              <tr key={`emp-${emp.id}`} className={empIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-2 font-semibold text-gray-900 bg-gray-50 sticky left-0 z-5 border-r border-gray-200">
                  <div>{getFirstName(emp.name)}</div>
                  <div className="text-xs text-gray-500">{emp.team}</div>
                </td>
                {weekGroupedDates.map((weekDates, weekIdx) => (
                  <React.Fragment key={`cells-${empIdx}-${weekIdx}`}>
                    {weekDates.map((dateStr, dayIdx) => {
                      const isWeek = isWeekend(dateStr);
                      const serviceForDay = Math.random() > 0.5 ? ['DG', 'NB', 'S'][Math.floor(Math.random() * 3)] : null;
                      const bgColor = isWeek ? 'bg-red-50' : 'bg-white';
                      return (
                        <td
                          key={`cell-${empIdx}-${weekIdx}-${dayIdx}`}
                          className={`p-1 border border-gray-200 text-center cursor-pointer hover:bg-blue-100 transition-colors min-w-[60px] ${bgColor}`}
                        >
                          {serviceForDay && (
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold text-gray-900 ${
                                serviceColorMap[serviceForDay] || 'bg-gray-200'
                              }`}
                            >
                              {serviceForDay}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {weekIdx < 4 && <td className="w-1 bg-gray-300"></td>}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Totaal: <span className="font-semibold">{totalCells}</span> cellen | 
          Medewerkers: <span className="font-semibold">{employees.length}</span> | 
          Perioden: <span className="font-semibold">5 weken</span>
        </p>
      </div>
    </div>
  );
}
