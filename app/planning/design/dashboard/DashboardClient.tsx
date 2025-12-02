/* DRAAD27H: Link gecorrigeerd naar nieuwe dagdelen-dashboard volgens handover.
 * Oud period-staffing scherm wordt niet meer aangeroepen vanuit dashboard.
 * DRAAD95D: RosterPlanningRulesModal geïntegreerd voor planregels beheer
 * DRAAD95G: periodTitle doorgeven aan modal voor dynamische periode titel
*/
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getRosterIdFromParams } from '@/lib/utils/getRosterIdFromParams';
import { loadRosterDesignData } from '@/lib/planning/rosterDesign';
import { formatWeekRange, formatDateRangeNl } from '@/lib/planning/storage';
import type { RosterDesignData } from '@/lib/types/roster';
import RosterPlanningRulesModal from './components/RosterPlanningRulesModal';

type CompletionStatus = {
  diensten_per_dag: boolean;
  niet_beschikbaar: boolean;
  diensten_per_medewerker: boolean;
  preplanning: boolean;
  planregels: boolean;
};

function loadCompletionStatus(rosterId: string): CompletionStatus {
  if (typeof window === 'undefined') {
    return {
      diensten_per_dag: false,
      niet_beschikbaar: false,
      diensten_per_medewerker: false,
      preplanning: false,
      planregels: false
    };
  }
  const key = `roster_completion_${rosterId}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored) as CompletionStatus; } catch {
      return {
        diensten_per_dag: false,
        niet_beschikbaar: false,
        diensten_per_medewerker: false,
        preplanning: false,
        planregels: false
      };
    }
  }
  return {
    diensten_per_dag: false,
    niet_beschikbaar: false,
    diensten_per_medewerker: false,
    preplanning: false,
    planregels: false
  };
}

function saveCompletionStatus(rosterId: string, status: CompletionStatus) {
  if (typeof window === 'undefined') return;
  const key = `roster_completion_${rosterId}`;
  localStorage.setItem(key, JSON.stringify(status));
}

function extractPeriodInfo(rosterId: string, designData: any): { startDate: string | null; endDate: string | null; periodTitle: string } {
  let startDate = designData?.start_date || designData?.startDate || designData?.roster_start || null;
  let endDate = designData?.end_date || designData?.endDate || designData?.roster_end || null;
  if ((!startDate || !endDate) && typeof window !== 'undefined') {
    try {
      const rostersRaw = localStorage.getItem('verloskunde_rosters');
      if (rostersRaw) {
        const rosters = JSON.parse(rostersRaw);
        const currentRoster = rosters.find((r: any) => r.id === rosterId);
        if (currentRoster) {
          startDate = startDate || currentRoster.start_date || currentRoster.startDate || currentRoster.roster_start;
          endDate = endDate || currentRoster.end_date || currentRoster.endDate || currentRoster.roster_end;
        }
      }
    } catch (err) {
      console.warn('Fout bij ophalen roster periode uit lijst:', err);
    }
  }
  const periodTitle = startDate && endDate ? formatWeekRange(startDate, endDate) : 'Onbekende periode';
  return { startDate, endDate, periodTitle };
}

function StatusBadgeToggle({completed, onToggle, label}:{completed:boolean; onToggle:()=>void; label:string}) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border cursor-pointer select-none ${completed ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`} onClick={onToggle} title={`Zet voltooid voor deze stap handmatig aan/uit voor '${label}'`}>
      <span className="mr-1">{completed ? '✓' : '✗'}</span>
      Voltooid: {completed ? 'Ja' : 'Nee'}
      <span className="ml-2 underline text-xs text-gray-400">(toggle)</span>
    </span>
  );
}

export default function DashboardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = getRosterIdFromParams(searchParams);
  const [designData, setDesignData] = useState<RosterDesignData | null>(null);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus>({
    diensten_per_dag: false,
    niet_beschikbaar: false,
    diensten_per_medewerker: false,
    preplanning: false,
    planregels: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isLastRoster, setIsLastRoster] = useState(false);
  const [periodInfo, setPeriodInfo] = useState<{ startDate: string | null; endDate: string | null; periodTitle: string }>({
    startDate: null,
    endDate: null,
    periodTitle: 'Onbekende periode'
  });
  // DRAAD95D: State voor planregels modal
  const [showPlanningRulesModal, setShowPlanningRulesModal] = useState(false);

  useEffect(() => {
    if (!rosterId) { setError('Geen roster ID gevonden'); setLoading(false); return; }
    async function fetchData() {
      try {
        if (!rosterId) {
          setError('Geen roster ID gevonden');
          return;
        }
        const data = await loadRosterDesignData(rosterId);
        if (data) {
          setDesignData(data);
          setCompletionStatus(loadCompletionStatus(rosterId));
          const extractedPeriod = extractPeriodInfo(rosterId, data);
          setPeriodInfo(extractedPeriod);
          if (typeof window !== 'undefined') {
            const rostersRaw = localStorage.getItem('verloskunde_rosters');
            if (rostersRaw) {
              const rosters = JSON.parse(rostersRaw);
              const sortedRosters = rosters.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              setIsLastRoster(sortedRosters.length > 0 && sortedRosters[0].id === rosterId);
            }
          }
        } else { setError('Geen roster ontwerp data gevonden'); }
      } catch (err) {
        console.error('Error loading design data:', err); setError('Fout bij laden van ontwerp data');
      }
      setLoading(false);
    }
    fetchData();
  }, [rosterId]);
  
  function toggleStep(step: keyof CompletionStatus) {
    if (!rosterId) return;
    const updated = { ...completionStatus, [step]: !completionStatus[step] };
    setCompletionStatus(updated);
    saveCompletionStatus(rosterId, updated);
  }
  const allesVoltooid = Object.values(completionStatus).every(Boolean);
  
  function handleDeleteRoster() {
    if (!rosterId || !isLastRoster) return;
    if (deleteStep === 1) { setDeleteStep(2); return; }
    try {
      if (typeof window !== 'undefined') {
        const rostersRaw = localStorage.getItem('verloskunde_rosters');
        if (rostersRaw) {
          const rosters = JSON.parse(rostersRaw);
          const filtered = rosters.filter((r: any) => r.id !== rosterId);
          localStorage.setItem('verloskunde_rosters', JSON.stringify(filtered));
        }
        localStorage.removeItem(`roster_design_${rosterId}`);
        localStorage.removeItem(`roster_completion_${rosterId}`);
        const lastId = localStorage.getItem('lastRosterId');
        if (lastId === rosterId) { localStorage.removeItem('lastRosterId'); }
      }
      router.push('/planning');
    } catch (err) {
      console.error('Error deleting roster:', err);
      alert('Er is een fout opgetreden bij het verwijderen van het rooster.');
    }
  }
  
  if (loading) {
    return (<div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-gray-600">Dashboard wordt geladen...</p></div></div>);
  }
  if (error || !designData) {
    return (<div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4"><div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center"><h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2><p className="text-red-600 mb-4">{error || 'Onbekende fout'}</p><button onClick={() => router.push('/planning')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Terug naar overzicht</button></div></div>);
  }
  
  const dateSubtitle = periodInfo.startDate && periodInfo.endDate ? formatDateRangeNl(periodInfo.startDate, periodInfo.endDate) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <div className="mb-6 flex items-center">
            <div className="w-16 h-16 mr-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center ring-1 ring-blue-200">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Dashboard Rooster Ontwerp</h1>
              <p className="text-gray-600 mt-1">
                <span className="font-semibold">{periodInfo.periodTitle}</span>
                {dateSubtitle && <span className="text-sm ml-2">({dateSubtitle})</span>}
              </p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <strong>Ontwerpfase:</strong> Vul alle onderdelen in voordat je naar Rooster Bewerking gaat. Klik op de knoppen hieronder om elke stap te doorlopen.
            </p>
          </div>
          
          <div className="space-y-3 mb-6">
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 hover:bg-cyan-100 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start">
                  <span className="text-2xl mr-3 mt-1">📅</span>
                  <div>
                    <h3 className="font-bold text-cyan-900 text-lg">Diensten per dagdeel aanpassen</h3>
                    <p className="text-cyan-700 text-sm">Beheer bezetting per dienst, dagdeel (Ochtend/Middag/Avond), per team.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-row flex-col">
                  <StatusBadgeToggle completed={completionStatus.diensten_per_dag} onToggle={()=>toggleStep('diensten_per_dag')} label="Diensten per dagdeel"/>
                  <Link href={`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodInfo.startDate || ''}`}>
                    <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium whitespace-nowrap">Openen →</button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 hover:bg-red-100 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start">
                  <span className="text-2xl mr-3 mt-1">🚫</span>
                  <div>
                    <h3 className="font-bold text-red-900 text-lg">Niet Beschikbaar aanpassen</h3>
                    <p className="text-red-700 text-sm">Markeer dagen waarop medewerkers niet beschikbaar zijn</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-row flex-col">
                  <StatusBadgeToggle completed={completionStatus.niet_beschikbaar} onToggle={()=>toggleStep('niet_beschikbaar')} label="Niet Beschikbaar"/>
                  <button onClick={()=>router.push(`/planning/design/unavailability?rosterId=${rosterId}`)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium whitespace-nowrap">Openen →</button>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start">
                  <span className="text-2xl mr-3 mt-1">👤</span>
                  <div>
                    <h3 className="font-bold text-green-900 text-lg">Diensten per medewerker aanpassen</h3>
                    <p className="text-green-700 text-sm">Pas het maximum aantal diensten per medewerker aan</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-row flex-col">
                  <StatusBadgeToggle completed={completionStatus.diensten_per_medewerker} onToggle={()=>toggleStep('diensten_per_medewerker')} label="Diensten per medewerker"/>
                  <button onClick={()=>router.push(`/planning/design/diensten-aanpassen?rosterId=${rosterId}`)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium whitespace-nowrap">Openen →</button>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start">
                  <span className="text-2xl mr-3 mt-1">📅</span>
                  <div>
                    <h3 className="font-bold text-blue-900 text-lg">Pre-planning aanpassen</h3>
                    <p className="text-blue-700 text-sm">Wijs specifieke diensten toe aan medewerkers (bijv. echo)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-row flex-col">
                  <StatusBadgeToggle completed={completionStatus.preplanning} onToggle={()=>toggleStep('preplanning')} label="Pre-planning"/>
                  <button onClick={()=>router.push(`/planning/design/preplanning?id=${rosterId}`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap">Openen →</button>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 hover:bg-orange-100 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start">
                  <span className="text-2xl mr-3 mt-1">⚙️</span>
                  <div>
                    <h3 className="font-bold text-orange-900 text-lg">Planregels aanpassen</h3>
                    <p className="text-orange-700 text-sm">Configureer regels voor automatische roosteroptimalisatie</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-row flex-col">
                  <StatusBadgeToggle completed={completionStatus.planregels} onToggle={()=>toggleStep('planregels')} label="Planregels"/>
                  <button onClick={()=>setShowPlanningRulesModal(true)} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium whitespace-nowrap">Openen →</button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full flex flex-col items-center mt-6">
            <button 
              disabled={!allesVoltooid} 
              onClick={()=>{ 
                if(!allesVoltooid) return; 
                alert('Pre-productie: deze functie wordt nog ontwikkeld!'); 
                router.push('/planning');
              }} 
              className={`rounded-xl px-8 py-4 font-bold text-lg shadow ${allesVoltooid ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600 transition' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`} 
              style={{minWidth:'250px'}} 
              tabIndex={allesVoltooid ? 0 : -1}
            >
              Roosterbewerking starten
            </button>
            {!allesVoltooid && (
              <p className="text-sm text-gray-500 mt-2">(Deze knop wordt actief als alle stappen hierboven op &apos;Ja&apos; staan)</p>
            )}
          </div>
          
          {isLastRoster && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              {!showDeleteConfirm && (
                <button onClick={()=>setShowDeleteConfirm(true)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium mt-2">
                  Rooster Verwijderen
                </button>
              )}
              {showDeleteConfirm && (
                <div className="bg-white border border-red-300 rounded-lg p-4 mt-3">
                  <p className="text-red-800 font-semibold mb-3">
                    {deleteStep === 1 ? 'Eerste bevestiging: Weet je zeker dat je dit rooster wilt verwijderen?' : 'Tweede bevestiging: Dit kan NIET ongedaan worden gemaakt!'}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={()=>{setShowDeleteConfirm(false);setDeleteStep(1);}} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium">
                      Nee, annuleren
                    </button>
                    <button onClick={handleDeleteRoster} className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-bold">
                      {deleteStep === 1 ? 'Ja, doorgaan →' : 'JA, DEFINITIEF VERWIJDEREN'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200">
            <button onClick={()=>router.push('/dashboard')} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2">
              <span>←</span>
              <span>Terug naar Dashboard</span>
            </button>
            <div className="text-sm text-gray-600">
              {Object.values(completionStatus).filter(Boolean).length} / 5 stappen voltooid
            </div>
          </div>
        </div>
      </div>
      
      {/* DRAAD95G: RosterPlanningRulesModal met periodTitle */}
      {showPlanningRulesModal && rosterId && (
        <RosterPlanningRulesModal
          rosterId={rosterId}
          periodTitle={periodInfo.periodTitle}
          isOpen={showPlanningRulesModal}
          onClose={()=>setShowPlanningRulesModal(false)}
        />
      )}
    </div>
  );
}
