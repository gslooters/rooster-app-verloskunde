// AddAdHocRuleForm: Form voor nieuwe ad-hoc regels
// DRAAD95D: Rooster-specifieke Planregels UI Implementatie
// DRAAD103: Stap 3 - Update constraint types lijst (5 verwijderd)
'use client';

import { ConstraintType, TYPE_LABELS } from '@/lib/types/planning-constraint';
import { useState } from 'react';

interface AddAdHocRuleFormProps {
  rosterId: string;
  onAdd: (rule: any) => Promise<void>;
  onCancel: () => void;
}

// DRAAD103: 7 overgebleven constraint types (was 12)
const CONSTRAINT_TYPES: ConstraintType[] = [
  'coverageminimum',
  'employeeservices',
  'preassignments',
  'consecutiverest',
  'blocksnextday',
  'maxserviceperperiod',
  'maxconsecutivework'
];

export default function AddAdHocRuleForm({
  rosterId,
  onAdd,
  onCancel
}: AddAdHocRuleFormProps) {
  const [naam, setNaam] = useState('');
  const [type, setType] = useState<ConstraintType>('consecutiverest');
  const [beschrijving, setBeschrijving] = useState('');
  const [parameters, setParameters] = useState('{\n  \n}');
  const [priority, setPriority] = useState<1 | 2 | 3 | 4>(3);
  const [actief, setActief] = useState(true);
  const [canrelax, setCanrelax] = useState(false);
  const [team, setTeam] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validatie
    if (!naam.trim()) {
      setError('Naam is verplicht');
      return;
    }
    
    // Valideer JSON
    let parsedParameters;
    try {
      parsedParameters = JSON.parse(parameters);
      if (typeof parsedParameters !== 'object' || parsedParameters === null || Array.isArray(parsedParameters)) {
        setError('Parameters moet een JSON object zijn');
        return;
      }
    } catch (err) {
      setError('Ongeldige JSON syntax in parameters');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const newRule = {
        roosterId: rosterId,
        naam: naam.trim(),
        type,
        beschrijving: beschrijving.trim() || undefined,
        parameters: parsedParameters,
        actief,
        priority,
        canrelax,
        team: team || undefined
      };
      
      await onAdd(newRule);
      // onAdd sluit form
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken regel');
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
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                Ad-hoc regel toevoegen
              </h3>
              <p className="text-sm text-gray-600">
                Periode-specifieke regel zonder koppeling naar master planregels
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
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Naam */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Naam <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Bijv: Extra regel voor vakantieperiode"
              required
            />
          </div>
          
          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ConstraintType)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CONSTRAINT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          
          {/* Beschrijving */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Beschrijving
            </label>
            <textarea
              value={beschrijving}
              onChange={(e) => setBeschrijving(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Optionele toelichting bij deze regel"
            />
          </div>
          
          {/* Parameters */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Parameters (JSON) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder='{"max": 5, "period_days": 7}'
              spellCheck={false}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Vul de specifieke parameters voor dit regeltype in JSON formaat
            </p>
          </div>
          
          {/* Grid: Priority, Team, Checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            {/* Team */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Team
              </label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Alle teams</option>
                <option value="groen">Groen</option>
                <option value="oranje">Oranje</option>
                <option value="overig">Overig</option>
              </select>
            </div>
          </div>
          
          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={actief}
                onChange={(e) => setActief(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Actief</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={canrelax}
                onChange={(e) => setCanrelax(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Kan relaxen</span>
            </label>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                <strong>Fout:</strong> {error}
              </p>
            </div>
          )}
          
          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {saving ? 'Toevoegen...' : 'Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
