'use client';
import { useState, useEffect } from 'react';
import { Dienst } from '@/lib/types/dienst';
import { getAllServices, createService, updateService, canDeleteService, removeService } from '@/lib/services/diensten-storage';

export default function ServiceTypesPage() {
  const [diensten, setDiensten] = useState<Dienst[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDienst, setEditingDienst] = useState<Dienst | null>(null);
  const [formData, setFormData] = useState({ code: '', naam: '', beschrijving: '', kleur: '#3B82F6', dienstwaarde: 1, actief: true });
  const [error, setError] = useState('');

  useEffect(() => { loadDiensten(); }, []);

  const loadDiensten = () => {
    try { setDiensten(getAllServices()); } catch (err) { console.error('Error loading services:', err); } finally { setIsLoading(false); }
  };

  const openModal = (dienst?: Dienst) => {
    if (dienst) {
      setEditingDienst(dienst);
      setFormData({ code: dienst.code, naam: dienst.naam, beschrijving: dienst.beschrijving, kleur: dienst.kleur, dienstwaarde: dienst.dienstwaarde ?? 1, actief: dienst.actief });
    } else {
      setEditingDienst(null);
      setFormData({ code: '', naam: '', beschrijving: '', kleur: '#3B82F6', dienstwaarde: 1, actief: true });
    }
    setError(''); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingDienst(null); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      if (editingDienst) {
        updateService(editingDienst.id, formData as any);
      } else {
        createService(formData as any);
      }
      loadDiensten(); closeModal();
    } catch (err: any) { setError(err.message || 'Er is een fout opgetreden'); }
  };

  const handleDelete = async (dienst: Dienst) => {
    if (!confirm(`Weet je zeker dat je dienst "${dienst.naam}" wilt verwijderen?`)) return;
    try {
      const check = canDeleteService(dienst.code);
      if (!check.canDelete) { alert(`Kan deze dienst niet verwijderen. ${check.reason}`); return; }
      removeService(dienst.code); loadDiensten();
    } catch (err: any) { alert(err.message || 'Er is een fout opgetreden bij het verwijderen'); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Diensten laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <a href="/services" className="text-blue-600 hover:text-blue-800 flex items-center mr-4">
                <span className="mr-1">←</span>
                Diensten Beheren
              </a>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
                  <span className="text-2xl mr-3">⚙️</span>
                  Diensten beheren
                </h1>
                <p className="text-gray-600">Configureer diensttypes, kleurcodering en tijdsloten voor roosterplanning.</p>
              </div>
              <button onClick={() => openModal()} className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg">
                <span className="mr-2">+</span>Nieuwe Dienst
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {diensten.map((dienst) => (
              <div key={dienst.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow min-h-[220px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: dienst.kleur }}>
                      {dienst.code.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        {dienst.naam}
                        {dienst.code === 'NB' && (<span className="px-2 py-0.5 rounded bg-yellow-200 text-red-700 font-semibold text-xs">NB</span>)}
                        {dienst.code === '=' && (<span className="px-2 py-0.5 rounded text-black text-xs" style={{ backgroundColor: dienst.kleur }}>=</span>)}
                      </h3>
                      <div className={`px-2 py-1 text-xs font-medium rounded-full inline-block ${dienst.actief ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                        {dienst.actief ? 'Actief' : 'Inactief'}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-2">{dienst.beschrijving}</p>
                <div className="text-xs text-gray-600 mb-4">Waarde: {dienst.dienstwaarde?.toFixed(1) ?? '—'}</div>
                <div className="mt-auto flex gap-2">
                  {(dienst.code !== 'NB' && dienst.code !== '=') ? (
                    <>
                      <button onClick={() => openModal(dienst)} className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors text-sm font-medium">Bewerken</button>
                      <button onClick={() => handleDelete(dienst)} className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium">Verwijderen</button>
                    </>
                  ) : (
                    <div className="w-full text-center text-xs text-gray-400 py-2 border border-gray-200 rounded">Systeemdienst</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">{editingDienst ? 'Dienst Bewerken' : 'Nieuwe Dienst'}</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Code (2-3 tekens)</label>
                      <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="bijv. D, ND" maxLength={4} required disabled={editingDienst?.code === 'NB' || editingDienst?.code === '='}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Naam</label>
                      <input type="text" value={formData.naam} onChange={(e) => setFormData({...formData, naam: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="bijv. Dagdienst" required disabled={editingDienst?.code === 'NB' || editingDienst?.code === '='}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Beschrijving</label>
                      <textarea value={formData.beschrijving} onChange={(e) => setFormData({...formData, beschrijving: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Uitleg van de dienst" rows={3} disabled={editingDienst?.code === 'NB' || editingDienst?.code === '='}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Kleur</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={formData.kleur} onChange={(e) => setFormData({...formData, kleur: e.target.value})} className="w-12 h-12 rounded-lg border border-gray-300" disabled={editingDienst?.code === 'NB' || editingDienst?.code === '='}/>
                        <div className="w-12 h-12 rounded-lg border border-gray-300 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: formData.kleur }}>{formData.code.toUpperCase()}</div>
                        <span className="text-sm text-gray-600">{formData.kleur}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dienstwaarde (0–6, stap 0,5)</label>
                      <input type="number" min={0} max={6} step={0.5} value={formData.dienstwaarde} onChange={(e) => setFormData({...formData, dienstwaarde: parseFloat(e.target.value)})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="1.0" required disabled={editingDienst?.code === 'NB' || editingDienst?.code === '='}/>
                    </div>
                    <div className="flex items-center">
                      <input type="checkbox" id="actief" checked={formData.actief} onChange={(e) => setFormData({...formData, actief: e.target.checked})} className="mr-2"/>
                      <label htmlFor="actief" className="text-sm font-medium text-gray-700">Actief (beschikbaar in roosters)</label>
                    </div>
                  </div>

                  {error && (<div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>)}

                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Annuleren</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{editingDienst ? 'Bijwerken' : 'Aanmaken'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
