'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RefreshCw, CheckCircle, X, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

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
  aantalWerkdagen: number;
  services: {
    [serviceCode: string]: {
      enabled: boolean;
      count: number;
      dienstwaarde: number;
    };
  };
  totalPeriodeWaarde: number;
}

interface ServiceInfo {
  code: string;
  dienstwaarde: number;
  kleur: string;
}

interface TeamTotals {
  [team: string]: {
    [serviceCode: string]: number;
  };
}

export default function ServiceAssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeServiceData[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cellStates, setCellStates] = useState<Record<string, any>>({});
  const [serviceIdMap, setServiceIdMap] = useState<Record<string, string>>({});
  const [teamTotals, setTeamTotals] = useState<TeamTotals>({});

  const CACHE_BUST_NONCE = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    loadData();
  }, []);

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
      const overview = await getEmployeeServicesOverview();
      
      if (!overview || overview.length === 0) {
        setEmployees([]);
        setServices([]);
        setLoading(false);
        return;
      }

      // Extract services
      const serviceCodesSet = new Set<string>();
      const serviceInfoMap = new Map<string, ServiceInfo>();
      
      overview.forEach((emp: EmployeeServiceData) => {
        Object.entries(emp.services || {}).forEach(([code, srvData]: any) => {
          serviceCodesSet.add(code);
          if (!serviceInfoMap.has(code)) {
            serviceInfoMap.set(code, {
              code: code,
              dienstwaarde: srvData.dienstwaarde || 1.0,
              kleur: srvData.kleur || '#cccccc'
            });
          }
        });
      });

      const systemServices = ['DDO', 'DDA', 'DIO', 'DIA'];
      const otherServices = Array.from(serviceCodesSet)
        .filter(code => !systemServices.includes(code))
        .sort();
      const sortedServices = [
        ...systemServices.filter(s => serviceCodesSet.has(s)),
        ...otherServices
      ];

      // Build serviceIdMap
      const idMap: Record<string, string> = {};
      for (const code of sortedServices) {
        const id = await getServiceIdByCode(code);
        if (id) idMap[code] = id;
      }
      setServiceIdMap(idMap);

      // Transform data
      const employeeList = overview.map((emp: EmployeeServiceData) => {
        let totalPeriodeWaarde = 0;

        sortedServices.forEach(code => {
          const srvData = emp.services[code];
          if (srvData && srvData.enabled && srvData.count > 0) {
            totalPeriodeWaarde += srvData.count * (srvData.dienstwaarde || 1.0);
          }
        });

        return {
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          team: emp.team,
          aantalWerkdagen: emp.aantalWerkdagen,
          services: emp.services,
          totalPeriodeWaarde: Math.round(totalPeriodeWaarde * 10) / 10
        };
      });

      // Calculate team totals (simple count, no weighting)
      const totals: TeamTotals = {};
      employeeList.forEach((emp: EmployeeServiceData) => {
        if (!totals[emp.team]) {
          totals[emp.team] = {};
        }
        sortedServices.forEach(code => {
          const srvData = emp.services[code];
          if (!totals[emp.team][code]) {
            totals[emp.team][code] = 0;
          }
          if (srvData && srvData.enabled) {
            totals[emp.team][code] += srvData.count;
          }
        });
      });

      const serviceList = sortedServices.map(code => ({
        code: code,
        dienstwaarde: serviceInfoMap.get(code)?.dienstwaarde || 1.0,
        kleur: serviceInfoMap.get(code)?.kleur || '#cccccc'
      }));

      setEmployees(employeeList);
      setServices(serviceList);
      setTeamTotals(totals);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Fout bij laden');
    } finally {
      setLoading(false);
    }
  }

  const handleCheckboxChange = async (employeeId: string, serviceCode: string, enabled: boolean) => {
    try {
      const cellKey = `${employeeId}_${serviceCode}`;
      setCellStates(prev => ({
        ...prev,
        [cellKey]: { status: 'saving', timestamp: Date.now() }
      }));

      const serviceId = serviceIdMap[serviceCode];
      if (!serviceId) throw new Error(`Service ID not found for ${serviceCode}`);

      const aantal = enabled ? 1 : 0;
      
      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        aantal: aantal,
        actief: enabled
      });

      setCellStates(prev => ({
        ...prev,
        [cellKey]: { status: 'success', timestamp: Date.now() }
      }));

      setTimeout(() => loadData(), 300);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
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
        [cellKey]: { status: 'saving', timestamp: Date.now() }
      }));

      const serviceId = serviceIdMap[serviceCode];
      if (!serviceId) throw new Error(`Service ID not found for ${serviceCode}`);

      const enabled = newAantal > 0;

      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        aantal: newAantal,
        actief: enabled
      });

      setCellStates(prev => ({
        ...prev,
        [cellKey]: { status: 'success', timestamp: Date.now() }
      }));

      setTimeout(() => loadData(), 300);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    }
  };

  const getTeamColor = (team?: string) => {
    if (!team) return 'bg-gray-400';
    const t = team.toLowerCase();
    if (t === 'groen') return 'bg-green-500';
    if (t === 'oranje') return 'bg-orange-500';
    if (t === 'blauw') return 'bg-blue-500';
    return 'bg-gray-400';
  };

  const getPdColor = (wd: number, pd: number) => {
    if (pd === wd) return 'text-green-600 font-bold';
    if (pd < wd) return 'text-red-600 font-bold';
    return 'text-black';
  };

  const CellSaveIndicator = ({ state }: { state?: any }) => {
    if (!state?.status) return null;
    if (state.status === 'saving') {
      return <RefreshCw size={12} className="text-blue-500 animate-spin" />;
    }
    if (state.status === 'success') {
      return <CheckCircle size={12} className="text-green-500" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-2" size={32} />
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  const SERVICE_CELL_WIDTH = 'w-16';
  const HEADER_WD = 'w-12';
  const HEADER_PD = 'w-14';
  const HEADER_NAME = 'w-32';

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎯 Diensten Medewerkers</h1>
          <p className="text-sm text-gray-600">Macro-configuratie: globale diensten-toewijzingen</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft size={16} /> Terug
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <X className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="bg-white rounded border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {/* HEADER */}
          <thead className="sticky top-0 z-20 bg-gray-200 border-b-2 border-gray-300">
            <tr>
              <th className={`${HEADER_NAME} px-2 py-2 text-left font-semibold text-gray-900`}>
                Medewerker
              </th>
              <th className={`${HEADER_WD} px-1 py-2 text-center font-semibold text-gray-900`}>
                Wd
              </th>
              <th className={`${HEADER_PD} px-1 py-2 text-center font-semibold text-gray-900`}>
                Pd
              </th>
              {services.map(svc => (
                <th
                  key={svc.code}
                  className={`${SERVICE_CELL_WIDTH} px-1 py-2 text-center font-semibold text-gray-700 bg-gray-100 border-l border-gray-300`}
                >
                  <div className="text-xs font-bold">{svc.code}</div>
                  <div className="text-xs text-gray-600">{svc.dienstwaarde}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.employeeId} className="border-b border-gray-200 hover:bg-gray-50">
                {/* Medewerker */}
                <td className={`${HEADER_NAME} px-2 py-2 text-left`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getTeamColor(emp.team)}`}></div>
                    <span className="font-medium text-gray-900">{emp.employeeName}</span>
                  </div>
                </td>

                {/* Wd (Werkdagen) */}
                <td className={`${HEADER_WD} px-1 py-2 text-center font-bold text-gray-900`}>
                  {emp.aantalWerkdagen}
                </td>

                {/* Pd (Periode Waarde) */}
                <td className={`${HEADER_PD} px-1 py-2 text-center ${getPdColor(emp.aantalWerkdagen, emp.totalPeriodeWaarde)}`}>
                  {emp.totalPeriodeWaarde}
                </td>

                {/* Diensten */}
                {services.map(svc => {
                  const srvData = emp.services[svc.code];
                  const cellKey = `${emp.employeeId}_${svc.code}`;
                  const cellState = cellStates[cellKey];

                  return (
                    <td
                      key={cellKey}
                      className={`${SERVICE_CELL_WIDTH} px-1 py-2 text-center border-l border-gray-300`}
                    >
                      {!srvData?.enabled ? (
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleCheckboxChange(emp.employeeId, svc.code, true)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => handleCheckboxChange(emp.employeeId, svc.code, false)}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleAantalChange(emp.employeeId, svc.code, -1)}
                              className="px-0.5 hover:bg-gray-200 rounded text-xs disabled:opacity-50"
                              disabled={cellState?.status === 'saving'}
                            >
                              <Minus size={10} />
                            </button>
                            <span className="w-3 text-center text-xs font-bold">
                              {srvData.count}
                            </span>
                            <button
                              onClick={() => handleAantalChange(emp.employeeId, svc.code, 1)}
                              className="px-0.5 hover:bg-gray-200 rounded text-xs disabled:opacity-50"
                              disabled={cellState?.status === 'saving'}
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-blue-500 mt-0.5">
                        <CellSaveIndicator state={cellState} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* FOOTER: Team Totals */}
            {Object.entries(teamTotals).map(([team, totals]) => (
              <tr key={`total_${team}`} className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                <td className={`${HEADER_NAME} px-2 py-2 text-left text-gray-900`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getTeamColor(team)}`}></div>
                    <span>{team === 'praktijk' || team === 'Praktijk' ? '📊 Totaal' : team}</span>
                  </div>
                </td>
                <td className={`${HEADER_WD} px-1 py-2 text-center`}></td>
                <td className={`${HEADER_PD} px-1 py-2 text-center`}></td>
                {services.map(svc => (
                  <td
                    key={`total_${team}_${svc.code}`}
                    className={`${SERVICE_CELL_WIDTH} px-1 py-2 text-center border-l border-gray-300`}
                  >
                    <span className="font-bold">{totals[svc.code] || 0}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Cache: {CACHE_BUST_NONCE}
      </div>
    </div>
  );
}