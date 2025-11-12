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

function toDate(iso: string) { return new Date(iso + 'T00:00:00'); }
function addDaysISO(iso: string, n: number) {
  const d = toDate(iso); d.setDate(d.getDate() + n);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function formatPeriodDDMM(isoStart: string, daysCount=35){
  const d0 = toDate(isoStart), de = toDate(addDaysISO(isoStart, daysCount-1));
  const f = (d: Date) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  return `${f(d0)} t/m ${f(de)}`;
}
function formatDDMM(iso:string){ const d=toDate(iso); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function isoWeekNumber(iso:string){ const d=toDate(iso); const target=new Date(d.valueOf()); const dayNr=(d.getDay()+6)%7; target.setDate(target.getDate()-dayNr+3);
  const firstThursday=new Date(target.getFullYear(),0,4); const ftDay=(firstThursday.getDay()+6)%7; firstThursday.setDate(firstThursday.getDate()-ftDay+3);
  return 1+Math.round((target.getTime()-firstThursday.getTime())/(7*24*3600*1000)); }
function dayShort(iso:string){ const map=['ZO','MA','DI','WO','DO','VR','ZA'] as const; return map[toDate(iso).getDay()]; }
function isWeekend(iso:string){ const s=dayShort(iso); return s==='ZA'||s==='ZO'; }
function getFirstName(fullName: string): string { return fullName.split(' ')[0]; }
type Roster = { id: string; start_date: string; end_date: string; status: 'draft'|'in_progress'|'final'; created_at: string; };
type Cell = { service: string | null; locked: boolean; unavailable?: boolean };
const FALLBACK_EMPLOYEES = [
  { id: 'emp1', name: 'Anna' },
  { id: 'emp2', name: 'Bram' },
  { id: 'emp3', name: 'Carla' },
  { id: 'emp4', name: 'Daan' },
  { id: 'emp5', name: 'Eva' },
  { id: 'emp6', name: 'Frank' },
  { id: 'emp7', name: 'Greta' },
  { id: 'emp8', name: 'Hans' },
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
