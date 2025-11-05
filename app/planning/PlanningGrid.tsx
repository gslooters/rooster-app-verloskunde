'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getRosters, isDutchHoliday, isAvailable } from './libAliases';
import AvailabilityPopup from './_components/AvailabilityPopup';
import StaffingManager from './_components/StaffingManager';
import '@/styles/planning.css';
import '@/styles/compact-service.css';
import '../toolbar.css';

// Sprint 2.2: Import roster design functionality
import { loadRosterDesignData, isEmployeeUnavailable } from '@/lib/planning/rosterDesign';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';

// NEW: Import roster staffing functionality
import { isRosterStaffingLocked } from '@/lib/services/roster-staffing-storage';

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

// Extract first name only
function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

type Roster = { id: string; start_date: string; end_date: string; status: 'draft'|'final'; created_at: string; };
type Cell = { service: string | null; locked: boolean; unavailable?: boolean };

// Sprint 2.2: Fallback employees voor backwards compatibility
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
  const rosters = getRosters() as Roster[];
  const roster = rosters.find(r => r.id === rosterId);
  if (!roster) return <div className="p-6 text-red-600">Rooster niet gevonden.</div>;

  // Sprint 2.2: Load roster design data
  const [designData, setDesignData] = useState<RosterDesignData | null>(null);
  const [employees, setEmployees] = useState<RosterEmployee[]>([]);
  const [allServices, setAllServices] = useState<Dienst[]>([]);
  const [employeeServiceMappings, setEmployeeServiceMappings] = useState<Record<string, Dienst[]>>({});
  
  // NEW: Staffing management state
  const [showStaffingManager, setShowStaffingManager] = useState(false);
  const [staffingLocked, setStaffingLocked] = useState(false);
  
  useEffect(() => {
    // Sprint 2.2: Try to load roster design data first
    const loadedDesignData = loadRosterDesignData(rosterId);
    if (loadedDesignData) {
      setDesignData(loadedDesignData);
      setEmployees(loadedDesignData.employees);
    } else {
      // Fallback to static employees for backwards compatibility
      console.warn('No roster design data found, using fallback employees');
      const fallbackRosterEmployees = FALLBACK_EMPLOYEES.map(emp => ({
        id: `re_${emp.id}`,
        name: emp.name,
        maxShifts: 0,
        availableServices: [],
        isSnapshotActive: true,
        originalEmployeeId: emp.id,
        snapshotDate: new Date().toISOString()
      }));
      setEmployees(fallbackRosterEmployees);
    }
    
    try {
      const services = getAllServices();
      setAllServices(services);
      
      // Load employee-specific services - map from original employee IDs
      const mappings: Record<string, Dienst[]> = {};
      employees.forEach(emp => {
        const serviceCodes = getServicesForEmployee(emp.originalEmployeeId);
        mappings[emp.id] = serviceCodes
          .map(code => services.find(s => s.code === code))
          .filter(Boolean) as Dienst[];
      });
      setEmployeeServiceMappings(mappings);
    } catch (err) {
      console.error('Error loading services:', err);
      setAllServices([]);
      setEmployeeServiceMappings({});
    }

    // NEW: Check staffing lock status
    try {
      const locked = isRosterStaffingLocked(rosterId);
      setStaffingLocked(locked);
    } catch (err) {
      console.error('Error checking staffing lock status:', err);
    }
  }, [rosterId]);

  // Update service mappings when employees change
  useEffect(() => {
    if (employees.length > 0 && allServices.length > 0) {
      const mappings: Record<string, Dienst[]> = {};
      employees.forEach(emp => {
        const serviceCodes = getServicesForEmployee(emp.originalEmployeeId);
        mappings[emp.id] = serviceCodes
          .map(code => allServices.find(s => s.code === code))
          .filter(Boolean) as Dienst[];
      });
      setEmployeeServiceMappings(mappings);
    }
  }, [employees, allServices]);

  const start = roster.start_date;
  const isDraft = roster.status === 'draft';
  // Sprint 2.2: Check if we're in design phase
  const isDesignPhase = designData?.status.phase === 'ontwerp';
  const isEditingPhase = designData?.status.phase === 'bewerking';
  
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
    if (employees.length > 0) {
      const init: Record<string, Record<string, Cell>> = {};
      days.forEach(d => { 
        init[d] = {}; 
        employees.forEach(e => { 
          init[d][e.id] = { service: null, locked: false }; 
        }); 
      });
      setCells(init);
    }
  }, [days, employees]);

  function setService(date: string, empId: string, service: string) {
    // Sprint 2.2: Block service setting in design phase
    if (isDesignPhase) {
      alert('Diensten kunnen niet worden ingesteld in de ontwerpfase. Ga eerst naar de bewerkingsfase.');
      return;
    }
    setCells(prev => ({ ...prev, [date]: { ...prev[date], [empId]: { ...prev[date][empId], service } } }));
  }
  
  function toggleLock(date: string, empId: string) {
    // Sprint 2.2: Block locking in design phase
    if (isDesignPhase) return;
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

  const exportable = useMemo(() => prepareRosterForExport(
    roster,
    employees.map(emp => ({ id: emp.originalEmployeeId, name: getFirstName(emp.name) })), // Use first name only for export
    days,
    cells as any
  ), [roster, employees, days, cells]);

  function onExportExcel() { exportToExcel(exportable); }
  function onExportCSV() { exportToCSV(exportable); }
  function onExportPDF() { exportRosterToPDF(exportable); }

  const [selectedEmp, setSelectedEmp] = useState<string>('');
  useEffect(() => {
    if (employees.length > 0 && !selectedEmp) {
      setSelectedEmp(employees[0].originalEmployeeId);
    }
  }, [employees, selectedEmp]);
  
  function onExportEmployeePDF() {
    const emp = employees.find(e => e.originalEmployeeId === selectedEmp);
    if (emp) exportEmployeeToPDF(exportable, { id: emp.originalEmployeeId, name: getFirstName(emp.name) });
  }

  // NEW: Handle staffing manager actions
  function handleStaffingManagerOpen() {
    setShowStaffingManager(true);
  }

  function handleStaffingManagerClose() {
    setShowStaffingManager(false);
  }

  function handleStaffingLocked() {
    setStaffingLocked(true);
    setShowStaffingManager(false);
  }

  return (
    <main className="p-4">
      <nav className="text-sm text-gray-500 mb-3">Dashboard &gt; Rooster Planning &gt; Rooster</nav>
      <h1 className="text-xl font-semibold mb-1">Periode: {formatPeriodDDMM(start)}</h1>
      
      {/* Sprint 2.2: Phase indicator */}
      {designData && (
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3 ${
          isDesignPhase ? 'bg-blue-100 text-blue-800' : 
          isEditingPhase ? 'bg-green-100 text-green-800' : 
          'bg-gray-100 text-gray-800'
        }`}>
          {isDesignPhase ? '🎨 Ontwerpfase' : isEditingPhase ? '✏️ Bewerkingsfase' : '🔒 Afgesloten'}
          {isDesignPhase && (
            <span className="ml-2 text-xs">→ 
              <a href={`/planning/design?rosterId=${rosterId}`} className="underline hover:no-underline">
                Ga naar ontwerp interface
              </a>
            </span>
          )}
        </div>
      )}

      <div className="toolbar mb-4">
        <button className="btn" onClick={() => window.location.href = '/planning'}>← Dashboard</button>
        <span style={{ marginLeft: 12 }} />
        
        {/* NEW: Staffing Management Button */}
        <button 
          className={`btn ${staffingLocked ? 'locked' : 'primary'}`}
          onClick={staffingLocked ? undefined : handleStaffingManagerOpen}
          disabled={staffingLocked}
          style={{
            backgroundColor: staffingLocked ? '#10B981' : undefined,
            color: staffingLocked ? 'white' : undefined,
            cursor: staffingLocked ? 'default' : 'pointer',
            opacity: staffingLocked ? 0.8 : 1
          }}
          title={staffingLocked ? 'Bezetting is vastgesteld en kan niet meer worden gewijzigd' : 'Klik om bezetting te beheren'}
        >
          {staffingLocked ? '✅ Bezetting vastgesteld' : '⚙️ Bezetting beheren'}
        </button>
        
        <span style={{ marginLeft: 12 }} />
        <button className="btn" onClick={onExportCSV}>Export CSV</button>
        <button className="btn" onClick={onExportExcel}>Export Excel</button>
        <button className="btn primary" onClick={onExportPDF}>Export PDF (Totaal)</button>
        <span style={{ marginLeft: 12 }} />
        {employees.length > 0 && (
          <>
            <select className="select" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
              {employees.map(e => <option key={e.originalEmployeeId} value={e.originalEmployeeId}>{getFirstName(e.name)}</option>)}
            </select>
            <button className="btn" onClick={onExportEmployeePDF}>Export PDF (Medewerker)</button>
          </>
        )}
      </div>

      <div className="overflow-auto max-h-[75vh] border rounded">
        <table className="min-w-[1200px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-gray-50 border px-2 py-1 align-top w-[100px]" rowSpan={2}>Medewerker</th>
              {/* Sprint 2.2: Diensten kolom header */}
              {designData && (
                <th className="sticky left-[100px] top-0 z-30 bg-gray-50 border px-2 py-1 align-top w-[50px]" rowSpan={2}>
                  Max<br/>Diensten
                </th>
              )}
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
                <tr key={emp.id} className="h-7"> {/* Compacte rij hoogte */}
                  <td className="sticky left-0 z-10 bg-white border px-2 py-1 font-medium w-[100px] h-7">
                    <div className="flex items-center justify-between">
                      <button
                        className={`text-left text-sm ${isDraft && !isDesignPhase ? 'underline decoration-dotted' : ''}`}
                        onClick={() => isDraft && !isDesignPhase && setPopupFor({ id: emp.id, name: getFirstName(emp.name) })}
                        title={isDraft && !isDesignPhase ? 'Klik om beschikbaarheid te bewerken' : 'Alleen-lezen'}
                      >
                        {getFirstName(emp.name)}
                      </button>
                      <div className="flex gap-0.5">
                        {availableServices.slice(0, 2).map(s => (
                          <div 
                            key={s.code}
                            className="w-2.5 h-2.5 rounded-sm text-[6px] font-bold text-white flex items-center justify-center"
                            style={{ backgroundColor: s.kleur }}
                            title={`Kan: ${s.naam}`}
                          >
                            {s.code.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {availableServices.length > 2 && (
                          <div className="w-2.5 h-2.5 rounded-sm text-[6px] bg-gray-400 text-white flex items-center justify-center" title={`+${availableServices.length - 2} meer`}>
                            +
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* Sprint 2.2: Max diensten kolom */}
                  {designData && (
                    <td className="sticky left-[100px] z-10 bg-white border px-2 py-1 text-center w-[50px] h-7">
                      <div className="text-sm font-medium">{emp.maxShifts}</div>
                    </td>
                  )}
                  
                  {days.map(d => {
                    // Sprint 2.2: Check beide old availability system en nieuwe NB system
                    const oldAvailable = isAvailable(roster.id, emp.originalEmployeeId, d);
                    const isUnavailable = designData ? isEmployeeUnavailable(rosterId, emp.id, d) : false;
                    const available = oldAvailable && !isUnavailable;

                    const cell = cells[d]?.[emp.id];
                    const code = cell?.service ?? '';
                    const serviceInfo = getServiceInfo(code);
                    const locked = !!cell?.locked;

                    return (
                      <td key={d} className={`border p-[1px] h-7 ${available ? '' : 'unavailable'}`} title={available ? '' : 'Niet beschikbaar'}>
                        {isUnavailable ? (
                          // Sprint 2.2: Show NB for unavailable days - GEEN ARCERING, alleen tekst
                          <div className="not-available h-[22px] flex items-center justify-center text-xs font-bold">
                            NB
                          </div>
                        ) : (
                          <div className="flex items-center gap-[2px]">
                            <select
                              value={code}
                              onChange={(e) => setService(d, emp.id, e.target.value)}
                              className="text-[11px] border rounded px-1 h-[22px] min-w-[30px] select compact-service"
                              style={{ backgroundColor: serviceInfo.color, color: serviceInfo.color === '#FFFFFF' || serviceInfo.color === '#FEF3C7' ? '#000000' : '#FFFFFF' } as React.CSSProperties}
                              disabled={!available || !isDraft || locked || isDesignPhase}
                              title={isDesignPhase ? 'Diensten kunnen niet worden ingesteld in ontwerpfase' : code ? serviceInfo.displayName : 'Geen dienst'}
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
                              className={`text-[8px] leading-none w-[18px] h-[18px] rounded border flex items-center justify-center ${
                                locked ? 'bg-gray-800 text-white' : 'bg-white'
                              } ${isDesignPhase ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={!isDraft || !available || isDesignPhase}
                            >
                              🔒
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Existing popup */}
      {popupFor && isDraft && !isDesignPhase && (
        <AvailabilityPopup
          rosterId={roster.id}
          employee={popupFor}
          startDate={start}
          onClose={() => setPopupFor(null)}
          onSaved={() => {}}
        />
      )}

      {/* NEW: Staffing Manager Modal */}
      {showStaffingManager && (
        <StaffingManager
          rosterId={rosterId}
          rosterPeriod={formatPeriodDDMM(start)}
          startDate={start}
          onClose={handleStaffingManagerClose}
          onLocked={handleStaffingLocked}
        />
      )}
    </main>
  );
}