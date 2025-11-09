'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData } from '@/lib/planning/rosterDesign';
import { formatWeekRange, formatDateRangeNl } from '@/lib/planning/storage';
import type { RosterDesignData } from '@/lib/types/roster';

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
    try {
      return JSON.parse(stored) as CompletionStatus;
    } catch {
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

function StatusBadge({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
        <span className="mr-1">✓</span>
        Voltooid: Ja
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-300">
      <span className="mr-1">✗</span>
      Voltooid: Nee
    </span>
  );
}

export default function DashboardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = searchParams.get('rosterId');
  
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

  useEffect(() => {
    if (!rosterId) {
      setError('Geen roster ID gevonden');
      setLoading(false);
      return;
    }

    try {
      const data = loadRosterDesignData(rosterId);
      if (data) {
        setDesignData(data);
        setCompletionStatus(loadCompletionStatus(rosterId));
        
        // Check if this is the last roster
        if (typeof window !== 'undefined') {
          const rostersRaw = localStorage.getItem('verloskunde_rosters');
          if (rostersRaw) {
            const rosters = JSON.parse(rostersRaw);
            const sortedRosters = rosters.sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setIsLastRoster(sortedRosters.length > 0 && sortedRosters[0].id === rosterId);
          }
        }
      } else {
        setError('Geen roster ontwerp data gevonden');
      }
    } catch (err) {
      console.error('Error loading design data:', err);
      setError('Fout bij laden van ontwerp data');
    }
    setLoading(false);
  }, [rosterId]);

  function handleNavigation(path: string, markComplete?: keyof CompletionStatus) {
    if (!rosterId) return;
    
    // Mark as complete if specified
    if (markComplete && completionStatus) {
      const updated = { ...completionStatus, [markComplete]: true };
      setCompletionStatus(updated);
      saveCompletionStatus(rosterId, updated);
    }
    
    router.push(path);
  }

  function handleDeleteRoster() {
    if (!rosterId || !isLastRoster) return;
    
    if (deleteStep === 1) {
      setDeleteStep(2);
      return;
    }
    
    // Step 2: Actually delete
    try {
      // Remove roster from main list
      if (typeof window !== 'undefined') {
        const rostersRaw = localStorage.getItem('verloskunde_rosters');
        if (rostersRaw) {
          const rosters = JSON.parse(rostersRaw);
          const filtered = rosters.filter((r: any) => r.id !== rosterId);
          localStorage.setItem('verloskunde_rosters', JSON.stringify(filtered));
        }
        
        // Remove design data
        localStorage.removeItem(`roster_design_${rosterId}`);
        
        // Remove completion status
        localStorage.removeItem(`roster_completion_${rosterId}`);
        
        // Clear last roster ID if it matches
        const lastId = localStorage.getItem('lastRosterId');
        if (lastId === rosterId) {
          localStorage.removeItem('lastRosterId');
        }
      }
      
      // Navigate back to planning overview
      router.push('/planning');
    } catch (err) {
      console.error('Error deleting roster:', err);
      alert('Er is een fout opgetreden bij het verwijderen van het rooster.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Dashboard wordt geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !designData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2>
          <p className="text-red-600 mb-4">{error || 'Onbekende fout'}</p>
          <button
            onClick={() => router.push('/planning')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Terug naar overzicht
          </button>
        </div>
      </div>
    );
  }

  const startDate = (designData as any).start_date || (designData as any).roster_start;
  const endDate = (designData as any).end_date || (designData as any).roster_end;
  const periodTitle = startDate && endDate ? formatWeekRange(startDate, endDate) : 'Onbekende periode';
  const dateSubtitle = startDate && endDate ? formatDateRangeNl(startDate, endDate) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {/* Header */}
          <div className="mb-6 flex items-center">
            <div className="w-16 h-16 mr-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center ring-1 ring-blue-200">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                Dashboard Rooster Ontwerp
              </h1>
              <p className="text-gray-600 mt-1">
                <span className="font-semibold">{periodTitle}</span>
                {dateSubtitle && <span className="text-sm ml-2">({dateSubtitle})</span>}
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <strong>Ontwerpfase:</strong> Vul alle onderdelen in voordat je naar Rooster Bewerking gaat. 
              Klik op de knoppen hieronder om elke stap te doorlopen.
            </p>
          </div>

          {/* Main navigation buttons */}
          <div className="space-y-3 mb-6">
            {/* 1. Diensten per dag */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start">
                  <span className="text-2xl mr-3 mt-1">📊</span>
                  <div>
                    <h3 className="font-bold text-purple-900 text-lg">Diensten per dag aanpassen</h3>
                    <p className="text-purple-700 text-sm">Stel het aantal benodigde medewerkers per dienst per dag in</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-row flex-col">
                  <StatusBadge completed={completionStatus.diensten_per_dag} />
                  <button
                    onClick={() => alert('Deze functie wordt binnenkort toegevoegd')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium whitespace-nowrap"
                  >
                    Openen →
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Niet Beschikbaar */}
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
                  <StatusBadge completed={completionStatus.niet_beschikbaar} />
                  <button
                    onClick={() => handleNavigation(`/planning/design?rosterId=${rosterId}`, 'niet_beschikbaar')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium whitespace-nowrap"
                  >
                    Openen →
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Diensten per medewerker */}
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
                  <StatusBadge completed={completionStatus.diensten_per_medewerker} />
                  <button
                    onClick={() => handleNavigation(`/planning/design?rosterId=${rosterId}`, 'diensten_per_medewerker')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium whitespace-nowrap"
                  >
                    Openen →
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Pre-planning */}
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
                  <StatusBadge completed={completionStatus.preplanning} />
                  <button
                    onClick={() => alert('Deze functie wordt binnenkort toegevoegd')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
                  >
                    Openen →
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Planregels */}
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
                  <StatusBadge completed={completionStatus.planregels} />
                  <button
                    onClick={() => alert('Deze functie wordt binnenkort toegevoegd')}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium whitespace-nowrap"
                  >
                    Openen →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          {isLastRoster && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div className="flex items-start mb-3">
                  <span className="text-2xl mr-3">⚠️</span>
                  <div>
                    <h3 className="font-bold text-red-900 text-lg">Gevarenzone</h3>
                    <p className="text-red-700 text-sm">
                      Dit is het laatste aangemaakte rooster. Je kunt het verwijderen als je opnieuw wilt beginnen.
                      <strong> Alle data worden permanent verwijderd.</strong>
                    </p>
                  </div>
                </div>
                
                {!showDeleteConfirm && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    Rooster Verwijderen
                  </button>
                )}
                
                {showDeleteConfirm && (
                  <div className="bg-white border border-red-300 rounded-lg p-4 mt-3">
                    <p className="text-red-800 font-semibold mb-3">
                      {deleteStep === 1 ? 'Eerste bevestiging: Weet je zeker dat je dit rooster wilt verwijderen?' : 'Tweede bevestiging: Dit kan NIET ongedaan worden gemaakt!'}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteStep(1);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                      >
                        Nee, annuleren
                      </button>
                      <button
                        onClick={handleDeleteRoster}
                        className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-bold"
                      >
                        {deleteStep === 1 ? 'Ja, doorgaan →' : 'JA, DEFINITIEF VERWIJDEREN'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom navigation */}
          <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2"
            >
              <span>←</span>
              <span>Terug naar Dashboard</span>
            </button>
            
            <div className="text-sm text-gray-600">
              {Object.values(completionStatus).filter(Boolean).length} / 5 stappen voltooid
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
