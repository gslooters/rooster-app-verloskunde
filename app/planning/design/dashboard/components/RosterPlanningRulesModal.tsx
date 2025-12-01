// RosterPlanningRulesModal: Hoofdmodal voor rooster-specifieke planregels
// DRAAD95D: Rooster-specifieke Planregels UI Implementatie
'use client';

import { RosterPlanningConstraint, PlanningConstraint } from '@/lib/types/planning-constraint';
import { useState, useEffect, useCallback } from 'react';
import RosterRuleCard from './RosterRuleCard';
import OverrideEditor from './OverrideEditor';
import AddAdHocRuleForm from './AddAdHocRuleForm';

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
  const [baseConstraints, setBaseConstraints] = useState<Map<string, PlanningConstraint>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<RosterPlanningConstraint | null>(null);
  const [showAddAdHoc, setShowAddAdHoc] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
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
      
      // Haal base constraints op voor overrides
      const baseIds = data
        .filter((r: RosterPlanningConstraint) => r.baseconstraintid)
        .map((r: RosterPlanningConstraint) => r.baseconstraintid);
      
      if (baseIds.length > 0) {
        const baseResponse = await fetch('/api/planning-constraints');
        if (baseResponse.ok) {
          const baseData = await baseResponse.json();
          const baseMap = new Map<string, PlanningConstraint>();
          baseData.forEach((bc: PlanningConstraint) => {
            baseMap.set(bc.id, bc);
          });
          setBaseConstraints(baseMap);
        }
      }
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
  
  // Toast functie
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  }
  
  // Edit handler
  async function handleSaveEdit(updates: Partial<RosterPlanningConstraint>) {
    if (!editingRule) return;
    
    try {
      const response = await fetch(`/api/roster-planning-constraints/${editingRule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Fout bij opslaan wijzigingen');
      }
      
      showToast('Regel succesvol bijgewerkt', 'success');
      setEditingRule(null);
      await fetchRules();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fout bij opslaan', 'error');
      throw err;
    }
  }
  
  // Reset handler
  async function handleReset(rule: RosterPlanningConstraint) {
    if (!confirm(`Weet je zeker dat je "${rule.naam}" wilt terugzetten naar de originele waarden?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/roster-planning-constraints/${rule.id}/reset`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Fout bij terugzetten regel');
      }
      
      showToast('Regel succesvol teruggezet naar origineel', 'success');
      await fetchRules();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fout bij terugzetten', 'error');
    }
  }
  
  // Delete handler (ad-hoc)
  async function handleDelete(rule: RosterPlanningConstraint) {
    if (!confirm(`Weet je zeker dat je "${rule.naam}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/roster-planning-constraints/${rule.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Fout bij verwijderen regel');
      }
      
      showToast('Regel succesvol verwijderd', 'success');
      await fetchRules();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fout bij verwijderen', 'error');
    }
  }
  
  // Add ad-hoc handler
  async function handleAddAdHoc(newRule: any) {
    try {
      const response = await fetch('/api/roster-planning-constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fout bij aanmaken regel');
      }
      
      showToast('Ad-hoc regel succesvol toegevoegd', 'success');
      setShowAddAdHoc(false);
      await fetchRules();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fout bij aanmaken', 'error');
      throw err;
    }
  }
  
  // Keyboard handler (ESC)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !editingRule && !showAddAdHoc) {
        onClose();
      }
    }
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, editingRule, showAddAdHoc, onClose]);
  
  if (!isOpen) return null;
  
  // Groepering
  const fixedRules = rules.filter(r => {
    const base = r.baseconstraintid ? baseConstraints.get(r.baseconstraintid) : null;
    return base?.isfixed;
  });
  const activeRules = rules.filter(r => {
    const base = r.baseconstraintid ? baseConstraints.get(r.baseconstraintid) : null;
    return !base?.isfixed && r.baseconstraintid;
  });
  const adHocRules = rules.filter(r => !r.baseconstraintid);
  
  const overrideCount = rules.filter(r => r.isoverride).length;
  
  return (
    <>
      {/* Main modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 p-6 sticky top-0 bg-white z-10">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Planregels voor dit rooster
                </h2>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>
                    <strong>{rules.filter(r => r.actief).length}</strong> actieve regels
                  </span>
                  <span className="text-gray-400">|</span>
                  <span>
                    <strong>{rules.length}</strong> totale regels
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-orange-600">
                    <strong>{overrideCount}</strong> aangepast
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
                title="Sluiten"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
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
                <p className="text-gray-600 mb-4">
                  Nog geen planregels voor dit rooster.
                </p>
                <button
                  onClick={() => setShowAddAdHoc(true)}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  + Eerste regel toevoegen
                </button>
              </div>
            )}
            
            {!loading && !error && rules.length > 0 && (
              <div className="space-y-6">
                {/* Vaste regels */}
                {fixedRules.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span>🔒</span>
                      <span>Vaste regels ({fixedRules.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {fixedRules.map(rule => (
                        <RosterRuleCard
                          key={rule.id}
                          rule={rule}
                          isFixed={true}
                          onEdit={() => setEditingRule(rule)}
                          onReset={() => handleReset(rule)}
                          onDelete={() => handleDelete(rule)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actieve regels */}
                {activeRules.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span>✅</span>
                      <span>Actieve regels ({activeRules.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {activeRules.map(rule => {
                        const base = rule.baseconstraintid ? baseConstraints.get(rule.baseconstraintid) : null;
                        return (
                          <RosterRuleCard
                            key={rule.id}
                            rule={rule}
                            isFixed={false}
                            onEdit={() => setEditingRule(rule)}
                            onReset={() => handleReset(rule)}
                            onDelete={() => handleDelete(rule)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Ad-hoc regels */}
                {adHocRules.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span>🟣</span>
                      <span>Periode-specifieke regels ({adHocRules.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {adHocRules.map(rule => (
                        <RosterRuleCard
                          key={rule.id}
                          rule={rule}
                          isFixed={false}
                          onEdit={() => setEditingRule(rule)}
                          onReset={() => handleReset(rule)}
                          onDelete={() => handleDelete(rule)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t border-gray-200 p-6 flex justify-between items-center sticky bottom-0 bg-white">
            <button
              onClick={() => setShowAddAdHoc(true)}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              + Ad-hoc regel toevoegen
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Sluiten
            </button>
          </div>
        </div>
      </div>
      
      {/* Nested modals */}
      {editingRule && (
        <OverrideEditor
          rule={editingRule}
          originalParameters={
            editingRule.baseconstraintid
              ? baseConstraints.get(editingRule.baseconstraintid)?.parameters
              : null
          }
          onSave={handleSaveEdit}
          onCancel={() => setEditingRule(null)}
        />
      )}
      
      {showAddAdHoc && (
        <AddAdHocRuleForm
          rosterId={rosterId}
          onAdd={handleAddAdHoc}
          onCancel={() => setShowAddAdHoc(false)}
        />
      )}
      
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[70]">
          <div className={`rounded-lg p-4 shadow-lg ${
            toastType === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {toastType === 'success' ? '✓' : '✗'}
              </span>
              <span className="font-medium">{toastMessage}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
