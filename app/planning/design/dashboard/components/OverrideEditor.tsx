// OverrideEditor: Nested modal voor parameter wijzigingen
// DRAAD95D: Rooster-specifieke Planregels UI Implementatie
// DRAAD96A-fix: Property name mismatch - canrelax → can_relax, isoverride → is_override
'use client';

import { RosterPlanningConstraint } from '@/lib/types/planning-constraint';
import { useState, useEffect } from 'react';
import { TYPE_LABELS, PRIORITY_COLORS } from '@/lib/types/planning-constraint';

interface OverrideEditorProps {
  rule: RosterPlanningConstraint;
  originalParameters?: Record<string, any> | null;
  onSave: (updates: Partial<RosterPlanningConstraint>) => Promise<void>;
  onCancel: () => void;
}

export default function OverrideEditor({
  rule,
  originalParameters,
  onSave,
  onCancel
}: OverrideEditorProps) {
  const [parameters, setParameters] = useState(JSON.stringify(rule.parameters, null, 2));
  const [actief, setActief] = useState(rule.actief);
  const [priority, setPriority] = useState(rule.priority);
  const [can_relax, setCanRelax] = useState(rule.can_relax);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    // Reset bij rule wijziging
    setParameters(JSON.stringify(rule.parameters, null, 2));
    setActief(rule.actief);
    setPriority(rule.priority);
    setCanRelax(rule.can_relax);
    setError(null);
  }, [rule]);
  
  async function handleSave() {
    // Valideer JSON
    try {
      const parsed = JSON.parse(parameters);
      
      // Check of het een object is
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError('Parameters moet een JSON object zijn');
        return;
      }
      
      setSaving(true);
      setError(null);
      
      await onSave({
        parameters: parsed,
        actief,
        priority,
        can_relax
      });
      
      // onSave sluit modal
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Ongeldige JSON syntax');
      } else {
        setError(err instanceof Error ? err.message : 'Fout bij opslaan');
      }
    } finally {
      setSaving(false);
    }
  }
  
  const priorityLabels = {
    1: 'Kritiek',
    2: 'Hoog',
    3: 'Normaal',
    4: 'Laag'
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{rule.naam}</h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{TYPE_LABELS[rule.type]}</span>
                {rule.beschrijving && ` • ${rule.beschrijving}`}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              title="Sluiten"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Parameters editor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Parameters (JSON)
            </label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Huidige parameters */}
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {rule.is_override ? 'Aangepaste waarden:' : 'Nieuwe waarden:'}
                </div>
                <textarea
                  value={parameters}
                  onChange={(e) => setParameters(e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder='{"key": "value"}'
                  spellCheck={false}
                />
              </div>
              
              {/* Originele parameters (indien override) */}
              {originalParameters && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    Originele waarden:
                  </div>
                  <div className="w-full h-64 p-3 border border-gray-200 bg-gray-50 rounded-lg font-mono text-sm overflow-auto">
                    <pre className="text-gray-600">
                      {JSON.stringify(originalParameters, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Overige instellingen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Actief */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Actief
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={actief}
                  onChange={(e) => setActief(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {actief ? 'Regel is actief' : 'Regel is inactief'}
                </span>
              </label>
            </div>
            
            {/* Priority */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Prioriteit
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3 | 4)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {([1, 2, 3, 4] as const).map((p) => (
                  <option key={p} value={p}>
                    P{p} - {priorityLabels[p]}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Can relax */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Kan relaxen
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={can_relax}
                  onChange={(e) => setCanRelax(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {can_relax ? 'Kan relaxen' : 'Harde eis'}
                </span>
              </label>
            </div>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                <strong>Fout:</strong> {error}
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}
