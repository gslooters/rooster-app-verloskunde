'use client';
import { useState, useEffect } from 'react';
import { getAllEmployees, createEmployee, updateEmployee, canDeleteEmployee, removeEmployee } from '@/lib/services/employees-storage';
import { 
  Employee, 
  DienstverbandType,
  TeamType,
  DagblokType,
  StructureelNBH,
  getFullName, 
  getRosterDisplayName,
  getStructureelNBHDescription,
  convertRoostervrijdagenToNBH,
  DAGEN_VAN_WEEK,
  DAGBLOKKEN,
  DIENSTVERBAND_OPTIONS,
  TEAM_OPTIONS,
  validateAantalWerkdagen,
  validateRoostervrijDagen,
  normalizeRoostervrijDagen
} from '@/lib/types/employee';

export default function MedewerkersPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState({ 
    voornaam: '', 
    achternaam: '', 
    email: '', 
    telefoon: '', 
    actief: true,
    dienstverband: DienstverbandType.LOONDIENST,
    team: TeamType.OVERIG,
    aantalWerkdagen: 24,
    roostervrijDagen: [] as string[], // LEGACY (behouden voor backward compatibility)
    structureel_nbh: undefined as StructureelNBH | undefined // NIEUW AP41
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    try {
      // FIX: getAllEmployees is synchronous, not async
      const allEmployees = getAllEmployees();
      setEmployees(allEmployees);
    } catch (err) { 
      console.error('Error loading data:', err); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const openEmployeeModal = (employee?: Employee) => {
    if (employee) { 
      setEditingEmployee(employee);
      
      // AP41: Converteer oude roostervrijdagen naar structureel_nbh indien nodig
      let structureelNBH = employee.structureel_nbh;
      if (!structureelNBH && employee.roostervrijDagen && employee.roostervrijDagen.length > 0) {
        // Automatische migratie: hele dag vrij = alle dagblokken
        structureelNBH = convertRoostervrijdagenToNBH(employee.roostervrijDagen);
      }
      
      setEmployeeFormData({ 
        voornaam: employee.voornaam,
        achternaam: employee.achternaam,
        email: employee.email || '',
        telefoon: employee.telefoon || '',
        actief: employee.actief,
        dienstverband: employee.dienstverband,
        team: employee.team,
        aantalWerkdagen: employee.aantalWerkdagen,
        roostervrijDagen: [...employee.roostervrijDagen], // LEGACY
        structureel_nbh: structureelNBH // NIEUW
      }); 
    } else { 
      setEditingEmployee(null); 
      setEmployeeFormData({ 
        voornaam: '', 
        achternaam: '', 
        email: '', 
        telefoon: '', 
        actief: true,
        dienstverband: DienstverbandType.LOONDIENST,
        team: TeamType.OVERIG,
        aantalWerkdagen: 24,
        roostervrijDagen: [],
        structureel_nbh: undefined
      }); 
    }
    setError(''); 
    setShowEmployeeModal(true);
  };
  
  const closeEmployeeModal = () => { 
    setShowEmployeeModal(false); 
    setEditingEmployee(null); 
    setError(''); 
  };

  // AP41: Nieuwe handler voor dagblok toggle
  const handleDagblokToggle = (dagCode: string, dagblok: DagblokType, checked: boolean) => {
    // FIX: Expliciete null-check voordat we spreaden (TypeScript error opgelost)
    const current = employeeFormData.structureel_nbh ? { ...employeeFormData.structureel_nbh } : {};
    const dagLower = dagCode.toLowerCase();
    
    if (!current[dagLower]) {
      current[dagLower] = [];
    }
    
    if (checked) {
      // Voeg dagblok toe
      if (!current[dagLower].includes(dagblok)) {
        current[dagLower] = [...current[dagLower], dagblok].sort();
      }
    } else {
      // Verwijder dagblok
      current[dagLower] = current[dagLower].filter(b => b !== dagblok);
      
      // Als geen blokken meer: verwijder dag
      if (current[dagLower].length === 0) {
        delete current[dagLower];
      }
    }
    
    setEmployeeFormData({
      ...employeeFormData,
      structureel_nbh: Object.keys(current).length > 0 ? current : undefined
    });
  };

  const handleEmployeeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); 
    setError('');
    
    try {
      if (!validateAantalWerkdagen(employeeFormData.aantalWerkdagen)) {
        throw new Error('Aantal werkdagen moet tussen 0 en 35 zijn');
      }
      if (!validateRoostervrijDagen(employeeFormData.roostervrijDagen)) {
        throw new Error('Ongeldige roostervrije dagen geselecteerd');
      }
      const formData = {
        ...employeeFormData,
        roostervrijDagen: normalizeRoostervrijDagen(employeeFormData.roostervrijDagen)
      };
      if (editingEmployee) {
        updateEmployee(editingEmployee.id, formData); 
      } else {
        createEmployee(formData); 
      }
      // Direct scherm verversen na create/update
      loadData(); 
      closeEmployeeModal(); 
    } catch (err: any) { 
      setError(err.message || 'Er is een fout opgetreden'); 
    }
  };

  const handleEmployeeDelete = async (employee: Employee) => {
    if (!confirm(`Weet je zeker dat je medewerker "${getFullName(employee)}" wilt verwijderen?`)) return;
    
    try { 
      // Async check of medewerker verwijderd kan worden
      const check = await canDeleteEmployee(employee.id); 
      
      if (!check.canDelete) { 
        // Blokkade: Toon alert met details
        let message = `❌ Kan medewerker niet verwijderen.\n\n${check.reason || 'Medewerker staat in actieve roosters.'}\n\n`;
        
        if (check.roosters && check.roosters.length > 0) {
          message += `Betrokken roosters:\n${check.roosters.map(r => `• ${r}`).join('\n')}\n\n`;
        }
        
        message += `💡 Suggestie: Maak de medewerker inactief in plaats van verwijderen. Dan blijven historische roosters intact.`;
        
        alert(message);
        return; 
      } 
      
      // Verwijderen toegestaan
      removeEmployee(employee.id); 
      
      // Direct scherm verversen na delete
      loadData(); 
    } catch (err: any) { 
      alert(err.message || 'Er is een fout opgetreden bij het verwijderen'); 
    }
  };

  const handleRoostervrijDagChange = (dagCode: string, checked: boolean) => {
    const current = employeeFormData.roostervrijDagen;
    if (checked) {
      if (!current.includes(dagCode)) {
        setEmployeeFormData({
          ...employeeFormData,
          roostervrijDagen: [...current, dagCode]
        });
      }
    } else {
      setEmployeeFormData({
        ...employeeFormData,
        roostervrijDagen: current.filter(d => d !== dagCode)
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Medewerkers laden...</p>
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
              <a href="/dashboard" className="text-blue-600 hover:text-blue-800 flex items-center mr-4">
                <span className="mr-1">←</span>
                Dashboard
              </a>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
                  <span className="text-2xl mr-3">👥</span>
                  Medewerkers Beheren
                </h1>
                <p className="text-gray-600">Beheer personeelsgegevens en bekijk welke diensten zij kunnen uitvoeren.</p>
              </div>
              <button 
                onClick={() => openEmployeeModal()} 
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                <span className="mr-2">+</span>Nieuwe Medewerker
              </button>
            </div>
          </div>

          {/* Medewerkers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {employees.map((employee) => (
              <div key={employee.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">
                        {employee.voornaam.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{getFullName(employee)}</h3>
                      <div className="text-sm text-gray-500">Voor roosters: {getRosterDisplayName(employee)}</div>
                      
                      {/* Badges */}
                      <div className="flex gap-1 mt-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          employee.team === TeamType.GROEN ? 'bg-green-100 text-green-700' :
                          employee.team === TeamType.ORANJE ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {employee.team}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          {employee.dienstverband}
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-600 mt-1 min-h-[32px]">
                        <div>{employee.aantalWerkdagen} diensten/periode</div>
                        {/* AP41: Toon structurele NBH beschrijving */}
                        <div className="text-xs text-gray-600 mt-1">
                          <strong>Structureel NBH:</strong> {getStructureelNBHDescription(employee.structureel_nbh)}
                        </div>
                      </div>
                      
                      {(employee.email || employee.telefoon) && (
                        <div className="text-xs text-gray-600 mt-1">
                          {employee.email && <div>📧 {employee.email}</div>}
                          {employee.telefoon && <div>📱 {employee.telefoon}</div>}
                        </div>
                      )}
                      
                      <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${
                        employee.actief 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                        {employee.actief ? 'Actief' : 'Inactief'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEmployeeModal(employee)} 
                    className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors text-sm font-medium"
                  >
                    Bewerken
                  </button>
                  <button 
                    onClick={() => handleEmployeeDelete(employee)} 
                    className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Redirect */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
                  <span className="mr-2">🧩</span>
                  Diensten Toewijzing
                </h3>
                <p className="text-blue-700 mb-4">
                  Configureer welke diensten elke medewerker kan uitvoeren. Deze functie is verplaatst naar Diensten Beheren.
                </p>
                <a 
                  href="/services/assignments" 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span className="mr-2">→</span>
                  Ga naar Diensten Toewijzing
                </a>
              </div>
              <div className="hidden md:block">
                <div className="text-6xl opacity-20">🧩</div>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Modal */}
        {showEmployeeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" style={{ maxHeight: '85vh' }}>
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingEmployee ? 'Medewerker Bewerken' : 'Nieuwe Medewerker'}
                </h2>
                <button onClick={closeEmployeeModal} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
              
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
                <div className="p-6">
                  <form onSubmit={handleEmployeeSubmit}>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Voornaam *</label>
                          <input 
                            type="text" 
                            value={employeeFormData.voornaam} 
                            onChange={(e) => setEmployeeFormData({ ...employeeFormData, voornaam: e.target.value })} 
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            placeholder="bijv. Anna" 
                            required 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Achternaam *</label>
                          <input 
                            type="text" 
                            value={employeeFormData.achternaam} 
                            onChange={(e) => setEmployeeFormData({ ...employeeFormData, achternaam: e.target.value })} 
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                            placeholder="bijv. van der Berg" 
                            required 
                          />
                        </div>
                      </div>

                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          id="actief" 
                          checked={employeeFormData.actief} 
                          onChange={(e) => setEmployeeFormData({ ...employeeFormData, actief: e.target.checked })} 
                          className="mr-2" 
                        />
                        <label htmlFor="actief" className="text-sm font-medium text-gray-700">
                          Actief (beschikbaar voor roostering)
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
                        <input 
                          type="email" 
                          value={employeeFormData.email} 
                          onChange={(e) => setEmployeeFormData({ ...employeeFormData, email: e.target.value })} 
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                          placeholder="naam@verloskunde-arnhem.nl" 
                        />
                      </div>

                      {/* Telefoonnummer */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Telefoonnummer:</label>
                        <input 
                          type="tel" 
                          value={employeeFormData.telefoon} 
                          onChange={(e) => setEmployeeFormData({ ...employeeFormData, telefoon: e.target.value })} 
                          className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                          placeholder="+31 6 1234 5678"
                          maxLength={20}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Dienstverband *</label>
                          <select 
                            value={employeeFormData.dienstverband} 
                            onChange={(e) => setEmployeeFormData({ ...employeeFormData, dienstverband: e.target.value as DienstverbandType })} 
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          >
                            {DIENSTVERBAND_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Team *</label>
                          <select 
                            value={employeeFormData.team} 
                            onChange={(e) => setEmployeeFormData({ ...employeeFormData, team: e.target.value as TeamType })} 
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          >
                            {TEAM_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Aantal diensten - TERMINOLOGIE AANGEPAST */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700 flex-1">
                          Basis aantal diensten per periode:
                        </label>
                        <input 
                          type="number" 
                          min="0" 
                          max="35" 
                          value={employeeFormData.aantalWerkdagen} 
                          onChange={(e) => setEmployeeFormData({ ...employeeFormData, aantalWerkdagen: parseInt(e.target.value) || 0 })} 
                          className="w-28 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center" 
                          placeholder="24" 
                          required 
                        />
                        <span className="text-sm text-gray-600">*</span>
                      </div>

                      {/* AP41: Structureel NBH per Dagblok */}
                      <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Structureel Niet Beschikbaar (per dagblok)
                        </label>
                        <div className="text-xs text-gray-500 mb-3">
                          Selecteer per dag welke dagblokken deze medewerker structureel niet beschikbaar is.
                        </div>
                        <div className="space-y-2">
                          {DAGEN_VAN_WEEK.map(dag => (
                            <div key={dag.code} className="flex items-center gap-3 py-1">
                              <span className="w-12 text-sm font-medium text-gray-700">{dag.code.toUpperCase()}</span>
                              <div className="flex gap-4">
                                {DAGBLOKKEN.map(blok => (
                                  <label key={blok.code} className="flex items-center gap-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={employeeFormData.structureel_nbh?.[dag.code]?.includes(blok.code) || false}
                                      onChange={(e) => handleDagblokToggle(dag.code, blok.code, e.target.checked)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-600">
                                      {blok.label} <span className="text-gray-400">({blok.tijden})</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
                        {error}
                      </div>
                    )}
                  </form>
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t bg-gray-50">
                <button 
                  type="button" 
                  onClick={closeEmployeeModal} 
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuleren
                </button>
                <button 
                  type="submit" 
                  onClick={() => handleEmployeeSubmit()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingEmployee ? 'Bijwerken' : 'Aanmaken'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
