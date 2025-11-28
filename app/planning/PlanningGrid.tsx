'use client';

import React, { useEffect, useState } from 'react';
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

export default function PlanningGrid({ rosterId }: { rosterId: string }) {
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
    <div className="planning-grid-container">
      <p className="p-4 text-green-700">PlanningGrid async laadstructuur succesvol. (UI volgt in vervolgstap)</p>
    </div>
  );
}
