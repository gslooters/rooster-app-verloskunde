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
import { initializePeriodEmployeeStaffing } from '@/lib/services/period-employee-staffing';
import { loadRosterDesignData } from '@/lib/planning/rosterDesign';
import { supabase } from '@/lib/supabase';

const FIXED_WEEKS = 5;

type WizardStep = 'period' | 'employees' | 'confirm';
type CreationPhase = 'idle' | 'creating' | 'initializing' | 'staffing' | 'generating' | 'verifying' | 'done';

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
  const [verifyAttempt, setVerifyAttempt] = useState<number>(0);

  // DRAAD002: Nieuwe state voor multi-layer feedback
  const [creationPhase, setCreationPhase] = useState<CreationPhase>('idle');
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationMessage, setCreationMessage] = useState('');

  // Async laden van perioden met status
  useEffect(() => {
    async function loadPeriods() {
      try {
        setIsLoadingPeriods(true);
        
        const base = generateFiveWeekPeriods(30);
        
        const periodsWithStatus = await Promise.all(
          base.map(async (p) => ({
            ...p,
            status: await getPeriodStatus(p.start, p.end)
          }))
        );

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

  async function verifyRosterDataExists(rosterId: string, maxAttempts: number = 5): Promise<{
    success: boolean;
    details: string;
  }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      setVerifyAttempt(attempt);
      
      console.log(`[Wizard] 🔍 Verificatie poging ${attempt}/${maxAttempts}...`);
      
      try {
        const designData = await loadRosterDesignData(rosterId);
        
        if (!designData) {
          console.log(`[Wizard] ⏳ roster_design record nog niet beschikbaar`);
          
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          } else {
            return {
              success: false,
              details: 'Roster design record niet gevonden na 5 pogingen'
            };
          }
        }
        
        console.log(`[Wizard] ✅ roster_design gevonden`);
        console.log(`[Wizard]    - Employees: ${designData.employees?.length || 0}`);
        
        if (!designData.employees || designData.employees.length === 0) {
          console.log(`[Wizard] ⏳ Employee snapshot nog leeg`);
          
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          } else {
            return {
              success: false,
              details: 'Employee snapshot is leeg'
            };
          }
        }
        
        const { data: assignments, error: assignError } = await supabase
          .from('roster_assignments')
          .select('id')
          .eq('roster_id', rosterId)
          .limit(1);
        
        if (assignError) {
          console.warn(`[Wizard] ⚠️  Fout bij checken assignments:`, assignError);
        } else {
          console.log(`[Wizard] ✅ roster_assignments check: ${assignments?.length || 0} records`);
        }
        
        console.log('[Wizard] ✅ Roster data volledig geverifieerd - navigatie veilig');
        console.log(`[Wizard] Verificatie geslaagd na ${attempt} poging(en)`);
        
        return {
          success: true,
          details: `Data beschikbaar na ${attempt} poging(en)`
        };
        
      } catch (err) {
        console.log(`[Wizard] ⚠️  Verificatie fout (poging ${attempt}):`, err);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    console.error('[Wizard] ❌ Verificatie gefaald na maximaal aantal pogingen');
    return {
      success: false,
      details: 'Maximum aantal verificatie pogingen bereikt (2.5 seconden timeout)'
    };
  }

  async function createRosterConfirmed() {
    setIsCreating(true);
    setError(null);
    setVerifyAttempt(0);
    setCreationPhase('creating');
    setCreationProgress(0);
    
    let rosterId: string | null = null;
    
    // === FASE 1: Rooster aanmaken (0-25%) ===
    try {
      setCreationMessage('Rooster wordt aangemaakt...');
      setCreationProgress(10);
      
      console.log('\n' + '='.repeat(80));
      console.log('[Wizard] 🚀 START: Rooster aanmaken');
      console.log('[Wizard] Periode:', selectedStart, 'tot', selectedEnd);
      console.log('='.repeat(80) + '\n');
      
      const roster = await createRooster({
        start_date: selectedStart,
        end_date: selectedEnd,
        status: 'draft'
      });
      
      rosterId = roster.id;
      setCreationProgress(25);
      
      console.log('[Wizard] ✅ Rooster succesvol aangemaakt:', rosterId);
      console.log('[Wizard] Start date:', selectedStart);
      console.log('[Wizard] End date:', selectedEnd);
      console.log('');
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastRosterId', rosterId);
        localStorage.setItem('recentDesignRoute', `/planning/design/dashboard?rosterId=${rosterId}`);
      }
      
    } catch (err) {
      console.error('\n' + '='.repeat(80));
      console.error('[Wizard] ❌ FOUT BIJ AANMAKEN ROOSTER');
      console.error('[Wizard] Error:', err);
      console.error('='.repeat(80) + '\n');
      
      setError('Kon rooster niet aanmaken. Probeer opnieuw.');
      setIsCreating(false);
      setCreationPhase('idle');
      return;
    }
    
    // === FASE 2: Design initialiseren (25-50%) ===
    try {
      setCreationPhase('initializing');
      setCreationMessage('Rooster design wordt geïnitialiseerd...');
      setCreationProgress(30);
      
      const designData = await initializeRosterDesign(rosterId, selectedStart);
      
      if (!designData) {
        throw new Error('Kon roster design niet initialiseren');
      }
      
      setCreationProgress(50);
      console.log('[Wizard] ✅ Roster design geïnitialiseerd');
      console.log('');
      
    } catch (err) {
      console.error('[Wizard] ❌ FOUT BIJ INITIALISEREN DESIGN');
      console.error('[Wizard] Error:', err);
      setError('Kon roster design niet initialiseren.');
      setIsCreating(false);
      setCreationPhase('idle');
      return;
    }
    
    // === FASE 3: Period Employee Staffing (50-70%) ===
    try {
      setCreationPhase('staffing');
      setCreationMessage('Diensten per medewerker worden voorbereid...');
      setCreationProgress(55);
      
      const activeEmployeeIds = employees
        .filter(emp => emp.actief)
        .map(emp => emp.id);
      
      console.log(`[Wizard] Actieve medewerkers: ${activeEmployeeIds.length}`);
      
      await initializePeriodEmployeeStaffing(rosterId!, activeEmployeeIds);
      
      setCreationProgress(70);
      console.log('[Wizard] ✅ Period employee staffing geïnitialiseerd');
      console.log('');
      
    } catch (err) {
      console.warn('[Wizard] ⚠️ Waarschuwing bij period employee staffing:', err);
      // Niet kritiek - ga door
    }
    
    // === FASE 4: Diensten per dag genereren (70-85%) ===
    try {
      setCreationPhase('generating');
      setCreationMessage('Diensten per dag worden gegenereerd...');
      setCreationProgress(75);
      
      await generateRosterPeriodStaffing(rosterId!, selectedStart, selectedEnd);
      
      setCreationProgress(85);
      console.log('[Wizard] ✅ Diensten per dag data gegenereerd');
      console.log('');
      
    } catch (err) {
      console.warn('[Wizard] ⚠️ Waarschuwing bij diensten per dag:', err);
      // Niet kritiek - ga door
    }
    
    // === FASE 5: Verificatie (85-100%) ===
    setCreationPhase('verifying');
    setCreationMessage('Database wordt geverifieerd...');
    setCreationProgress(90);
    
    console.log('\n' + '='.repeat(80));
    console.log('[Wizard] 🔍 START: Database verificatie');
    console.log('='.repeat(80) + '\n');
    
    const verificationResult = await verifyRosterDataExists(rosterId!);
    
    if (!verificationResult.success) {
      console.error('[Wizard] ❌ Data verificatie gefaald');
      setError(`Rooster aangemaakt maar data nog niet beschikbaar: ${verificationResult.details}`);
      setIsCreating(false);
      setCreationPhase('idle');
      
      setTimeout(() => {
        if (onClose) onClose();
        router.push('/planning');
      }, 3000);
      
      return;
    }
    
    setCreationProgress(100);
    setCreationPhase('done');
    setCreationMessage('Rooster succesvol aangemaakt!');
    console.log('[Wizard] ✅ Verificatie geslaagd');
    
    // Korte delay voor visuele feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('[Wizard] 🔄 Navigeren naar dashboard...');
    console.log('\n' + '='.repeat(80));
    console.log('[Wizard] ✅ WIZARD VOLTOOID');
    console.log('='.repeat(80) + '\n');
    
    if (onClose) {
      onClose();
    }
    
    router.push(`/planning/design/dashboard?rosterId=${rosterId}`);
    setIsCreating(false);
    setCreationPhase('idle');
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
      {error && <p className="text-red-600 mb-2 text-sm">{error}</p>}

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
          
          {/* DRAAD002: Verbeterde multi-layer loading feedback */}
          {isCreating && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-900">
                    {creationMessage}
                  </span>
                  <span className="text-sm font-mono text-blue-700">
                    {creationProgress}%
                  </span>
                </div>
                
                {/* Animated Progress Bar met shimmer */}
                <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out relative"
                    style={{ width: `${creationProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                  </div>
                </div>
              </div>
              
              {/* Phase Indicators */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[
                  { phase: 'creating', label: 'Aanmaken', icon: '📋' },
                  { phase: 'initializing', label: 'Design', icon: '🎨' },
                  { phase: 'staffing', label: 'Medewerkers', icon: '👥' },
                  { phase: 'generating', label: 'Diensten', icon: '📅' },
                  { phase: 'verifying', label: 'Verifiëren', icon: '🔍' }
                ].map((item) => {
                  const phaseOrder = ['creating', 'initializing', 'staffing', 'generating', 'verifying'];
                  const currentIndex = phaseOrder.indexOf(creationPhase);
                  const itemIndex = phaseOrder.indexOf(item.phase);
                  const isActive = creationPhase === item.phase;
                  const isDone = itemIndex < currentIndex;
                  
                  return (
                    <div 
                      key={item.phase}
                      className={`
                        text-center p-2 rounded-lg border-2 transition-all duration-300
                        ${isActive ? 'bg-blue-600 border-blue-700 text-white scale-105 shadow-lg' : ''}
                        ${isDone ? 'bg-green-100 border-green-300 text-green-800' : ''}
                        ${!isActive && !isDone ? 'bg-gray-50 border-gray-200 text-gray-400' : ''}
                      `}
                    >
                      <div className="text-xl mb-1">{item.icon}</div>
                      <div className="text-xs font-medium">{item.label}</div>
                    </div>
                  );
                })}
              </div>
              
              {/* Spinning Loader + Detail Text */}
              <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
                <div className="flex-shrink-0">
                  <div className="animate-spin rounded-full h-6 w-6 border-3 border-blue-600 border-t-transparent"></div>
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium text-gray-900 mb-1">
                    {creationPhase === 'creating' && 'Rooster record wordt aangemaakt in database...'}
                    {creationPhase === 'initializing' && 'Medewerker snapshot en basis structuur worden ingesteld...'}
                    {creationPhase === 'staffing' && 'Beschikbaarheid en voorkeuren worden verwerkt...'}
                    {creationPhase === 'generating' && 'Diensten per dag worden berekend en opgeslagen...'}
                    {creationPhase === 'verifying' && `Database commit wordt geverifieerd (poging ${verifyAttempt}/5)...`}
                    {creationPhase === 'done' && 'Alles gereed! Dashboard wordt geladen...'}
                  </div>
                  <div className="text-xs text-gray-600">
                    Even geduld, dit kan enkele seconden duren
                  </div>
                </div>
              </div>
              
              {/* Verification Progress Detail */}
              {creationPhase === 'verifying' && verifyAttempt > 0 && (
                <div className="mt-3 bg-white/80 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-blue-900">Verificatie details:</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${verifyAttempt >= 1 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                      <span className="text-gray-700">Roster design record controleren...</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${verifyAttempt >= 2 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                      <span className="text-gray-700">Employee snapshot valideren...</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${verifyAttempt >= 3 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                      <span className="text-gray-700">Roster assignments checken...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2 justify-end">
            <button 
              onClick={backToDashboard} 
              disabled={isCreating}
              className="px-3 py-2 border rounded bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Nee
            </button>
            <button 
              onClick={createRosterConfirmed} 
              disabled={isCreating} 
              className="px-3 py-2 border rounded bg-blue-600 text-white disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  {creationPhase === 'verifying' ? 'Verifiëren...' : 'Bezig...'}
                </>
              ) : (
                'Ja, aanmaken'
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}