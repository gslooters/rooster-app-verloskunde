'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, CheckCircle, X, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

// CRITICAL: Force dynamic rendering - no caching whatsoever
export const dynamic = 'force-dynamic';

// LAZY IMPORT: Delay Supabase import until client-side rendering
// FASE 2: Use getEmployeeServicesOverview + full macro-editor UI
let getEmployeeServicesOverview: any;
let upsertEmployeeService: any;
let getServiceIdByCode: any;

const loadSupabaseModules = async () => {
  if (!getEmployeeServicesOverview) {
    const mod1 = await import('@/lib/services/medewerker-diensten-supabase');
    getEmployeeServicesOverview = mod1.getEmployeeServicesOverview;
    upsertEmployeeService = mod1.upsertEmployeeService;
    getServiceIdByCode = mod1.getServiceIdByCode;
  }
};

interface EmployeeServiceData {
  employeeId: string;
  employeeName: string;
  team: string;
  dienstenWerkdagen: number;  // From employees.aantalwerkdagen
  services: {
    [serviceCode: string]: {
      enabled: boolean;
      count: number;
      dienstwaarde: number;
    };
  };
  totalAantal: number;  // SUM(aantal)
  totalWaarde: number;  // SUM(aantal × dienstwaarde)
  totalCombined: number;  // totalAantal + totalWaarde
}

interface ServiceInfo {
  code: string;
  naam: string;
  dienstwaarde: number;
  kleur: string;
}

interface CellSaveState {
  employeeId: string;
  serviceCode: string;
  status: 'saving' | 'success' | null;
  timestamp?: number;
}

export default function ServiceAssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeServiceData[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cellStates, setCellStates] = useState<Record<string, CellSaveState>>({});
  const [serviceIdMap, setServiceIdMap] = useState<Record<string, string>>({});

  // CACHE-BUST: Date.now() + Railway random trigger
  const CACHE_BUST_NONCE = Date.now();

  useEffect(() => {
    // FASE 2: Always macro-config (global, no rosterId)
    loadData();
  }, []);

  // Cleanup save states after 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCellStates(prev => {
        const updated = { ...prev };
        Object.entries(updated).forEach(([key, state]) => {
          if (state.status && state.timestamp && Date.now() - state.timestamp > 2000) {
            updated[key] = { ...state, status: null };
          }
        });
        return updated;
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      await loadSupabaseModules();
      
      // Load employee services overview (macro-config)
      const overview = await getEmployeeServicesOverview();
      
      if (!overview || overview.length === 0) {
        console.warn('⚠️ No employee services data');
        setEmployees([]);
        setServices([]);
        setLoading(false);
        return;
      }

      // Extract all service codes and build serviceIdMap
      const serviceCodesSet = new Set<string>();
      const serviceInfoMap = new Map<string, ServiceInfo>();
      
      overview.forEach((emp: any) => {
        Object.entries(emp.services || {}).forEach(([code, srvData]: any) => {
          serviceCodesSet.add(code);
          if (!serviceInfoMap.has(code)) {
            serviceInfoMap.set(code, {
              code: code,
              naam: srvData.naam || code,
              dienstwaarde: srvData.dienstwaarde || 1.0,
              kleur: srvData.kleur || '#cccccc'
            });
          }
        });
      });

      // Sort services: DDO, DDA, DIO, DIA, then alphabetical
      const systemServices = ['DDO', 'DDA', 'DIO', 'DIA'];
      const otherServices = Array.from(serviceCodesSet)
        .filter(code => !systemServices.includes(code))
        .sort();
      const sortedServices = [
        ...systemServices.filter(s => serviceCodesSet.has(s)),
        ...otherServices
      ];

      // Build serviceIdMap for future lookups
      const idMap: Record<string, string> = {};
      for (const code of sortedServices) {
        const id = await getServiceIdByCode(code);
        if (id) {
          idMap[code] = id;
        }
      }
      setServiceIdMap(idMap);

      // Transform overview data
      const employeeList = overview.map((emp: any) => {
        let totalAantal = 0;
        let totalWaarde = 0;

        sortedServices.forEach(code => {
          const srvData = emp.services[code];
          if (srvData && srvData.enabled && srvData.count > 0) {
            totalAantal += srvData.count;
            totalWaarde += srvData.count * (srvData.dienstwaarde || 1.0);
          }
        });

        return {
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          team: emp.team,
          dienstenWerkdagen: emp.dienstenperiode,  // From employees.aantalwerkdagen
          services: emp.services,
          totalAantal: totalAantal,
          totalWaarde: totalWaarde,
          totalCombined: totalAantal + totalWaarde
        };
      });

      // Build sorted service list
      const serviceList = sortedServices.map(code => ({
        code: code,
        naam: serviceInfoMap.get(code)?.naam || code,
        dienstwaarde: serviceInfoMap.get(code)?.dienstwaarde || 1.0,
        kleur: serviceInfoMap.get(code)?.kleur || '#cccccc'
      }));

      setEmployees(employeeList);
      setServices(serviceList);
    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      setError(err.message || 'Fout bij laden van gegevens');
    } finally {
      setLoading(false);
    }
  }

  const handleCheckboxChange = async (employeeId: string, serviceCode: string, enabled: boolean) => {
    try {
      const cellKey = `${employeeId}_${serviceCode}`;
      setCellStates(prev => ({
        ...prev,
        [cellKey]: { employeeId, serviceCode, status: 'saving', timestamp: Date.now() }
      }));

      const serviceId = serviceIdMap[serviceCode];
      if (!serviceId) {
        throw new Error(`Service ID not found for ${serviceCode}`);
      }

      // If unchecking, set aantal=0. If checking, set aantal=1
      const aantal = enabled ? 1 : 0;
      
      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        aantal: aantal,
        actief: enabled
      });

      setCellStates(prev => ({
        ...prev,
        [cellKey]: { employeeId, serviceCode, status: 'success', timestamp: Date.now() }
      }));

      // Reload after delay
      setTimeout(() => loadData(), 300);
    } catch (err: any) {
      console.error('❌ Error toggling checkbox:', err);
      setError(err.message);
      setCellStates(prev => {
        const updated = { ...prev };
        delete updated[`${employeeId}_${serviceCode}`];
        return updated;
      });
    }
  };

  const handleAantalChange = async (employeeId: string, serviceCode: string, delta: number) => {
    try {
      const emp = employees.find(e => e.employeeId === employeeId);
      if (!emp) return;

      const srvData = emp.services[serviceCode];
      const currentAantal = srvData?.count || 0;
      const newAantal = Math.max(0, Math.min(35, currentAantal + delta));

      const cellKey = `${employeeId}_${serviceCode}`;
      setCellStates(prev => ({
        ...prev,
        [cellKey]: { employeeId, serviceCode, status: 'saving', timestamp: Date.now() }
      }));

      const serviceId = serviceIdMap[serviceCode];
      if (!serviceId) {
        throw new Error(`Service ID not found for ${serviceCode}`);
      }

      // If newAantal is 0, auto-uncheck. Otherwise, ensure enabled=true
      const enabled = newAantal > 0;

      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        aantal: newAantal,
        actief: enabled
      });

      setCellStates(prev => ({
        ...prev,
        [cellKey]: { employeeId, serviceCode, status: 'success', timestamp: Date.now() }
      }));

      // Reload after delay
      setTimeout(() => loadData(), 300);
    } catch (err: any) {
      console.error('❌ Error changing aantal:', err);
      setError(err.message);
    }
  };

  const getTeamColor = (team?: string) => {
    switch (team?.toLowerCase()) {
      case 'groen':
        return 'bg-green-500';
      case 'oranje':
        return 'bg-orange-500';
      case 'blauw':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTotalColor = (dienstenWerkdagen: number, totalCombined: number) => {
    if (dienstenWerkdagen === totalCombined) {
      return 'text-green-600 font-bold';
    }
    return 'text-black';
  };

  const CellSaveIndicator = ({ state }: { state?: CellSaveState }) => {
    if (!state?.status) return null;
    
    if (state.status === 'saving') {
      return (
        <div className="absolute right-1 top-1 animate-spin">
          <RefreshCw size={14} className="text-blue-500" />
        </div>
      );
    }
    
    if (state.status === 'success') {
      return (
        <div className="absolute right-1 top-1">
          <CheckCircle size={14} className="text-green-500" />
        </div>
      );
    }
    
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-2" size={32} />
          <p>Laden van dienstengegevens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                🎯 Diensten Medewerkers
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                Beheer macro-config: welke diensten zijn actief voor welke medewerkers
              </p>
              <div className="mt-2 inline-block bg-blue-100 border border-blue-300 rounded px-3 py-1">
                <p className="text-xs text-blue-900">
                  <strong>Modus:</strong> Macro-configuratie global - geldt voor alle roosters
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft size={16} /> Terug
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <X className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Medewerkers Tabel */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Headers */}
          <div className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200">
            <div className="flex gap-px">
              {/* Medewerker kolom header */}
              <div className="w-96 px-4 py-3 font-semibold text-sm text-gray-700 bg-gray-100 border-r">
                Medewerker
              </div>
              
              {/* Diensten headers */}
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-px">
                  {services.map(svc => (
                    <div 
                      key={svc.code}
                      className="w-40 px-2 py-3 font-semibold text-xs text-center text-gray-700 bg-gray-100 border-r whitespace-nowrap"
                    >
                      {svc.code}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Body - Medewerkers */}
          <div className="divide-y divide-gray-200">
            {employees.map((emp, idx) => (
              <div key={emp.employeeId} className="flex gap-px hover:bg-gray-50 transition">
                {/* Medewerker kolom */}
                <div className="w-96 px-4 py-3 border-r border-gray-200 flex items-center gap-3 bg-white">
                  {/* Team button */}
                  <div className={`w-4 h-4 rounded-full ${getTeamColor(emp.team)}`}></div>
                  
                  {/* Medewerker info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{emp.employeeName}</p>
                    <div className="flex gap-4 text-xs text-gray-600 mt-1">
                      <span>Werkdagen: <strong>{emp.dienstenWerkdagen}</strong></span>
                      <span className={getTotalColor(emp.dienstenWerkdagen, emp.totalCombined)}>
                        Totaal: <strong>{emp.totalCombined.toFixed(1)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Diensten cellen */}
                <div className="flex-1 overflow-x-auto">
                  <div className="flex gap-px">
                    {services.map(svc => {
                      const srvData = emp.services[svc.code];
                      const cellKey = `${emp.employeeId}_${svc.code}`;
                      const cellState = cellStates[cellKey];
                      
                      return (
                        <div 
                          key={cellKey}
                          className="w-40 px-2 py-3 border-r border-gray-200 bg-white relative"
                        >
                          {!srvData?.enabled ? (
                            // Unchecked cell
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => handleCheckboxChange(emp.employeeId, svc.code, true)}
                                className="w-5 h-5 cursor-pointer"
                              />
                            </div>
                          ) : (
                            // Checked cell
                            <div className="flex flex-col items-center gap-2">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => handleCheckboxChange(emp.employeeId, svc.code, false)}
                                className="w-5 h-5 cursor-pointer"
                              />
                              {srvData.count > 0 && (
                                <div className="flex items-center gap-1 text-xs">
                                  <button
                                    onClick={() => handleAantalChange(emp.employeeId, svc.code, -1)}
                                    className="px-1 py-0 hover:bg-gray-200 rounded transition"
                                    disabled={cellState?.status === 'saving'}
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="w-4 text-center font-semibold">
                                    {srvData.count}
                                  </span>
                                  <button
                                    onClick={() => handleAantalChange(emp.employeeId, svc.code, 1)}
                                    className="px-1 py-0 hover:bg-gray-200 rounded transition"
                                    disabled={cellState?.status === 'saving'}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              )}
                              <span className="text-xs text-gray-500">
                                waarde: {svc.dienstwaarde}
                              </span>
                            </div>
                          )}
                          <CellSaveIndicator state={cellState} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cache bust indicator */}
        <div className="mt-4 text-xs text-gray-500 text-center">
          Last updated: {new Date(CACHE_BUST_NONCE).toLocaleTimeString('nl-NL')}
        </div>
      </div>
    </div>
  );
}