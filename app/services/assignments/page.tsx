'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RefreshCw, X } from 'lucide-react';
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
  aantalwerkdagen: number;  // From Supabase module (line 85: employees.aantalwerkdagen)
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

  const CACHE_BUST_NONCE = `draad349e_phase8_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

      const serviceCodesSet = new Set<string>();
      const serviceInfoMap = new Map<string, ServiceInfo>();
      
      overview.forEach((emp: any) => {
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

      const idMap: Record<string, string> = {};
      for (const code of sortedServices) {
        const id = await getServiceIdByCode(code);
        if (id) idMap[code] = id;
      }
      setServiceIdMap(idMap);

      const employeeList = overview.map((emp: any) => {
        // VERIFIED: emp.aantalwerkdagen comes from Supabase module (correctly set)
        const wd = emp.aantalwerkdagen ?? 0;
        
        console.log(`Employee: ${emp.employeeName}, aantalwerkdagen: ${wd}, raw: ${emp.aantalwerkdagen}`);

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
          aantalwerkdagen: wd,
          services: emp.services,
          totalPeriodeWaarde: Math.round(totalPeriodeWaarde * 10) / 10
        };
      });

      /**
       * Team Totals = GRAND TOTAL for ALL employees per service
       */
      const totals: TeamTotals = {};
      
      const teamMap: Record<string, EmployeeServiceData[]> = {};
      employeeList.forEach((emp: EmployeeServiceData) => {
        if (!teamMap[emp.team]) teamMap[emp.team] = [];
        teamMap[emp.team].push(emp);
      });

      // Calculate totals PER TEAM
      Object.entries(teamMap).forEach(([team, teamEmployees]) => {
        totals[team] = {};
        sortedServices.forEach(code => {
          totals[team][code] = 0;
          teamEmployees.forEach((emp: EmployeeServiceData) => {
            const srvData = emp.services[code];
            if (srvData && srvData.enabled) {
              totals[team][code] += srvData.count;
            }
          });
        });
      });

      // Calculate GRAND TOTALS for "Praktijk" = SUM of ALL employees
      totals['Praktijk'] = {};
      sortedServices.forEach(code => {
        totals['Praktijk'][code] = 0;
        employeeList.forEach((emp: EmployeeServiceData) => {
          const srvData = emp.services[code];
          if (srvData && srvData.enabled) {
            totals['Praktijk'][code] += srvData.count;
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
      const emp = employees.find(e => e.employeeId === employeeId);
      if (!emp) return;

      const srvData = emp.services[serviceCode];
      const currentCount = srvData?.count || 0;

      const cellKey = `${employeeId}_${serviceCode}`;
      
      const newEmployees = employees.map(e => {
        if (e.employeeId !== employeeId) return e;
        
        const newServices = { ...e.services };
        newServices[serviceCode] = {
          ...newServices[serviceCode],
          enabled: enabled
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
      });
      setEmployees(newEmployees);

      const newTotals: TeamTotals = {};
      const newTeamMap: Record<string, EmployeeServiceData[]> = {};
      newEmployees.forEach((emp: EmployeeServiceData) => {
        if (!newTeamMap[emp.team]) newTeamMap[emp.team] = [];
        newTeamMap[emp.team].push(emp);
      });

      Object.entries(newTeamMap).forEach(([team, teamEmployees]) => {
        newTotals[team] = {};
        services.forEach(s => {
          newTotals[team][s.code] = 0;
          teamEmployees.forEach((emp: EmployeeServiceData) => {
            const srvData = emp.services[s.code];
            if (srvData && srvData.enabled) {
              newTotals[team][s.code] += srvData.count;
            }
          });
        });
      });

      newTotals['Praktijk'] = {};
      services.forEach(s => {
        newTotals['Praktijk'][s.code] = 0;
        newEmployees.forEach((emp: EmployeeServiceData) => {
          const srvData = emp.services[s.code];
          if (srvData && srvData.enabled) {
            newTotals['Praktijk'][s.code] += srvData.count;
          }
        });
      });

      setTeamTotals(newTotals);

      setCellStates(prev => ({
        ...prev,
        [cellKey]: { status: 'saving', timestamp: Date.now() }
      }));

      const serviceId = serviceIdMap[serviceCode];
      if (!serviceId) throw new Error(`Service ID not found for ${serviceCode}`);

      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        aantal: currentCount,
        actief: enabled
      });

      setCellStates(prev => ({
        ...prev,
        [cellKey]: { status: 'success', timestamp: Date.now() }
      }));
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
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
      const currentEnabled = srvData?.enabled || false;

      const cellKey = `${employeeId}_${serviceCode}`;
      
      const newEmployees = employees.map(e => {
        if (e.employeeId !== employeeId) return e;
        
        const newServices = { ...e.services };
        newServices[serviceCode] = {
          ...newServices[serviceCode],
          count: newAantal
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
      });
      setEmployees(newEmployees);

      const newTotals: TeamTotals = {};
      const newTeamMap: Record<string, EmployeeServiceData[]> = {};
      newEmployees.forEach((emp: EmployeeServiceData) => {
        if (!newTeamMap[emp.team]) newTeamMap[emp.team] = [];
        newTeamMap[emp.team].push(emp);
      });

      Object.entries(newTeamMap).forEach(([team, teamEmployees]) => {
        newTotals[team] = {};
        services.forEach(s => {
          newTotals[team][s.code] = 0;
          teamEmployees.forEach((emp: EmployeeServiceData) => {
            const srvData = emp.services[s.code];
            if (srvData && srvData.enabled) {
              newTotals[team][s.code] += srvData.count;
            }
          });
        });
      });

      newTotals['Praktijk'] = {};
      services.forEach(s => {
        newTotals['Praktijk'][s.code] = 0;
        newEmployees.forEach((emp: EmployeeServiceData) => {
          const srvData = emp.services[s.code];
          if (srvData && srvData.enabled) {
            newTotals['Praktijk'][s.code] += srvData.count;
          }
        });
      });

      setTeamTotals(newTotals);

      setCellStates(prev => ({
        ...prev,
        [cellKey]: { status: 'saving', timestamp: Date.now() }
      }));

      const serviceId = serviceIdMap[serviceCode];
      if (!serviceId) throw new Error(`Service ID not found for ${serviceCode}`);

      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        aantal: newAantal,
        actief: currentEnabled
      });

      setCellStates(prev => ({
        ...prev,
        [cellKey]: { status: 'success', timestamp: Date.now() }
      }));
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
      loadData();
    }
  };

  const getTeamColor = (team?: string) => {
    if (!team) return '#3b82f6';
    const t = team.toLowerCase();
    if (t === 'groen') return '#22c55e';
    if (t === 'oranje') return '#f97316';
    if (t === 'praktijk') return '#3b82f6';
    return '#3b82f6';
  };

  const getPdColor = (wd: number, pd: number) => {
    if (pd === wd) return { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', label: 'match' };
    if (pd < wd) return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', label: 'underboosted' };
    return { bg: 'rgba(255, 193, 7, 0.1)', text: '#f57f17', label: 'overboosted' };
  };

  const CellSaveIndicator = ({ state }: { state?: any }) => {
    if (!state?.status) return null;
    if (state.status === 'saving') {
      return <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>⟳</span>;
    }
    if (state.status === 'success') {
      return <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>✓</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="animate-spin" style={{ margin: '0 auto 0.5rem', width: 32, height: 32 }} />
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '1rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', margin: '0 0 0.25rem 0' }}>🎯 Diensten Medewerkers</h1>
          <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0 }}>Macro-configuratie: globale diensten-toewijzingen</p>
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

      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '0.5rem', 
        border: '1px solid #e5e7eb', 
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', 
        overflow: 'hidden',
        maxHeight: 'calc(100vh - 250px)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: `150px 60px 80px ${services.map(() => '100px').join(' ')}`,
          gap: 0,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'white',
          borderBottom: '2px solid #e5e7eb',
          padding: 0,
          flexShrink: 0
        }}>
          <div style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: '#111827', fontSize: '0.85rem' }}>Medewerker</div>
          <div style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: '#111827', fontSize: '0.85rem' }}>Wd</div>
          <div style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: '#111827', fontSize: '0.85rem' }}>Pd</div>
          {services.map(svc => (
            <div key={`header_${svc.code}`} style={{
              padding: '0.5rem',
              textAlign: 'center',
              fontWeight: '600',
              color: '#111827',
              backgroundColor: '#f3f4f6',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              minWidth: '100px'
            }}>
              <div style={{ fontWeight: '600' }}>{svc.code}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{svc.dienstwaarde}</div>
            </div>
          ))}
        </div>

        <div style={{
          overflow: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {employees.map((emp) => (
            <div key={emp.employeeId} style={{
              display: 'grid',
              gridTemplateColumns: `150px 60px 80px ${services.map(() => '100px').join(' ')}`,
              gap: 0,
              borderBottom: '1px solid #e5e7eb',
              alignItems: 'center',
              minHeight: '44px',
              backgroundColor: 'white'
            }}>
              <div style={{
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minWidth: '150px',
                fontSize: '0.9rem'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: getTeamColor(emp.team),
                  flexShrink: 0
                }}></div>
                <span style={{ fontWeight: '500', color: '#111827' }}>{emp.employeeName}</span>
              </div>

              <div style={{
                padding: '0.5rem',
                textAlign: 'center',
                fontWeight: '500',
                color: '#111827',
                fontSize: '0.9rem',
                minWidth: '60px'
              }}>
                {emp.aantalwerkdagen}
              </div>

              <div style={{
                padding: '0.5rem',
                textAlign: 'center',
                fontWeight: '500',
                backgroundColor: getPdColor(emp.aantalwerkdagen, emp.totalPeriodeWaarde).bg,
                color: getPdColor(emp.aantalwerkdagen, emp.totalPeriodeWaarde).text,
                borderRadius: '6px',
                fontSize: '0.9rem',
                minWidth: '80px'
              }}>
                {emp.totalPeriodeWaarde}
              </div>

              {services.map(svc => {
                const srvData = emp.services[svc.code];
                const cellKey = `${emp.employeeId}_${svc.code}`;
                const cellState = cellStates[cellKey];

                return (
                  <div key={cellKey} style={{
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0',
                    borderLeft: '1px solid #d1d5db',
                    position: 'relative',
                    minWidth: '100px',
                    height: '44px'
                  }}>
                    <input
                      type="checkbox"
                      checked={srvData?.enabled || false}
                      onChange={(e) => handleCheckboxChange(emp.employeeId, svc.code, e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0, flexShrink: 0 }}
                    />
                    
                    <button
                      onClick={() => handleAantalChange(emp.employeeId, svc.code, -1)}
                      disabled={cellState?.status === 'saving'}
                      style={{
                        padding: '2px 5px',
                        fontSize: '0.75rem',
                        minWidth: '18px',
                        height: '22px',
                        cursor: cellState?.status === 'saving' ? 'default' : 'pointer',
                        backgroundColor: '#e5e7eb',
                        border: '1px solid #d1d5db',
                        borderRadius: '2px',
                        opacity: cellState?.status === 'saving' ? 0.5 : 1,
                        margin: '0 1px',
                        flexShrink: 0
                      }}
                    >
                      −
                    </button>

                    <span style={{ 
                      minWidth: '16px', 
                      textAlign: 'center', 
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      margin: '0 2px',
                      flexShrink: 0
                    }}>
                      {srvData?.count || 0}
                    </span>

                    <button
                      onClick={() => handleAantalChange(emp.employeeId, svc.code, 1)}
                      disabled={cellState?.status === 'saving'}
                      style={{
                        padding: '2px 5px',
                        fontSize: '0.75rem',
                        minWidth: '18px',
                        height: '22px',
                        cursor: cellState?.status === 'saving' ? 'default' : 'pointer',
                        backgroundColor: '#e5e7eb',
                        border: '1px solid #d1d5db',
                        borderRadius: '2px',
                        opacity: cellState?.status === 'saving' ? 0.5 : 1,
                        margin: '0 1px',
                        flexShrink: 0
                      }}
                    >
                      +
                    </button>

                    <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CellSaveIndicator state={cellState} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {['Groen', 'Oranje', 'Praktijk'].map((team) => {
            const totals = teamTotals[team] || {};
            const isGrandTotal = team === 'Praktijk';
            
            return (
              <div key={`total_${team}`} style={{
                display: 'grid',
                gridTemplateColumns: `150px 60px 80px ${services.map(() => '100px').join(' ')}`,
                gap: 0,
                backgroundColor: '#f3f4f6',
                fontWeight: '500',
                borderTop: team === 'Groen' ? '2px solid #d1d5db' : '1px solid #d1d5db',
                borderBottom: team === 'Praktijk' ? '2px solid #d1d5db' : 'none',
                minHeight: '44px',
                alignItems: 'center'
              }}>
                <div style={{
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  color: getTeamColor(team),
                  fontSize: '0.9rem',
                  minWidth: '150px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: getTeamColor(team),
                    flexShrink: 0
                  }}></div>
                  {isGrandTotal ? 'Praktijk *' : team}
                </div>
                <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.9rem', minWidth: '60px' }}>−</div>
                <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.9rem', minWidth: '80px' }}>−</div>
                {services.map(svc => (
                  <div key={`total_${team}_${svc.code}`} style={{
                    padding: '0.5rem',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    borderLeft: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    minWidth: '100px',
                    backgroundColor: isGrandTotal ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}>
                    {totals[svc.code] || 0}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#d1d5db', textAlign: 'right' }}>
        * Praktijk = Totaal van alle medewerkers | Cache: {CACHE_BUST_NONCE}
      </div>
    </div>
  );
}