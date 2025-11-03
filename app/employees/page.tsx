'use client';
import { useState, useEffect } from 'react';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getServicesForEmployee, setServicesForEmployee, getAllEmployeeServiceMappings } from '@/lib/services/medewerker-diensten-storage';
import { getAllEmployees, createEmployee, updateEmployee, canDeleteEmployee, removeEmployee } from '@/lib/services/employees-storage';
import { Dienst } from '@/lib/types/dienst';
import { Employee } from '@/lib/types/employee';

export default function MedewerkersPage() {
  const [services, setServices] = useState<Dienst[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState({ name: '', actief: true });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    try {
      const allServices = getAllServices();
      const allEmployees = getAllEmployees();
      const allMappings = getAllEmployeeServiceMappings();
      setServices(allServices);
      setEmployees(allEmployees);
      setMappings(allMappings);
    } catch (err) { console.error('Error loading data:', err); }
    finally { setIsLoading(false); }
  };

  const openEmployeeModal = (employee?: Employee) => {
    if (employee) { setEditingEmployee(employee); setEmployeeFormData({ name: employee.name, actief: employee.actief }); }
    else { setEditingEmployee(null); setEmployeeFormData({ name: '', actief: true }); }
    setError(''); setShowEmployeeModal(true);
  };
  const closeEmployeeModal = () => { setShowEmployeeModal(false); setEditingEmployee(null); setError(''); };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try { editingEmployee ? updateEmployee(editingEmployee.id, employeeFormData) : createEmployee(employeeFormData); loadData(); closeEmployeeModal(); }
    catch (err: any) { setError(err.message || 'Er is een fout opgetreden'); }
  };

  const handleEmployeeDelete = async (employee: Employee) => {
    if (!confirm(`Weet je zeker dat je medewerker "${employee.name}" wilt verwijderen?`)) return;
    try { const check = canDeleteEmployee(employee.id); if (!check.canDelete) { alert(`Kan deze medewerker niet verwijderen. ${check.reason}`); return; } removeEmployee(employee.id); loadData(); }
    catch (err: any) { alert(err.message || 'Er is een fout opgetreden bij het verwijderen'); }
  };

  const handleServiceToggle = (employeeId: string, serviceCode: string) => {
    const currentServices = mappings[employeeId] || [];
    const newServices = currentServices.includes(serviceCode)
      ? currentServices.filter(code => code !== serviceCode)
      : [...currentServices, serviceCode];
    setServicesForEmployee(employeeId, newServices);
    setMappings(prev => ({ ...prev, [employeeId]: newServices }));
  };

  const getServiceStats = (serviceCode: string) => Object.keys(mappings).filter(empId => mappings[empId]?.includes(serviceCode)).length;

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
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <a href="/dashboard" className="text-blue-600 hover:text-blue-800 flex items-center mr-4"><span className="mr-1">←</span>Dashboard</a>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center"><span className="text-2xl mr-3">👥</span>Medewerkers Beheren</h1>
                <p className="text-gray-600">Beheer medewerkers en configureer welke diensten zij kunnen uitvoeren.</p>
              </div>
              <button onClick={() => openEmployeeModal()} className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"><span className="mr-2">+</span>Nieuwe Medewerker</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => (
              <div key={employee.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-blue-600 font-semibold text-lg">{employee.name.charAt(0).toUpperCase()}</span></div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${employee.actief ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>{employee.actief ? 'Actief' : 'Inactief'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEmployeeModal(employee)} className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium">Bewerken</button>
                  <button onClick={() => handleEmployeeDelete(employee)} className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium">Verwijderen</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center"><span className="text-xl mr-3">🛠️</span>Diensten Toewijzing</h2>
            <p className="text-gray-600">Configureer welke diensten elke medewerker kan uitvoeren voor gerichte roosterplanning.</p>
          </div>

          <div className="mb-8 bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Diensten Overzicht</h3>
            <div className="flex flex-wrap gap-2">
              {services.filter(s => s.actief).map(service => (
                <div key={service.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded border">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: service.kleur }}></div>
                  <span className="text-sm font-medium">{service.code} - {service.naam}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{getServiceStats(service.code)} medewerkers</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Diensten per Medewerker</h3>
            {employees.filter(emp => emp.actief).map((employee) => {
              const employeeServices = mappings[employee.id] || [];
              const isExpanded = expandedEmployee === employee.id;
              return (
                <div key={employee.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedEmployee(isExpanded ? null : employee.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-blue-600 font-semibold">{employee.name.charAt(0)}</span></div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{employee.name}</h4>
                          <p className="text-sm text-gray-600">{employeeServices.length} diensten beschikbaar</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {employeeServices.slice(0, 4).map(code => {
                            const service = services.find(s => s.code === code);
                            return service ? (<div key={code} className="w-6 h-6 rounded text-xs font-bold text-white flex items-center justify-center" style={{ backgroundColor: service.kleur }} title={`${service.code} - ${service.naam}`}>{service.code.toUpperCase()}</div>) : null;
                          })}
                          {employeeServices.length > 4 && (<div className="w-6 h-6 rounded text-xs bg-gray-300 text-gray-700 flex items-center justify-center">+{employeeServices.length - 4}</div>)}
                        </div>
                        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <h4 className="font-medium text-gray-900 mb-3">Beschikbare diensten configureren:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {services.filter(s => s.actief).map(service => (
                          <label key={service.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                            <input type="checkbox" checked={employeeServices.includes(service.code)} onChange={() => handleServiceToggle(employee.id, service.code)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded text-xs font-bold text-white flex items-center justify-center" style={{ backgroundColor: service.kleur }}>{service.code.toUpperCase()}</div>
                              <div><div className="text-sm font-medium text-gray-900">{service.naam}</div><div className="text-xs text-gray-500">{service.beschrijving}</div></div>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg"><p className="text-sm text-blue-700"><strong>Info:</strong> In roosters ziet {employee.name} alleen de aangevinkte diensten in de dropdown.</p></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showEmployeeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">{editingEmployee ? 'Medewerker Bewerken' : 'Nieuwe Medewerker'}</h2>
                <button onClick={closeEmployeeModal} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
              <form onSubmit={handleEmployeeSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Naam</label>
                    <input type="text" value={employeeFormData.name} onChange={(e) => setEmployeeFormData({ ...employeeFormData, name: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Voornaam Achternaam" required />
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="actief" checked={employeeFormData.actief} onChange={(e) => setEmployeeFormData({ ...employeeFormData, actief: e.target.checked })} className="mr-2" />
                    <label htmlFor="actief" className="text-sm font-medium text-gray-700">Actief (beschikbaar voor roostering)</label>
                  </div>
                </div>
                {error && (<div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>)}
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={closeEmployeeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Annuleren</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{editingEmployee ? 'Bijwerken' : 'Aanmaken'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
