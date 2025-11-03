'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getRosters, isDutchHoliday, isAvailable } from './libAliases';
import AvailabilityPopup from './_components/AvailabilityPopup';
import '@/styles/planning.css';
import '@/styles/compact-service.css';
import '../toolbar.css';

import { prepareRosterForExport, exportToExcel, exportToCSV, exportRosterToPDF, exportEmployeeToPDF } from '@/lib/export';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getServicesForEmployee } from '@/lib/services/medewerker-diensten-storage';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { Dienst } from '@/lib/types/dienst';
import { Employee, getRosterDisplayName } from '@/lib/types/employee';

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
function formatDDMM(iso:string){ const d=toDate(iso); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function isoWeekNumber(iso:string){ const d=toDate(iso); const target=new Date(d.valueOf()); const dayNr=(d.getDay()+6)%7; target.setDate(target.getDate()-dayNr+3);
  const firstThursday=new Date(target.getFullYear(),0,4); const ftDay=(firstThursday.getDay()+6)%7; firstThursday.setDate(firstThursday.getDate()-ftDay+3);
  return 1+Math.round((target.getTime()-firstThursday.getTime())/(7*24*3600*1000));}
function dayShort(iso:string){ const map=['ZO','MA','DI','WO','DO','VR','ZA'] as const; return map[toDate(iso).getDay()]; }
function isWeekend(iso:string){ const s=dayShort(iso); return s==='ZA'||s==='ZO'; }

type Roster = { id: string; start_date: string; end_date: string; status: 'draft'|'final'; created_at: string; };
type Cell = { service: string | null; locked: boolean; unavailable?: boolean };

export default function PlanningGrid({ rosterId }: { rosterId: string }) {
  const rosters = getRosters() as Roster[];
  const roster = rosters.find(r => r.id === rosterId);
  if (!roster) return <div className="p-6 text-red-600">Rooster niet gevonden.</div>;

  const [allServices, setAllServices] = useState<Dienst[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeServiceMappings, setEmployeeServiceMappings] = useState<Record<string, Dienst[]>>({});
  
  useEffect(() => {
    try {
      const services = getAllServices();
      const employeeList = getAllEmployees().filter(emp => emp.actief);
      setAllServices(services);
      setEmployees(employeeList);
      
      // Load employee-specific services
      const mappings: Record<string, Dienst[]> = {};
      employeeList.forEach(emp => {
        const serviceCodes = getServicesForEmployee(emp.id);
        mappings[emp.id] = serviceCodes
          .map(code => services.find(s => s.code === code))
          .filter(Boolean) as Dienst[];
      });
      setEmployeeServiceMappings(mappings);
    } catch (err) {
      console.error('Error loading services:', err);
      setAllServices([]);
      setEmployees([]);
      setEmployeeServiceMappings({});
    }
  }, []);

  const start = roster.start_date;
  const isDraft = roster.status === 'draft';
  const days = useMemo<string[]>(() => Array.from({ length: 35 }, (_, i) => addDaysISO(start, i)), [start]);

  const weekGroups = useMemo(() => {
    const groups: { week: number; startIndex: number; span: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const w = isoWeekNumber(days[i]);
      let j = i + 1; while (j < days.length && isoWeekNumber(days[j]) === w) j++;
      groups.push({ week: w, startIndex: i, span: j - i }); i = j;
    }
    return groups;
  }, [days]);

  const [cells, setCells] = useState<Record<string, Record<string, Cell>>>({});
  const [popupFor, setPopupFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const init: Record<string, Record<string, Cell>> = {};
    days.forEach(d => { 
      init[d] = {}; 
      employees.forEach(e => { 
        init[d][e.id] = { service: null, locked: false }; 
      }); 
    });
    setCells(init);
  }, [days, employees]);

  function setService(date: string, empId: string, service: string) {
    setCells(prev => ({ ...prev, [date]: { ...prev[date], [empId]: { ...prev[date][empId], service } } }));
  }
  function toggleLock(date: string, empId: string) {
    setCells(prev => ({ ...prev, [date]: { ...prev[date], [empId]: { ...prev[date][empId], locked: !prev[date][empId].locked } } }));
  }

  function getServiceInfo(serviceCode: string) {
    if (!serviceCode) return { color: '#FFFFFF', displayName: '—' };
    const service = allServices.find(s => s.code === serviceCode);
    if (service) return { color: service.kleur, displayName: `${service.code} - ${service.naam}` };
    return { color: '#E5E7EB', displayName: serviceCode };
  }

  // Get services available to specific employee
  function getEmployeeServices(employeeId: string): Dienst[] {
    return employeeServiceMappings[employeeId] || [];
  }

  const exportable = useMemo(() => {
    // Convert employees to export format
    const exportEmployees = employees.map(emp => ({
      id: emp.id,
      name: getRosterDisplayName(emp) // Gebruik voornaam voor roosters
    }));
    
    return prepareRosterForExport(
      roster,
      exportEmployees,
      days,
      cells as any
    );
  }, [roster, employees, days, cells]);

  function onExportExcel() { exportToExcel(exportable); }
  function onExportCSV() { exportToCSV(exportable); }
  function onExportPDF() { exportRosterToPDF(exportable); }

  const [selectedEmp, setSelectedEmp] = useState<string>(employees[0]?.id || '');
  function onExportEmployeePDF() {
    const emp = employees.find(e => e.id === selectedEmp);
    if (emp) {
      const exportEmp = { id: emp.id, name: getRosterDisplayName(emp) };
      exportEmployeeToPDF(exportable, exportEmp);
    }
  }

  // Update selected employee if current selection becomes invalid
  useEffect(() => {
    if (employees.length > 0 && !employees.find(e => e.id === selectedEmp)) {
      setSelectedEmp(employees[0].id);
    }
  }, [employees, selectedEmp]);

  return (
    <main className="p-4">
      <nav className="text-sm text-gray-500 mb-3">Dashboard &gt; Rooster Planning &gt; Rooster</nav>
      <h1 className="text-xl font-semibold mb-1">Periode: {formatPeriodDDMM(start)}</h1>

      <div className="toolbar">
        <button className="btn" onClick={onExportCSV}>Export CSV</button>
        <button className="btn" onClick={onExportExcel}>Export Excel</button>
        <button className="btn primary" onClick={onExportPDF}>Export PDF (Totaal)</button>
        <span style={{ marginLeft: 12 }} />
        <select className="select" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
          {employees.map(e => <option key={e.id} value={e.id}>{getRosterDisplayName(e)}</option>)}
        </select>
        <button className="btn" onClick={onExportEmployeePDF}>Export PDF (Medewerker)</button>
      </div>

      <div className="overflow-auto max-h-[80vh] border rounded">
        <table className="min-w-[1200px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-gray-50 border px-2 py-1 align-top w-[120px]" rowSpan={2}>Medewerker</th>
              {weekGroups.map(g => (
                <th key={`w-${g.week}-${g.startIndex}`} className="sticky top-0 z-20 bg-gray-100 border px-2 py-1 text-[11px] text-gray-800" colSpan={g.span}>
                  Week {g.week}
                </th>
              ))}
            </tr>
            <tr>
              {days.map(d => {
                const short = dayShort(d);
                const weekend = isWeekend(d);
                const holiday = isDutchHoliday(d);
                const colorClass = holiday ? 'text-red-700 font-semibold' : weekend ? 'text-red-600' : 'text-gray-800';
                return (
                  <th key={`d-${d}`} className="sticky top-8 z-20 bg-gray-50 border px-2 py-1 text-[12px]">
                    <div className={`flex flex-col items-start ${colorClass}`}>
                      <span className="uppercase leading-4">{short}</span>
                      <span className="leading-4">{formatDDMM(d)}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {employees.map(emp => {
              const availableServices = getEmployeeServices(emp.id);
              
              return (
                <tr key={emp.id} className="tr-row-30">
                  <td className="sticky left-0 z-10 bg-white border px-2 py-1 font-medium w-[120px]">
                    <div className="flex items-center justify-between">
                      <button
                        className={`text-left ${isDraft ? 'underline decoration-dotted' : ''}`}
                        onClick={() => isDraft && setPopupFor({ id: emp.id, name: getRosterDisplayName(emp) })}
                        title={isDraft ? 'Klik om beschikbaarheid te bewerken' : 'Alleen-lezen'}
                      >
                        {getRosterDisplayName(emp)}
                      </button>
                      <div className="flex gap-0.5">
                        {availableServices.slice(0, 3).map(s => (
                          <div 
                            key={s.code}
                            className="w-3 h-3 rounded-sm text-[8px] font-bold text-white flex items-center justify-center"
                            style={{ backgroundColor: s.kleur }}
                            title={`Kan: ${s.naam}`}
                          >
                            {s.code.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {availableServices.length > 3 && (
                          <div className="w-3 h-3 rounded-sm text-[7px] bg-gray-400 text-white flex items-center justify-center" title={`+${availableServices.length - 3} meer`}>
                            +
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {days.map(d => {
                    const available = isAvailable(roster.id, emp.id, d);
                    const cell = cells[d]?.[emp.id];
                    const code = cell?.service ?? '';
                    const serviceInfo = getServiceInfo(code);
                    const locked = !!cell?.locked;

                    return (
                      <td key={d} className={`border p-[2px] ${available ? '' : 'unavailable'}`} title={available ? '' : 'Niet beschikbaar'}>
                        <div className="flex items-center gap-[4px]">
                          <select
                            value={code}
                            onChange={(e) => setService(d, emp.id, e.target.value)}
                            className="text-[12px] border rounded px-1 h-[24px] min-w-[34px] select compact-service"
                            style={{ backgroundColor: serviceInfo.color, color: serviceInfo.color === '#FFFFFF' || serviceInfo.color === '#FEF3C7' ? '#000000' : '#FFFFFF' } as React.CSSProperties}
                            disabled={!available || !isDraft || locked}
                            title={code ? serviceInfo.displayName : 'Geen dienst'}
                          >
                            <option value="" style={{ backgroundColor: '#FFFFFF', color: '#000000' }}>—</option>
                            {availableServices.map(s => (
                              <option 
                                key={s.code} 
                                value={s.code}
                                style={{ backgroundColor: s.kleur, color: s.kleur === '#FFFFFF' || s.kleur === '#FEF3C7' ? '#000000' : '#FFFFFF' }}
                              >
                                {s.code} - {s.naam}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            title={locked ? 'Ontgrendel' : 'Vergrendel'}
                            onClick={() => isDraft && available && toggleLock(d, emp.id)}
                            className={`text-[10px] leading-none w-[22px] h-[22px] rounded border flex items-center justify-center ${locked ? 'bg-gray-800 text-white' : 'bg-white'}`}
                            disabled={!isDraft || !available}
                          >
                            🔒
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {popupFor && isDraft && (
        <AvailabilityPopup
          rosterId={roster.id}
          employee={popupFor}
          startDate={start}
          onClose={() => setPopupFor(null)}
          onSaved={() => {}}
        />
      )}
    </main>
  );
}