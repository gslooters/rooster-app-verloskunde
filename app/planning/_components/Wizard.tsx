'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { 
  computeDefaultStart, computeEnd, readRosters, writeRosters, type Roster,
  generateFiveWeekPeriods, getPeriodStatus, formatWeekRange, formatDateRangeNl
} from '@/lib/planning/storage';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { Employee, TeamType, DienstverbandType, getFullName } from '@/lib/types/employee';
import { initializeRosterDesign } from '@/lib/planning/rosterDesign';
import { useRouter } from 'next/navigation';

function genId() { return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

const FIXED_WEEKS = 5;

type WizardStep = 'period' | 'employees' | 'confirm';

interface WizardProps { onClose?: () => void; }

export default function Wizard({ onClose }: WizardProps = {}) {
  const router = useRouter();

  // Stap 1: Periode keuze
  const [periods, setPeriods] = useState<{ start: string; end: string; status: string }[]>([]);
  const [selectedStart, setSelectedStart] = useState<string>('');
  const [selectedEnd, setSelectedEnd] = useState<string>('');

  // Stap 2: Medewerkers controle
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [step, setStep] = useState<WizardStep>('period');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  useEffect(() => {
    const base = generateFiveWeekPeriods(30);
    const list = base.map(p => ({ ...p, status: getPeriodStatus(p.start, p.end) }));

    const inProg = list.filter(p => p.status === 'in_progress').sort((a,b)=>a.start.localeCompare(b.start));
    const drafts = list.filter(p => p.status === 'draft').sort((a,b)=>a.start.localeCompare(b.start));
    const free = list.filter(p => p.status === 'free');

    const ordered = [...inProg, ...drafts, ...free];
    setPeriods(ordered);

    const firstFree = free[0];
    if (firstFree) { setSelectedStart(firstFree.start); setSelectedEnd(firstFree.end); }

    setEmployees(getAllEmployees());
  }, []);

  function gotoEmployeesStep() {
    if (!selectedStart || !selectedEnd) { setError('Geen beschikbare periode gevonden.'); return; }
    setError(null); setStep('employees');
  }

  function gotoConfirmStep() { setStep('confirm'); }
  function backToDashboard() { if (onClose) onClose(); router.push('/dashboard'); }

  async function createRosterConfirmed() {
    setIsCreating(true); setError(null);
    try {
      const id = genId();
      const roster: Roster = { id, start_date: selectedStart, end_date: selectedEnd, status: 'draft', created_at: new Date().toISOString() } as Roster;
      const list = readRosters().filter(x => x.id !== roster.id); list.push(roster); writeRosters(list);

      if (typeof window !== 'undefined') {
        localStorage.setItem('lastRosterId', id);
        // Update to point to dashboard instead of direct grid
        localStorage.setItem('recentDesignRoute', `/planning/design/dashboard?rosterId=${id}`);
      }

      // Fix: geef start_date expliciet mee aan initializeRosterDesign
      initializeRosterDesign(roster.id, selectedStart);
      
      // Navigate to the new Dashboard Rooster Ontwerp instead of directly to the grid
      if (onClose) { onClose(); setTimeout(()=>router.push(`/planning/design/dashboard?rosterId=${id}`), 100); }
      else { router.push(`/planning/design/dashboard?rosterId=${id}`); }
    } catch (err) {
      console.error('Error creating rooster:', err); setError('Er is een fout opgetreden bij het aanmaken van het rooster. Probeer opnieuw.'); setIsCreating(false);
    }
  }

  function statusBadge(period: {status: string}) {
    if (period.status === 'in_progress') return (<span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">In bewerking</span>);
    if (period.status === 'draft') return (<span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">In ontwerp</span>);
    return null;
  }

  function isDisabled(period: {status: string}) { return period.status === 'in_progress' || period.status === 'draft'; }

  function renderPeriodCard(p: {start:string; end:string; status:string}) {
    const isSelected = selectedStart === p.start;
    const selectable = p.status === 'free' && periods.findIndex(x=>x.status==='free') === periods.indexOf(p);
    const baseCls = 'border rounded-lg p-3 flex items-center justify-between';
    const disabledCls = isDisabled(p) ? 'bg-gray-50 opacity-70 cursor-not-allowed' : '';
    const selectedCls = isSelected ? 'ring-2 ring-red-300 bg-red-50' : '';
    const selectableCls = selectable ? 'hover:bg-red-50 cursor-pointer' : (isDisabled(p) ? '' : 'opacity-60 cursor-not-allowed');

    const handle = () => { if (selectable) { setSelectedStart(p.start); setSelectedEnd(p.end);} };

    return (
      <div key={`${p.start}-${p.end}`} onClick={handle} className={`${baseCls} ${disabledCls} ${selectedCls} ${selectableCls}`}>
        <div>
          <div className="font-semibold">{formatWeekRange(p.start,p.end)}</div>
          <div className="text-sm text-gray-600">{formatDateRangeNl(p.start,p.end)}</div>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(p)}
          {p.status === 'free' && periods.findIndex(x=>x.status==='free') === periods.indexOf(p) && (
            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">Te kiezen</span>
          )}
        </div>
      </div>
    );
  }

  function sortedEmployees() {
    const orderTeam = [TeamType.GROEN, TeamType.ORANJE, TeamType.OVERIG];
    const orderDienst = [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP];
    return [...employees].sort((a,b)=>{
      const t = orderTeam.indexOf(a.team) - orderTeam.indexOf(b.team);
      if (t !== 0) return t;
      const d = orderDienst.indexOf(a.dienstverband) - orderDienst.indexOf(b.dienstverband);
      if (d !== 0) return d;
      return a.voornaam.localeCompare(b.voornaam, 'nl');
    });
  }

  return (
    <section className={onClose ? '' : 'p-4 border rounded bg-white'}>
      {!onClose && <h2 className="text-lg font-semibold mb-3">Nieuw rooster</h2>}
      {error && <p className="text-red-600 mb-2">{error}</p>}

      {step === 'period' && (
        <div className="flex flex-col gap-4">
          <div className="text-sm text-gray-600">Kies de eerstvolgende beschikbare periode. Perioden in ontwerp/bewerking zijn niet kiesbaar.</div>
          {periods.some(p=>p.status==='in_progress') && (
            <div>
              <div className="text-xs uppercase text-gray-500 mb-1">In bewerking</div>
              <div className="flex flex-col gap-2 max-h-48 overflow-auto">
                {periods.filter(p=>p.status==='in_progress').map(renderPeriodCard)}
              </div>
            </div>
          )}
          {periods.some(p=>p.status==='draft') && (
            <div>
              <div className="text-xs uppercase text-gray-500 mb-1">In ontwerp</div>
              <div className="flex flex-col gap-2 max-h-48 overflow-auto">
                {periods.filter(p=>p.status==='draft').map(renderPeriodCard)}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs uppercase text-gray-500 mb-1">Beschikbaar</div>
            <div className="flex flex-col gap-2 max-h-48 overflow-auto">
              {periods.filter(p=>p.status==='free').slice(0,1).map(renderPeriodCard)}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-3 py-2 border rounded bg-white">Annuleren</button>
            <button onClick={gotoEmployeesStep} disabled={!selectedStart} className="px-3 py-2 border rounded bg-blue-600 text-white disabled:bg-gray-300">Verder</button>
          </div>
        </div>
      )}

      {step === 'employees' && (
        <div className="flex flex-col gap-4">
          <div className="text-sm text-gray-600">Controleer of de medewerkers die deelnemen op actief staan.</div>
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Team</th>
                  <th className="text-left px-3 py-2">Naam</th>
                  <th className="text-left px-3 py-2">Actief</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees().map(emp => (
                  <tr key={emp.id} className="border-t">
                    <td className="px-3 py-2">{emp.team}</td>
                    <td className="px-3 py-2">{getFullName(emp)}</td>
                    <td className="px-3 py-2">{emp.actief ? 'Ja' : 'Nee'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <span>Medewerkerslijst akkoord?</span>
            <button onClick={()=>gotoConfirmStep()} className="px-3 py-2 border rounded bg-blue-600 text-white">Ja</button>
            <button onClick={backToDashboard} className="px-3 py-2 border rounded bg-white">Nee</button>
          </div>
          <div className="text-sm text-gray-600">Bij Nee: Pas medewerkers aan in Medewerkers Beheer.</div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <div className="text-sm">
            <div className="font-semibold">{formatWeekRange(selectedStart, selectedEnd)}</div>
            <div className="text-gray-600">{formatDateRangeNl(selectedStart, selectedEnd)} wordt aangemaakt. Is dit akkoord?</div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={backToDashboard} className="px-3 py-2 border rounded bg-white">Nee</button>
            <button onClick={createRosterConfirmed} disabled={isCreating} className="px-3 py-2 border rounded bg-blue-600 text-white disabled:bg-blue-400">{isCreating ? 'Aanmaken…' : 'Ja, aanmaken'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
