'use client';
import { useState, useEffect } from 'react';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { getServicesForEmployee, setServicesForEmployee } from '@/lib/services/medewerker-diensten-storage';
import { Dienst } from '@/lib/types/dienst';
import { Employee, getFullName } from '@/lib/types/employee';

export default function ServiceAssignmentsPage() {
  const [diensten, setDiensten] = useState<Dienst[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const ds = getAllServices().filter(s => s.actief);
      const emps = getAllEmployees().filter(e => e.actief);
      setDiensten(ds);
      setEmployees(emps);
      const map: Record<string, string[]> = {};
      emps.forEach(e => { map[e.id] = getServicesForEmployee(e.id) || []; });
      setMappings(map);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function toggleService(empId: string, code: string) {
    const cur = mappings[empId] || [];
    const next = cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code];
    setServicesForEmployee(empId, next);
    setMappings(prev => ({ ...prev, [empId]: next }));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Toewijzingen laden...</p>
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
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
              <span className="text-2xl mr-3">🧩</span>
              Diensten Toewijzing
            </h1>
            <p className="text-gray-600">Koppel voor elke medewerker welke diensten toegestaan zijn. Dit bepaalt de keuzes in het rooster.</p>
          </div>

          {/* Overzicht diensten */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Diensten Overzicht</h3>
            <div className="flex flex-wrap gap-2">
              {diensten.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded border">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.kleur }}></div>
                  <span className="text-sm font-medium">{s.code} - {s.naam}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lijst medewerkers */}
          <div className="space-y-4">
            {employees.map(emp => {
              const list = mappings[emp.id] || [];
              const isExp = expanded === emp.id;
              return (
                <div key={emp.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between" onClick={() => setExpanded(isExp ? null : emp.id)}>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{getFullName(emp)}</div>
                      <div className="text-sm text-gray-500">{list.length} diensten gekoppeld</div>
                    </div>
                    <span className={`transform transition-transform ${isExp ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                  {isExp && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {diensten.map(s => (
                          <label key={s.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={list.includes(s.code)} onChange={() => toggleService(emp.id, s.code)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded text-xs font-bold text-white flex items-center justify-center" style={{ backgroundColor: s.kleur }}>{s.code.toUpperCase()}</div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{s.naam}</div>
                                <div className="text-xs text-gray-500">{s.beschrijving}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                        De geselecteerde diensten verschijnen als keuzes voor {emp.voornaam} in het rooster.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
