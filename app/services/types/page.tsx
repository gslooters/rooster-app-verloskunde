'use client';
import { useState, useEffect } from 'react';
import { Dienst, calculateDuration, checkOverlap } from '@/lib/types/dienst';
import { getAllServices, createService, updateService, canDeleteService, removeService } from '@/lib/services/diensten-storage';

export default function ServiceTypesPage() {
  const [diensten, setDiensten] = useState<Dienst[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDienst, setEditingDienst] = useState<Dienst | null>(null);
  const [formData, setFormData] = useState({ 
    code: '', 
    naam: '', 
    beschrijving: '', 
    begintijd: '08:00',
    eindtijd: '16:00',
    kleur: '#3B82F6', 
    dienstwaarde: 1, 
    actief: true 
  });
  const [error, setError] = useState('');
  const [validationWarnings, setValidationWarnings] = useState('');

  useEffect(() => { loadDiensten(); }, []);

  const loadDiensten = () => {
    try { 
      setDiensten(getAllServices()); 
    } catch (err) { 
      console.error('Error loading services:', err); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const openModal = (dienst?: Dienst) => {
    if (dienst) {
      setEditingDienst(dienst);
      setFormData({ 
        code: dienst.code, 
        naam: dienst.naam, 
        beschrijving: dienst.beschrijving, 
        begintijd: dienst.begintijd,
        eindtijd: dienst.eindtijd,
        kleur: dienst.kleur, 
        dienstwaarde: dienst.dienstwaarde ?? 1, 
        actief: dienst.actief 
      });
    } else {
      setEditingDienst(null);
      setFormData({ 
        code: '', 
        naam: '', 
        beschrijving: '', 
        begintijd: '08:00',
        eindtijd: '16:00',
        kleur: '#3B82F6', 
        dienstwaarde: 1, 
        actief: true 
      });
    }
    setError(''); 
    setValidationWarnings('');
    setShowModal(true);
  };

  const closeModal = () => { 
    setShowModal(false); 
    setEditingDienst(null); 
    setError(''); 
    setValidationWarnings('');
  };

  const validateTimes = (begintijd: string, eindtijd: string) => {
    let warnings = '';
    if (begintijd && eindtijd) {
      const duur = calculateDuration(begintijd, eindtijd);
      
      if (duur > 12) {
        warnings = '⚠️ Dienst duurt langer dan 12 uur';
      } else if (duur < 0) {
        warnings = '⚠️ Eindtijd moet na begintijd zijn';
      }
    }
    setValidationWarnings(warnings);
  };

  const handleTimeChange = () => {
    validateTimes(formData.begintijd, formData.eindtijd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setError('');
    
    try {
      if (editingDienst) {
        updateService(editingDienst.id, formData as any);
      } else {
        createService(formData as any);
      }
      loadDiensten(); 
      closeModal();
    } catch (err: any) { 
      setError(err.message || 'Er is een fout opgetreden'); 
    }
  };

  const handleDelete = async (dienst: Dienst) => {
    if (!confirm(`Weet je zeker dat je dienst "${dienst.naam}" wilt verwijderen?`)) return;
    
    try {
      const check = canDeleteService(dienst.code);
      if (!check.canDelete) { 
        alert(`Kan deze dienst niet verwijderen. ${check.reason}`); 
        return; 
      }
      removeService(dienst.code); 
      loadDiensten();
    } catch (err: any) { 
      alert(err.message || 'Er is een fout opgetreden bij het verwijderen'); 
    }
  };

  // Genereer tijdsbalk
  const generateTimeBar = (begintijd: string, eindtijd: string) => {
    if (begintijd === '00:00' && eindtijd === '00:00') {
      return (
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div className="h-full w-0 bg-blue-500 rounded-full"></div>
        </div>
      );
    }
    
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const start = timeToMinutes(begintijd);
    const end = timeToMinutes(eindtijd);
    const totalMinutes = 24 * 60;
    
    let startPercent = (start / totalMinutes) * 100;
    let width = ((end - start) / totalMinutes) * 100;
    
    if (end < start) { // Over middernacht
      width = ((totalMinutes - start + end) / totalMinutes) * 100;
    }
    
    return (
      <div className="w-full h-2 bg-gray-200 rounded-full relative">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full absolute"
          style={{ left: `${startPercent}%`, width: `${Math.max(width, 2)}%` }}
        ></div>
      </div>
    );
  };

  // Controleer overlaps
  const getOverlaps = (dienst: Dienst) => {
    return diensten.filter(d => 
      d.id !== dienst.id && checkOverlap(dienst, d)
    );
  };

  // Export naar PDF
  const exportToPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Diensten Overzicht</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #1a365d; }
          .service { margin-bottom: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; }
          .service-header { font-weight: bold; font-size: 16px; margin-bottom: 8px; }
          .service-time { color: #4a5568; margin: 4px 0; }
          .service-description { color: #718096; font-size: 14px; }
          .system-service { background-color: #f7fafc; }
        </style>
      </head>
      <body>
        <h1>Diensten Overzicht</h1>
        <p>Gegenereerd op: ${new Date().toLocaleDateString('nl-NL')}</p>
        ${diensten.map(dienst => `
          <div class="service ${dienst.system ? 'system-service' : ''}">
            <div class="service-header">
              ${dienst.code} - ${dienst.naam} 
              ${dienst.system ? '(Systeemdienst)' : ''}
              ${dienst.actief ? '' : '(Inactief)'}
            </div>
            <div class="service-time">Tijd: ${dienst.begintijd} - ${dienst.eindtijd} (${dienst.duur}u)</div>
            <div class="service-time">Waarde: ${dienst.dienstwaarde}</div>
            <div class="service-time">Kleur: ${dienst.kleur}</div>
            <div class="service-description">${dienst.beschrijving}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
    
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(printContent);
      newWindow.document.close();
      newWindow.print();
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <a href="/services" className="text-blue-600 hover:text-blue-800 flex items-center mr-4">
                <span className="mr-1">←</span>
                Diensten Beheren
              </a>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 flex items-center">
                  <span className="text-2xl mr-3">⚙️</span>
                  Diensten beheren - Verbeterd
                </h1>
                <p className="text-gray-600">Configureer diensttypes met tijdsinformatie, kleurcodering en validatie.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={exportToPDF} 
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <span className="mr-2">📄</span>PDF Export
                </button>
                <button 
                  onClick={() => openModal()} 
                  className="inline-flex items-center px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span className="mr-2">+</span>Nieuwe Dienst
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-2">
            {diensten.map((dienst) => {
              const overlaps = getOverlaps(dienst);
              return (
                <div key={dienst.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 relative">
                  {overlaps.length > 0 && (
                    <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-semibold">
                      ⚠️ Overlap
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3 mb-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: dienst.kleur }}
                    >
                      {dienst.code.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        {dienst.naam}
                        {dienst.system && (
                          <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs font-medium">
                            SYSTEEM
                          </span>
                        )}
                      </h3>
                      <div className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        dienst.actief 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {dienst.actief ? 'Actief' : 'Inactief'}
                      </div>
                    </div>
                  </div>

                  {/* Tijdsinformatie */}
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-900">
                        {dienst.begintijd} - {dienst.eindtijd}
                      </span>
                      <span className="text-sm bg-blue-200 text-blue-800 px-2 py-1 rounded">
                        {dienst.duur}u
                      </span>
                    </div>
                    {generateTimeBar(dienst.begintijd, dienst.eindtijd)}
                  </div>

                  <p className="text-gray-600 text-sm mb-2 line-clamp-2">{dienst.beschrijving}</p>
                  <div className="text-xs text-gray-500 mb-3">Waarde: {dienst.dienstwaarde}</div>

                  <div className="flex gap-2">
                    {!dienst.system ? (
                      <>
                        <button 
                          onClick={() => openModal(dienst)} 
                          className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors text-sm font-medium"
                        >
                          Bewerken
                        </button>
                        <button 
                          onClick={() => handleDelete(dienst)} 
                          className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
                        >
                          Verwijderen
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-center text-xs text-gray-400 py-2 border border-gray-200 rounded">
                        Systeemdienst - Niet bewerkbaar
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingDienst ? 'Dienst Bewerken' : 'Nieuwe Dienst'}
                  </h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Code (2-3 tekens)</label>
                        <input 
                          type="text" 
                          value={formData.code} 
                          onChange={(e) => setFormData({...formData, code: e.target.value})} 
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                          placeholder="bijv. D, ND" 
                          maxLength={4} 
                          required 
                          disabled={editingDienst?.system}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Naam</label>
                        <input 
                          type="text" 
                          value={formData.naam} 
                          onChange={(e) => setFormData({...formData, naam: e.target.value})} 
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                          placeholder="bijv. Dagdienst" 
                          required 
                          disabled={editingDienst?.system}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Beschrijving</label>
                      <textarea 
                        value={formData.beschrijving} 
                        onChange={(e) => setFormData({...formData, beschrijving: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                        placeholder="Uitleg van de dienst" 
                        rows={2} 
                        disabled={editingDienst?.system}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Begintijd</label>
                        <input 
                          type="time" 
                          value={formData.begintijd} 
                          onChange={(e) => {
                            setFormData({...formData, begintijd: e.target.value});
                            setTimeout(handleTimeChange, 100);
                          }} 
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={editingDienst?.system}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Eindtijd</label>
                        <input 
                          type="time" 
                          value={formData.eindtijd} 
                          onChange={(e) => {
                            setFormData({...formData, eindtijd: e.target.value});
                            setTimeout(handleTimeChange, 100);
                          }} 
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={editingDienst?.system}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Kleur</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="color" 
                            value={formData.kleur} 
                            onChange={(e) => setFormData({...formData, kleur: e.target.value})} 
                            className="w-12 h-12 rounded-lg border border-gray-300" 
                            disabled={editingDienst?.system}
                          />
                          <div 
                            className="w-12 h-12 rounded-lg border border-gray-300 flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: formData.kleur }}
                          >
                            {formData.code.toUpperCase() || 'XX'}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Dienstwaarde (0–6)</label>
                        <input 
                          type="number" 
                          min={0} 
                          max={6} 
                          step={0.5} 
                          value={formData.dienstwaarde} 
                          onChange={(e) => setFormData({...formData, dienstwaarde: parseFloat(e.target.value) || 0})} 
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                          required 
                          disabled={editingDienst?.system}
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        id="actief" 
                        checked={formData.actief} 
                        onChange={(e) => setFormData({...formData, actief: e.target.checked})} 
                        className="mr-2"
                      />
                      <label htmlFor="actief" className="text-sm font-medium text-gray-700">
                        Actief (beschikbaar in roosters)
                      </label>
                    </div>
                  </div>

                  {validationWarnings && (
                    <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 text-yellow-700 rounded-lg text-sm">
                      {validationWarnings}
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button 
                      type="button" 
                      onClick={closeModal} 
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Annuleren
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      disabled={editingDienst?.system}
                    >
                      {editingDienst ? 'Bijwerken' : 'Aanmaken'}
                    </button>
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