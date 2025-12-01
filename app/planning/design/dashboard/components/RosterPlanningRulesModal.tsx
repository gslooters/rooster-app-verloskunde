// RosterPlanningRulesModal: Vereenvoudigde modal voor toggle-only planregels
// DRAAD95F: Vereenvoudigde Planregels UI - Toggle-Only Interface
'use client';

import { RosterPlanningConstraint } from '@/lib/types/planning-constraint';
import { useState, useEffect, useCallback } from 'react';
import RosterRuleCard from './RosterRuleCard';

interface RosterPlanningRulesModalProps {
  rosterId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function RosterPlanningRulesModal({
  rosterId,
  isOpen,
  onClose
}: RosterPlanningRulesModalProps) {
  const [rules, setRules] = useState<RosterPlanningConstraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
  
  // Toggle handler met optimistic update
  const handleToggleActive = async (ruleId: string, currentActive: boolean) => {
    // Optimistic update - direct visuele feedback
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
    } catch (err) {
      // Revert bij fout
      setRules(prev => prev.map(r => 
        r.id === ruleId ? { ...r, actief: currentActive } : r
      ));
      console.error('Error toggling rule:', err);
      setError('Fout bij wijzigen regel. Probeer opnieuw.');
      setTimeout(() => setError(null), 3000);
    }
  };
  
  // Keyboard handler (ESC om te sluiten)
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
  
  // Groepering: Vaste regels vs Aanpasbare regels
  const groupedRules = {
    vaste: rules.filter(r => r.isfixed || r.canrelax === false),
    aanpasbaar: rules.filter(r => !r.isfixed && r.canrelax !== false)
  };
  
  const activeCount = rules.filter(r => r.actief).length;
  const totalCount = rules.length;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span className="text-xl">←</span>
              <span className="font-medium">Terug naar Dashboard</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              title="Sluiten"
            >
              ×
            </button>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Planregels Beheren
          </h2>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>
              <strong>{activeCount}</strong> actieve regels
            </span>
            <span className="text-gray-400">|</span>
            <span>
              <strong>{totalCount}</strong> totale regels
            </span>
          </div>
        </div>
        
        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
              {groupedRules.vaste.length > 0 && (
                <section>
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="text-green-600">🔒</span>
                      <span>Vaste Regels</span>
                    </h3>
                    <p className="text-sm text-gray-600">
                      Deze regels kunnen niet worden uitgeschakeld.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {groupedRules.vaste.map(rule => (
                      <RosterRuleCard
                        key={rule.id}
                        rule={rule}
                        isFixed={true}
                        onToggle={handleToggleActive}
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Aanpasbare regels sectie */}
              {groupedRules.aanpasbaar.length > 0 && (
                <section>
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="text-blue-600">📝</span>
                      <span>Aanpasbare Regels</span>
                    </h3>
                    <p className="text-sm text-gray-600">
                      Schakel regels in of uit voor dit rooster.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {groupedRules.aanpasbaar.map(rule => (
                      <RosterRuleCard
                        key={rule.id}
                        rule={rule}
                        isFixed={false}
                        onToggle={handleToggleActive}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors flex items-center gap-2"
          >
            <span>Sluiten</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
