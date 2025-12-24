'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RefreshCw, CheckCircle, X } from 'lucide-react';
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

  const CACHE_BUST_NONCE = `draad349e_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      
      // Optimistic update - update local state immediately
      setEmployees(prev => prev.map(e => {
        if (e.employeeId !== employeeId) return e;
        
        const newServices = { ...e.services };
        newServices[serviceCode] = {
          ...newServices[serviceCode],
          enabled: enabled,
          count: enabled ? (newServices[serviceCode]?.count || 1) : 0
        };
        
        let newTotalPeriodeWaarde = 0;
        Object.entries(newServices).forEach(([code, srv]: any) => {
          if (srv?.enabled && srv?.count > 0) {
            newTotalPeriodeWaarde += srv.count * (srv.dienstwaarde || 1.0);
          }
        });
        
        return {
          ...e,
          services: newServices,
          totalPeriodeWaarde: Math.round(newTotalPeriodeWaarde * 10) / 10
        };
      }));

      // Update team totals optimistically
      setTeamTotals(prev => {
        const emp = employees.find(e => e.employeeId === employeeId);
        if (!emp) return prev;
        
        const updated = { ...prev };
        const team = emp.team;
        if (!updated[team]) updated[team] = {};
        
        const teamTotal = employees
          .filter(e => e.team === team)
          .reduce((sum, e) => {
            const srv = e.employeeId === employeeId 
              ? { ...e.services[serviceCode], enabled: enabled }
              : e.services[serviceCode];
            return sum + (srv?.enabled ? (srv?.count || 0) : 0);
          }, 0);
        
        updated[team] = { ...updated[team], [serviceCode]: teamTotal };
        return updated;
      });

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

      // NO RELOAD - optimistic update is complete
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
      // Reload only on error to sync state
      loadData();
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
      
      // Optimistic update
      setEmployees(prev => prev.map(e => {
        if (e.employeeId !== employeeId) return e;
        
        const newServices = { ...e.services };
        newServices[serviceCode] = {
          ...newServices[serviceCode],
          count: newAantal,
          enabled: newAantal > 0
        };
        
        let newTotalPeriodeWaarde = 0;
        Object.entries(newServices).forEach(([code, srv]: any) => {
          if (srv?.enabled && srv?.count > 0) {
            newTotalPeriodeWaarde += srv.count * (srv.dienstwaarde || 1.0);
          }
        });
        
        return {
          ...e,
          services: newServices,
          totalPeriodeWaarde: Math.round(newTotalPeriodeWaarde * 10) / 10
        };
      }));

      // Update team totals optimistically
      setTeamTotals(prev => {
        const emp = employees.find(e => e.employeeId === employeeId);
        if (!emp) return prev;
        
        const updated = { ...prev };
        const team = emp.team;
        if (!updated[team]) updated[team] = {};
        
        const teamTotal = employees
          .filter(e => e.team === team)
          .reduce((sum, e) => {
            const srvCount = e.employeeId === employeeId ? newAantal : (e.services[serviceCode]?.count || 0);
            return sum + srvCount;
          }, 0);
        
        updated[team] = { ...updated[team], [serviceCode]: teamTotal };
        return updated;
      });

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

      // NO RELOAD - optimistic update is complete
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
      // Reload only on error to sync state
      loadData();
    }
  };

  const getTeamColor = (team?: string) => {
    if (!team) return 'bg-blue-500';
    const t = team.toLowerCase();
    if (t === 'groen') return 'bg-green-500';
    if (t === 'oranje') return 'bg-orange-500';
    if (t === 'praktijk') return 'bg-blue-500';
    return 'bg-blue-500';
  };

  const getPdColorClass = (wd: number, pd: number) => {
    if (pd === wd) {
      return 'pd-value match';  // Groen
    } else if (pd < wd) {
      return 'pd-value underboosted';  // Rood
    } else {
      return 'pd-value overboosted';  // Geel
    }
  };

  const CellSaveIndicator = ({ state }: { state?: any }) => {
    if (!state?.status) return null;
    if (state.status === 'saving') {
      return <span className="save-feedback saving">⟳</span>;
    }
    if (state.status === 'success') {
      return <span className="save-feedback success">✓</span>;
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <style>{`
        .assignments-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--color-surface, white);
          border-bottom: 2px solid var(--color-border, #e5e7eb);
        }

        .service-badge-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem;
          background: var(--color-bg-secondary, #f3f4f6);
          border-radius: 6px;
          min-width: 70px;
        }

        .badge-code {
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--color-text, #000);
        }

        .badge-dienstwaarde {
          font-size: 0.75rem;
          color: var(--color-text-secondary, #6b7280);
          font-variant-numeric: tabular-nums;
        }

        .service-cell {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem;
          min-width: 80px;
          justify-content: center;
          position: relative;
        }

        .service-cell input[type="checkbox"] {
          cursor: pointer;
          width: 18px;
          height: 18px;
          margin: 0;
        }

        .service-cell button {
          padding: 2px 6px;
          font-size: 0.75rem;
          min-width: 20px;
          height: 24px;
          cursor: pointer;
          background: var(--color-secondary, #e5e7eb);
          border: 1px solid var(--color-border, #d1d5db);
          border-radius: 3px;
        }

        .service-cell button:hover {
          background: var(--color-secondary-hover, #d1d5db);
        }

        .service-cell button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .service-cell .count {
          min-width: 20px;
          text-align: center;
          font-variant-numeric: tabular-nums;
          font-size: 0.9rem;
        }

        .save-feedback {
          position: absolute;
          right: -25px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
        }

        .save-feedback.saving {
          animation: spin 1s linear infinite;
          color: #3b82f6;
        }

        .save-feedback.success {
          color: #22c55e;
          animation: fadeInOut 2s ease-in-out;
        }

        @keyframes spin {
          from { transform: translateY(-50%) rotate(0deg); }
          to { transform: translateY(-50%) rotate(360deg); }
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          10%, 90% { opacity: 1; }
        }

        .pd-value {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 500;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }

        .pd-value.match {
          background-color: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .pd-value.underboosted {
          background-color: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .pd-value.overboosted {
          background-color: rgba(255, 193, 7, 0.15);
          color: #f57f17;
          border: 1px solid rgba(255, 193, 7, 0.3);
        }

        .wd-column {
          text-align: center;
          font-weight: 500;
          min-width: 60px;
          font-variant-numeric: tabular-nums;
        }

        .team-totals-row {
          background: var(--color-bg-secondary, #f3f4f6);
          font-weight: 500;
          border-top: 2px solid var(--color-border, #d1d5db);
        }

        .team-totals-row.praktijk {
          border-bottom: 2px solid var(--color-border, #d1d5db);
        }

        .team-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
        }

        .team-label::before {
          content: '';
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: currentColor;
        }
      `}</style>

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
          <thead className="assignments-header">
            <tr>
              <th className="w-32 px-2 py-2 text-left font-semibold text-gray-900">
                Medewerker
              </th>
              <th className="wd-column px-2 py-2 text-center font-semibold text-gray-900">
                Wd
              </th>
              <th className="w-20 px-2 py-2 text-center font-semibold text-gray-900">
                Pd
              </th>
              {services.map(svc => (
                <th
                  key={svc.code}
                  className="service-badge-header"
                >
                  <div className="badge-code">{svc.code}</div>
                  <div className="badge-dienstwaarde">{svc.dienstwaarde}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.employeeId} className="border-b border-gray-200 hover:bg-gray-50">
                {/* Medewerker */}
                <td className="w-32 px-2 py-2 text-left">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getTeamColor(emp.team)}`}></div>
                    <span className="font-medium text-gray-900">{emp.employeeName}</span>
                  </div>
                </td>

                {/* Wd (Werkdagen) */}
                <td className="wd-column px-2 py-2 text-center text-gray-900 font-semibold">
                  {emp.aantalWerkdagen}
                </td>

                {/* Pd (Periode Waarde) */}
                <td className={`w-20 px-2 py-2 ${getPdColorClass(emp.aantalWerkdagen, emp.totalPeriodeWaarde)}`}>
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
                      className="service-cell border-l border-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={srvData?.enabled || false}
                        onChange={() => handleCheckboxChange(emp.employeeId, svc.code, !srvData?.enabled)}
                      />
                      <button 
                        onClick={() => handleAantalChange(emp.employeeId, svc.code, -1)}
                        disabled={!srvData?.enabled || cellState?.status === 'saving'}
                      >
                        −
                      </button>
                      <span className="count">{srvData?.count || 0}</span>
                      <button 
                        onClick={() => handleAantalChange(emp.employeeId, svc.code, 1)}
                        disabled={!srvData?.enabled || cellState?.status === 'saving'}
                      >
                        +
                      </button>
                      
                      <CellSaveIndicator state={cellState} />
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* FOOTER: Team Totals - Fixed Order */}
            {['Groen', 'Oranje', 'Praktijk'].map((team) => {
              const totals = teamTotals[team] || {};
              
              return (
                <tr 
                  key={`total_${team}`} 
                  className={`team-totals-row ${team.toLowerCase()}`}
                >
                  <td className="w-32 px-2 py-2 text-left text-gray-900">
                    <div className="team-label" style={{ color: getTeamColor(team).replace('bg-', 'text-') }}>
                      {team}
                    </div>
                  </td>
                  <td className="wd-column px-2 py-2 text-center">−</td>
                  <td className="w-20 px-2 py-2 text-center">−</td>
                  {services.map(svc => (
                    <td
                      key={`total_${team}_${svc.code}`}
                      className="service-cell border-l border-gray-300"
                    >
                      <span className="font-bold">{totals[svc.code] || 0}</span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Cache: {CACHE_BUST_NONCE}
      </div>
    </div>
  );
}