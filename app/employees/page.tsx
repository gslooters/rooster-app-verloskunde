'use client';
import { useState, useEffect } from 'react';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getServicesForEmployee, setServicesForEmployee, getAllEmployeeServiceMappings } from '@/lib/services/medewerker-diensten-storage';
import { Dienst } from '@/lib/types/dienst';

interface Employee {
  id: string;
  name: string;
}

const EMPLOYEES: Employee[] = [
  { id: 'emp1', name: 'Anna' },
  { id: 'emp2', name: 'Bram' },
  { id: 'emp3', name: 'Carla' },
  { id: 'emp4', name: 'Daan' },
  { id: 'emp5', name: 'Eva' },
  { id: 'emp6', name: 'Frank' },
  { id: 'emp7', name: 'Greta' },
  { id: 'emp8', name: 'Hans' },
];

export default function MedewerkersPage() {
  const [services, setServices] = useState<Dienst[]>([]);
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const allServices = getAllServices();
      const allMappings = getAllEmployeeServiceMappings();
      setServices(allServices);
      setMappings(allMappings);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleServiceToggle = (employeeId: string, serviceCode: string) => {
    const currentServices = mappings[employeeId] || [];
    let newServices;
    
    if (currentServices.includes(serviceCode)) {
      newServices = currentServices.filter(code => code !== serviceCode);
    } else {
      newServices = [...currentServices, serviceCode];
    }
    
    setServicesForEmployee(employeeId, newServices);
    setMappings(prev => ({ ...prev, [employeeId]: newServices }));
  };

  const getServiceStats = (serviceCode: string) => {
    const count = Object.keys(mappings).filter(empId => 
      mappings[empId]?.includes(serviceCode)
    ).length;
    return count;
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
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <a href="/dashboard" className="text-blue-600 hover:text-blue-800 flex items-center mr-4">
                <span className="mr-1">←</span>
                Dashboard
              </a>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
              <span className="text-2xl mr-3">👥</span>
              Medewerkers Beheren
            </h1>
            <p className="text-gray-600">
              Configureer welke diensten elke medewerker kan uitvoeren voor gerichte roosterplanning.
            </p>
          </div>

          {/* Service Overview */}
          <div className="mb-8 bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Diensten Overzicht</h2>
            <div className="flex flex-wrap gap-2">
              {services.filter(s => s.actief).map(service => (
                <div key={service.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded border">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: service.kleur }}
                  ></div>
                  <span className="text-sm font-medium">{service.code} - {service.naam}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {getServiceStats(service.code)} medewerkers
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Employees List */}
          <div className="space-y-4">
            {EMPLOYEES.map((employee) => {
              const employeeServices = mappings[employee.id] || [];
              const isExpanded = expandedEmployee === employee.id;
              
              return (
                <div key={employee.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedEmployee(isExpanded ? null : employee.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {employee.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
                          <p className="text-sm text-gray-600">
                            {employeeServices.length} diensten beschikbaar
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {employeeServices.slice(0, 4).map(code => {
                            const service = services.find(s => s.code === code);
                            return service ? (
                              <div 
                                key={code}
                                className="w-6 h-6 rounded text-xs font-bold text-white flex items-center justify-center"
                                style={{ backgroundColor: service.kleur }}
                                title={`${service.code} - ${service.naam}`}
                              >
                                {service.code.toUpperCase()}
                              </div>
                            ) : null;
                          })}
                          {employeeServices.length > 4 && (
                            <div className="w-6 h-6 rounded text-xs bg-gray-300 text-gray-700 flex items-center justify-center">
                              +{employeeServices.length - 4}
                            </div>
                          )}
                        </div>
                        <span className={`transform transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}>
                          ▼
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <h4 className="font-medium text-gray-900 mb-3">Beschikbare diensten configureren:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {services.filter(s => s.actief).map(service => (
                          <label 
                            key={service.id}
                            className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={employeeServices.includes(service.code)}
                              onChange={() => handleServiceToggle(employee.id, service.code)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-5 h-5 rounded text-xs font-bold text-white flex items-center justify-center"
                                style={{ backgroundColor: service.kleur }}
                              >
                                {service.code.toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{service.naam}</div>
                                <div className="text-xs text-gray-500">{service.beschrijving}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">
                          <strong>Info:</strong> In roosters ziet {employee.name} alleen de aangevinkte diensten in de dropdown.
                        </p>
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