// RosterPlanningRulesModal: Rooster-specifieke planregels modal
// DRAAD95G: Herontwerp met layout van PlanningRulesClient - prachtige UI!
'use client';

import { RosterPlanningConstraint } from '@/lib/types/planning-constraint';
import { TYPE_LABELS, PRIORITY_COLORS } from '@/lib/types/planning-constraint';
import { useState, useEffect, useCallback } from 'react';
import ToggleSwitch from './ToggleSwitch';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

interface RosterPlanningRulesModalProps {
  rosterId: string;
  periodTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

// RuleCard component (inline voor deze modal)
function RuleCard({ 
  rule, 
  isFixed, 
  onToggle 
}: { 
  rule: RosterPlanningConstraint; 
  isFixed: boolean; 
  onToggle: (ruleId: string, currentActive: boolean) => void;
}) {
  const [showFullParams, setShowFullParams] = useState(false);
  
  const priorityColor = PRIORITY_COLORS[rule.priority];
  const priorityLabels = {
    1: 'Kritiek',
    2: 'Hoog',
    3: 'Normaal',
    4: 'Laag'
  };
  
  const paramsString = JSON.stringify(rule.parameters, null, 2);
  const paramsLines = paramsString.split('\n');
  const shouldTruncate = paramsLines.length > 6;
  const displayParams = shouldTruncate && !showFullParams
    ? paramsLines.slice(0, 5).join('\n') + '\n  ...'
    : paramsString;
  
  return (
    <div className="border border-gray-200 bg-white rounded-lg p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <h4 className="font-bold text-gray-900 mb-2 truncate" title={rule.naam}>
            {rule.naam}
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-block px-2 py-1 rounded text-xs font-bold text-white"
              style={{ backgroundColor: priorityColor }}
              title={`Prioriteit: ${priorityLabels[rule.priority]}`}
            >
              P{rule.priority} · {priorityLabels[rule.priority]}
            </span>
            
            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {TYPE_LABELS[rule.type]}
            </span>
            
            {rule.team && (
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                rule.team === 'groen' ? 'bg-green-100 text-green-700' :
                rule.team === 'oranje' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                Team: {rule.team.charAt(0).toUpperCase() + rule.team.slice(1)}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex-shrink-0">
          {isFixed ? (
            <div 
              className="text-2xl text-gray-400 cursor-help" 
              title="Deze regel kan niet worden uitgeschakeld"
            >
              🔒
            </div>
          ) : (
            <ToggleSwitch 
              checked={rule.actief}
              onChange={() => onToggle(rule.id, rule.actief)}
            />
          )}
        </div>
      </div>
      
      {rule.beschrijving && (
        <p className="text-sm text-gray-600 mb-3 leading-relaxed">
          {rule.beschrijving}
        </p>
      )}
      
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500">Parameters:</span>
          {shouldTruncate && (
            <button
              onClick={() => setShowFullParams(!showFullParams)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              {showFullParams ? '▲ Minder' : '▼ Volledig'}
            </button>
          )}
        </div>
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto font-mono">
          {displayParams}
        </pre>
      </div>
    </div>
  );
}

export default function RosterPlanningRulesModal({
  rosterId,
  periodTitle,
  isOpen,
  onClose
}: RosterPlanningRulesModalProps) {
  const [rules, setRules] = useState<RosterPlanningConstraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Fetch regels
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/roster-planning-constraints?roosterid=${rosterId}`);
      if (!response.ok) {
        throw new Error('Fout bij ophalen planregels');
      }
      
      const data = await response.json();
      setRules(data);
    } catch (err) {
      console.error('Error fetching rules:', err);
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }, [rosterId]);
  
  useEffect(() => {
    if (isOpen) {
      fetchRules();
    }
  }, [isOpen, fetchRules]);
  
  // Toggle handler met optimistic update + toast
  const handleToggleActive = async (ruleId: string, currentActive: boolean) => {
    // Optimistic update
    setRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, actief: !currentActive } : r
    ));
    
    try {
      const response = await fetch(`/api/roster-planning-constraints/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actief: !currentActive })
      });
      
      if (!response.ok) {
        throw new Error('Update failed');
      }
      
      // Success toast
      setToast({
        type: 'success',
        message: !currentActive ? 'Regel geactiveerd' : 'Regel uitgeschakeld'
      });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      // Revert bij fout
      setRules(prev => prev.map(r => 
        r.id === ruleId ? { ...r, actief: currentActive } : r
      ));
      console.error('Error toggling rule:', err);
      
      setToast({
        type: 'error',
        message: 'Er ging iets mis bij het opslaan'
      });
      setTimeout(() => setToast(null), 3000);
    }
  };
  
  // Keyboard handler (ESC)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  // Groepering
  const vasteRegels = rules.filter(r => r.isfixed || r.canrelax === false);
  const aanpasbaareRegels = rules.filter(r => !r.isfixed && r.canrelax !== false);
  
  // Statistieken
  const totalActief = rules.filter(r => r.actief).length;
  const aanpasbaareActief = aanpasbaareRegels.filter(r => r.actief).length;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white rounded-t-xl shadow-lg p-6 md:p-8 flex-shrink-0">
          <div className="flex items-center mb-6">
            <button
              onClick={onClose}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sluiten"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center">
              <div className="w-14 h-14 mr-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center ring-1 ring-purple-200">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Planregels Beheren
                </h1>
                <p className="text-gray-600 mt-1">
                  Periode {periodTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Statistieken */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-900">{totalActief}</div>
              <div className="text-sm text-green-700">Actieve regels totaal</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-900">{vasteRegels.length}</div>
              <div className="text-sm text-blue-700">Vaste regels (altijd actief)</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-3xl font-bold text-purple-900">
                {aanpasbaareActief}/{aanpasbaareRegels.length}
              </div>
              <div className="text-sm text-purple-700">Aanpasbare regels actief</div>
            </div>
          </div>
        </div>
        
        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600">Laden...</span>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">
                <strong>Fout:</strong> {error}
              </p>
            </div>
          )}
          
          {!loading && !error && rules.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">
                Nog geen planregels voor dit rooster.
              </p>
            </div>
          )}
          
          {!loading && !error && rules.length > 0 && (
            <div className="space-y-8">
              {/* Vaste regels sectie */}
              {vasteRegels.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xl">🔒</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Vaste Regels</h2>
                      <p className="text-sm text-gray-600">
                        Deze regels zijn altijd actief en kunnen niet worden uitgeschakeld
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {vasteRegels.map(rule => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        isFixed={true}
                        onToggle={handleToggleActive}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Aanpasbare regels sectie */}
              {aanpasbaareRegels.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                      <span className="text-xl">⚙️</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Aanpasbare Regels</h2>
                      <p className="text-sm text-gray-600">
                        Deze regels kunnen aan- of uitgezet worden voor dit rooster
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {aanpasbaareRegels.map(rule => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        isFixed={false}
                        onToggle={handleToggleActive}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Info banner onderaan */}
          {!loading && !error && rules.length > 0 && (
            <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">💡</span>
                </div>
                <div>
                  <h3 className="font-bold text-blue-900 mb-2">Belangrijk</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Deze planregels gelden specifiek voor <strong>dit rooster (periode {periodTitle})</strong></li>
                    <li>• Wijzigingen hebben alleen effect op dit rooster</li>
                    <li>• Vaste regels kunnen niet worden uitgeschakeld (kritiek voor correctheid)</li>
                    <li>• Aanpasbare regels kun je hier aan- of uitzetten voor dit specifieke rooster</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-white rounded-b-xl border-t border-gray-200 p-6 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors flex items-center gap-2"
          >
            <span>Sluiten</span>
            <span>→</span>
          </button>
        </div>
      </div>
      
      {/* Toast notificaties */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div
            className={`
              flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg
              ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}
              text-white
            `}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
