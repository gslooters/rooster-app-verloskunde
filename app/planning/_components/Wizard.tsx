'use client';

import React, { useEffect, useState } from 'react';
import { 
  generateFiveWeekPeriods, getPeriodStatus, formatWeekRange, formatDateRangeNl
} from '@/lib/planning/storage';
import { createRooster } from '@/lib/services/roosters-supabase';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { Employee, TeamType, DienstverbandType, getFullName } from '@/lib/types/employee';
import { initializeRosterDesign } from '@/lib/planning/rosterDesign';
import { useRouter } from 'next/navigation';
import { generateRosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';

const FIXED_WEEKS = 5;

type WizardStep = 'period' | 'employees' | 'confirm';

interface WizardProps { 
  onClose?: () => void; 
}

interface PeriodWithStatus {
  start: string;
  end: string;
  status: 'draft' | 'in_progress' | 'final' | 'free';
}

export default function Wizard({ onClose }: WizardProps = {}) {
  const router = useRouter();

  // Stap 1: Periode keuze
  const [periods, setPeriods] = useState<PeriodWithStatus[]>([]);
  const [selectedStart, setSelectedStart] = useState<string>('');
  const [selectedEnd, setSelectedEnd] = useState<string>('');
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);

  // Stap 2: Medewerkers controle
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [step, setStep] = useState<WizardStep>('period');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Async laden van perioden met status
  useEffect(() => {
    async function loadPeriods() {
      try {
        setIsLoadingPeriods(true);
        
        // Genereer basisperioden
        const base = generateFiveWeekPeriods(30);
        
        // Haal async status op voor elke periode
        const periodsWithStatus = await Promise.all(
          base.map(async (p) => ({
            ...p,
            status: await getPeriodStatus(p.start, p.end)
          }))
        );

        // Sorteer: in_progress eerst, dan draft, dan free
        const inProg = periodsWithStatus
          .filter(p => p.status === 'in_progress')
          .sort((a,b) => a.start.localeCompare(b.start));
        const drafts = periodsWithStatus
          .filter(p => p.status === 'draft')
          .sort((a,b) => a.start.localeCompare(b.start));
        const free = periodsWithStatus
          .filter(p => p.status === 'free');

        const ordered = [...inProg, ...drafts, ...free];
        setPeriods(ordered);

        // Selecteer eerste vrije periode
        const firstFree = free[0];
        if (firstFree) { 
          setSelectedStart(firstFree.start); 
          setSelectedEnd(firstFree.end); 
        }
      } catch (err) {
        console.error('[Wizard] Fout bij laden perioden:', err);
        setError('Kon perioden niet laden. Probeer opnieuw.');
      } finally {
        setIsLoadingPeriods(false);
      }
    }

    loadPeriods();
    setEmployees(getAllEmployees());
  }, []);

  function gotoEmployeesStep() {
    if (!selectedStart || !selectedEnd) { 
      setError('Geen beschikbare periode gevonden.'); 
      return; 
    }
    setError(null); 
    setStep('employees');
  }

  function gotoConfirmStep() { 
    setStep('confirm'); 
  }
  
  function backToDashboard() { 
    if (onClose) onClose(); 
    router.push('/dashboard'); 
  }

  async function createRosterConfirmed() {
    setIsCreating(true);
    setError(null);
    
    let rosterId: string | null = null;
    
    // === FASE 1: Rooster aanmaken (kritiek) ===
    try {
      console.log('\n' + '='.repeat(80));
      console.log('[Wizard] 🚀 START: Rooster aanmaken');
      console.log('[Wizard] Periode:', selectedStart, 'tot', selectedEnd);
      console.log('='.repeat(80) + '\n');
      
      // DIRECT DATABASE CALL - GEBRUIK GERETOURNEERDE ID ✅
      const roster = await createRooster({
        start_date: selectedStart,
        end_date: selectedEnd,
        status: 'draft'
      });
      
      rosterId = roster.id; // GEBRUIK DATABASE UUID
      
      console.log('[Wizard] ✅ Rooster succesvol aangemaakt:', rosterId);
      console.log('[Wizard] Start date:', selectedStart);
      console.log('[Wizard] End date:', selectedEnd);
      console.log('');
      
      // === DRAAD26O-FASE1: DIAGNOSE LOGGING ===
      console.log('\n' + '='.repeat(80));
      console.log('[DIAGNOSE] 🔍 FASE 1: RoostervrijDagen Data Check');
      console.log('='.repeat(80));
      
      // Haal ALLE medewerkers op (actief + niet-actief voor complete diagnose)
      const allEmployees = getAllEmployees();
      console.log(`[DIAGNOSE] Totaal medewerkers in systeem: ${allEmployees.length}`);
      
      // Filter alleen actieve medewerkers (deze worden gebruikt in rooster)
      const activeEmployees = allEmployees.filter(emp => emp.actief);
      console.log(`[DIAGNOSE] Actieve medewerkers: ${activeEmployees.length}`);
      
      // Analyseer roostervrijDagen data
      const medewerkersMetData = activeEmployees.filter(
        emp => emp.roostervrijDagen && emp.roostervrijDagen.length > 0
      );
      const medewerkersSonderData = activeEmployees.filter(
        emp => !emp.roostervrijDagen || emp.roostervrijDagen.length === 0
      );
      
      console.log(`[DIAGNOSE] Met roostervrijDagen: ${medewerkersMetData.length}`);
      console.log(`[DIAGNOSE] Zonder roostervrijDagen: ${medewerkersSonderData.length}`);
      console.log('');
      
      // Log detail per medewerker met data
      if (medewerkersMetData.length > 0) {
        console.log('[DIAGNOSE] ✅ Medewerkers MET roostervrijDagen:');
        medewerkersMetData.forEach(emp => {
          console.log(`  • ${emp.voornaam} ${emp.achternaam}: [${emp.roostervrijDagen.join(', ')}]`);
        });
        console.log('');
      }
      
      // Waarschuwing voor medewerkers zonder data
      if (medewerkersSonderData.length > 0) {
        console.warn('[DIAGNOSE] ⚠️  Medewerkers ZONDER roostervrijDagen:');
        medewerkersSonderData.forEach(emp => {
          console.warn(`  • ${emp.voornaam} ${emp.achternaam}: GEEN DATA`);
        });
        console.warn('');
        console.warn('[DIAGNOSE] ⚠️  Deze medewerkers krijgen GEEN automatische NB dagen!');
        console.warn('[DIAGNOSE] → Configureer roostervrijDagen in Medewerkers Beheer');
        console.warn('');
      }
      
      // Kritieke waarschuwing als NIEMAND data heeft
      if (medewerkersMetData.length === 0) {
        console.error('\n' + '='.repeat(80));
        console.error('[DIAGNOSE] ❌ KRITIEK: GEEN ENKELE MEDEWERKER HEEFT ROOSTERVRIJDAGEN!');
        console.error('='.repeat(80));
        console.error('[DIAGNOSE] Gevolg: roster_assignments tabel blijft leeg (0 rijen)');
        console.error('[DIAGNOSE] Actie: Ga naar Medewerkers Beheer en configureer roostervrijDagen');
        console.error('[DIAGNOSE] Bijvoorbeeld: ma,di voor medewerker die maandag/dinsdag vrij heeft');
        console.error('='.repeat(80) + '\n');
      } else {
        console.log('[DIAGNOSE] ✅ Data check geslaagd - roostervrijDagen aanwezig');
        console.log('[DIAGNOSE] Verwacht: autofillUnavailability zal NB records aanmaken');
      }
      
      console.log('='.repeat(80) + '\n');
      // === EINDE DIAGNOSE LOGGING ===
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastRosterId', rosterId);
        localStorage.setItem('recentDesignRoute', `/planning/design/dashboard?rosterId=${rosterId}`);
      }
      
      // NU MET CORRECTE DATABASE ID ✅
      await initializeRosterDesign(rosterId, selectedStart);
      
      console.log('[Wizard] ✅ Roster design geïnitialiseerd');
      console.log('');
      
    } catch (err) {
      console.error('\n' + '='.repeat(80));
      console.error('[Wizard] ❌ FOUT BIJ AANMAKEN ROOSTER');
      console.error('[Wizard] Error:', err);
      console.error('='.repeat(80) + '\n');
      
      setError('Kon rooster niet aanmaken. Probeer opnieuw.');
      setIsCreating(false);
      return; // Stop hier volledig
    }
    
    // === FASE 2: Period staffing genereren (niet-kritiek) ===
    try {
      console.log('[Wizard] 🔄 START: Genereren diensten per dag data...');
      console.log('[Wizard] RosterId:', rosterId);
      console.log('');
      
      await generateRosterPeriodStaffing(rosterId!, selectedStart, selectedEnd);
      
      console.log('[Wizard] ✅ Diensten per dag data succesvol gegenereerd');
      console.log('');
      
    } catch (err) {
      console.error('\n' + '='.repeat(80));
      console.error('[Wizard] ⚠️  WAARSCHUWING: Fout bij genereren diensten per dag');
      console.error('[Wizard] Error:', err);
      console.error('[Wizard] ⚠️  Rooster is WEL aangemaakt maar diensten per dag data ontbreekt.');
      console.error('[Wizard] Gebruiker kan later handmatig genereren vanuit dashboard.');
      console.error('='.repeat(80) + '\n');
      
      // Ga WEL door naar dashboard (rooster bestaat al)
      // Geen error message tonen aan gebruiker - niet kritiek
    }
    
    // === FASE 3: Navigeer naar dashboard ===
    console.log('[Wizard] 🔄 Navigeren naar dashboard...');
    console.log('[Wizard] Route:', `/planning/design/dashboard?rosterId=${rosterId}`);
    console.log('\n' + '='.repeat(80));
    console.log('[Wizard] ✅ WIZARD VOLTOOID');
    console.log('='.repeat(80) + '\n');
    
    if (onClose) {
      onClose();
    }
    
    // Direct navigeren zonder setTimeout (voorkomt race conditions)
    router.push(`/planning/design/dashboard?rosterId=${rosterId}`);
    setIsCreating(false);
  }

  function statusBadge(period: PeriodWithStatus) {
    if (period.status === 'in_progress') {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
          In bewerking
        </span>
      );
    }
    if (period.status === 'draft') {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
          In ontwerp
        </span>
      );
    }
    return null;
  }

  function isDisabled(period: PeriodWithStatus) { 
    return period.status === 'in_progress' || period.status === 'draft'; 
  }

  function renderPeriodCard(p: PeriodWithStatus) {
    const isSelected = selectedStart === p.start;
    const selectable = p.status === 'free' && periods.findIndex(x=>x.status==='free') === periods.indexOf(p);
    const baseCls = 'border rounded-lg p-3 flex items-center justify-between';
    const disabledCls = isDisabled(p) ? 'bg-gray-50 opacity-70 cursor-not-allowed' : '';
    const selectedCls = isSelected ? 'ring-2 ring-red-300 bg-red-50' : '';
    const selectableCls = selectable ? 'hover:bg-red-50 cursor-pointer' : (isDisabled(p) ? '' : 'opacity-60 cursor-not-allowed');

    const handle = () => { 
      if (selectable) { 
        setSelectedStart(p.start); 
        setSelectedEnd(p.end);
      } 
    };

    return (
      <div 
        key={`${p.start}-${p.end}`} 
        onClick={handle} 
        className={`${baseCls} ${disabledCls} ${selectedCls} ${selectableCls}`}
      >
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

  // Loading state voor perioden
  if (isLoadingPeriods) {
    return (
      <section className={onClose ? '' : 'p-4 border rounded bg-white'}>
        {!onClose && <h2 className="text-lg font-semibold mb-3">Nieuw rooster</h2>}
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Perioden laden...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={onClose ? '' : 'p-4 border rounded bg-white'}>
      {!onClose && <h2 className="text-lg font-semibold mb-3">Nieuw rooster</h2>}
      {error && <p className="text-red-600 mb-2">{error}</p>}

      {step === 'period' && (
        <div className="flex flex-col gap-4">
          <div className="text-sm text-gray-600">
            Kies de eerstvolgende beschikbare periode. Perioden in ontwerp/bewerking zijn niet kiesbaar.
          </div>
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
            <button 
              onClick={onClose} 
              className="px-3 py-2 border rounded bg-white"
            >
              Annuleren
            </button>
            <button 
              onClick={gotoEmployeesStep} 
              disabled={!selectedStart} 
              className="px-3 py-2 border rounded bg-blue-600 text-white disabled:bg-gray-300"
            >
              Verder
            </button>
          </div>
        </div>
      )}

      {step === 'employees' && (
        <div className="flex flex-col gap-4">
          <div className="text-sm text-gray-600">
            Controleer of de medewerkers die deelnemen op actief staan.
          </div>
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
            <button 
              onClick={()=>gotoConfirmStep()} 
              className="px-3 py-2 border rounded bg-blue-600 text-white"
            >
              Ja
            </button>
            <button 
              onClick={backToDashboard} 
              className="px-3 py-2 border rounded bg-white"
            >
              Nee
            </button>
          </div>
          <div className="text-sm text-gray-600">
            Bij Nee: Pas medewerkers aan in Medewerkers Beheer.
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <div className="text-sm">
            <div className="font-semibold">{formatWeekRange(selectedStart, selectedEnd)}</div>
            <div className="text-gray-600">
              {formatDateRangeNl(selectedStart, selectedEnd)} wordt aangemaakt. Is dit akkoord?
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={backToDashboard} 
              className="px-3 py-2 border rounded bg-white"
            >
              Nee
            </button>
            <button 
              onClick={createRosterConfirmed} 
              disabled={isCreating} 
              className="px-3 py-2 border rounded bg-blue-600 text-white disabled:bg-blue-400"
            >
              {isCreating ? 'Aanmaken…' : 'Ja, aanmaken'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}