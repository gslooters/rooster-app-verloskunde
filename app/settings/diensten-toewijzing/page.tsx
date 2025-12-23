'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RefreshCw, Check } from 'lucide-react';

// CRITICAL: Force dynamic rendering - no caching whatsoever
export const dynamic = 'force-dynamic';

// LAZY IMPORT: Delay Supabase import until client-side rendering
let getRosterEmployeeServices: any;
let getRosterEmployeeServicesByEmployee: any;
let upsertEmployeeService: any;
let getServiceIdByCode: any;
let supabase: any;

const loadSupabaseModules = async () => {
  if (!getRosterEmployeeServices) {
    const mod1 = await import('@/lib/services/roster-employee-services');
    getRosterEmployeeServices = mod1.getRosterEmployeeServices;
    getRosterEmployeeServicesByEmployee = mod1.getRosterEmployeeServicesByEmployee;
    
    const mod2 = await import('@/lib/services/medewerker-diensten-supabase');
    upsertEmployeeService = mod2.upsertEmployeeService;
    getServiceIdByCode = mod2.getServiceIdByCode;
    supabase = mod2.supabase;
  }
};

export default function DienstenToewijzingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ code: string; dienstwaarde: number; naam?: string; kleur?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [serviceTotals, setServiceTotals] = useState<Record<string, number>>({});
  const [saveState, setSaveState] = useState<Record<string, boolean>>({});
  const [rosterId, setRosterId] = useState<string | null>(null);

  useEffect(() => {
    // REFACTOR DRAAD-194-FASE1: Get rosterId from URL or context
    // For now, try to get from sessionStorage or router
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('currentRosterId') : null;
    if (stored) {
      setRosterId(stored);
      loadData(stored);
    } else {
      // Fallback: load all data (backward compat)
      loadData(null);
    }
  }, []);

  // Realtime berekening van mini-totalen per dienst
  useEffect(() => {
    if (data.length > 0 && serviceTypes.length > 0) {
      const totals: Record<string, number> = {};
      serviceTypes.forEach(st => {
        let count = 0;
        data.forEach(emp => {
          const serviceData = emp.services?.[st.code];
          if (serviceData?.enabled && serviceData.count > 0) {
            count += serviceData.count;
          }
        });
        totals[st.code] = count;
      });
      setServiceTotals(totals);
    }
  }, [data, serviceTypes]);

  async function loadData(rId: string | null) {
    try {
      setLoading(true);
      setError(null);
      
      // Load Supabase modules FIRST, client-side only
      await loadSupabaseModules();
      
      // Haal alle actieve diensten op, gesorteerd op code
      const { data: services } = await supabase
        .from('service_types')
        .select('code, dienstwaarde, naam, kleur')
        .eq('actief', true)
        .order('code', { ascending: true });
      
      const serviceInfo = services?.map((s: any) => ({
        code: s.code,
        dienstwaarde: s.dienstwaarde || 1.0,
        naam: s.naam,
        kleur: s.kleur
      })) || [];
      
      setServiceTypes(serviceInfo);
      
      // REFACTOR DRAAD-194-FASE1: Use getRosterEmployeeServices instead of getEmployeeServicesOverview
      let overview: any[] = [];
      
      if (rId) {
        // Rooster-specific data using roster_employee_services
        console.log('🔄 [REFACTOR] Loading data for rosterId:', rId);
        const rosterServices = await getRosterEmployeeServices(rId);
        console.log('✅ [REFACTOR] Roster services loaded:', rosterServices.length);
        
        // Transform roster_employee_services into employee overview format
        const employeeMap = new Map<string, any>();
        
        rosterServices.forEach((rs: any) => {
          if (!employeeMap.has(rs.employee_id)) {
            employeeMap.set(rs.employee_id, {
              employeeId: rs.employee_id,
              employeeName: rs.employee_id, // Will be enhanced if name available
              team: rs.team, // ✅ DIRECT from roster_employee_services.team
              services: {},
              totalDiensten: 0,
              dienstenperiode: 0,
              isOnTarget: false
            });
          }
          
          const emp = employeeMap.get(rs.employee_id);
          if (rs.service_types) {
            emp.services[rs.service_types.code] = {
              enabled: rs.actief,
              count: rs.aantal,
              dienstwaarde: rs.service_types.dienstwaarde || 1.0
            };
          }
        });
        
        overview = Array.from(employeeMap.values());
      } else {
        // Fallback: Load from old service (backward compat)
        const mod = await import('@/lib/services/medewerker-diensten-supabase');
        const getEmployeeServicesOverview = mod.getEmployeeServicesOverview;
        overview = await getEmployeeServicesOverview();
      }
      
      setData(overview);
    } catch (err: any) {
      setError(err.message || 'Fout bij laden van gegevens');
    } finally {
      setLoading(false);
    }
  }

  function markSaved(key: string) {
    setSaveState(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSaveState(prev => ({ ...prev, [key]: false }));
    }, 1500);
  }

  async function handleToggle(employeeId: string, serviceCode: string, currentEnabled: boolean) {
    try {
      await loadSupabaseModules();
      const serviceId = await getServiceIdByCode(serviceCode);
      if (!serviceId) throw new Error(`Dienst ${serviceCode} niet gevonden`);
      
      const employee = data.find(e => e.employeeId === employeeId);
      const currentCount = employee?.services[serviceCode]?.count || 0;
      
      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        actief: !currentEnabled,
        aantal: currentEnabled ? 0 : (currentCount || 1)
      });
      
      setData(prev => prev.map(emp => {
        if (emp.employeeId !== employeeId) return emp;
        
        const newServices = { ...emp.services };
        newServices[serviceCode] = {
          ...newServices[serviceCode],
          enabled: !currentEnabled,
          count: currentEnabled ? 0 : (currentCount || 1)
        };
        
        let newTotal = 0;
        Object.values(newServices).forEach((s: any) => {
          if (s.enabled && s.count > 0) {
            newTotal += s.count * s.dienstwaarde;
          }
        });
        
        return {
          ...emp,
          services: newServices,
          totalDiensten: Math.round(newTotal * 10) / 10,
          isOnTarget: Math.abs(newTotal - emp.dienstenperiode) < 0.1
        };
      }));
      
      markSaved(employeeId + '_' + serviceCode);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCountChange(employeeId: string, serviceCode: string, newCount: number) {
    try {
      // Validatie: tussen 0 en 35
      if (newCount < 0 || newCount > 35) {
        setError('Aantal moet tussen 0 en 35 liggen');
        return;
      }
      
      await loadSupabaseModules();
      const serviceId = await getServiceIdByCode(serviceCode);
      if (!serviceId) throw new Error(`Dienst ${serviceCode} niet gevonden`);
      
      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        actief: true,
        aantal: newCount
      });
      
      setData(prev => prev.map(emp => {
        if (emp.employeeId !== employeeId) return emp;
        
        const newServices = { ...emp.services };
        newServices[serviceCode] = {
          ...newServices[serviceCode],
          count: newCount,
          enabled: true
        };
        
        let newTotal = 0;
        Object.values(newServices).forEach((s: any) => {
          if (s.enabled && s.count > 0) {
            newTotal += s.count * s.dienstwaarde;
          }
        });
        
        return {
          ...emp,
          services: newServices,
          totalDiensten: Math.round(newTotal * 10) / 10,
          isOnTarget: Math.abs(newTotal - emp.dienstenperiode) < 0.1
        };
      }));
      
      markSaved(employeeId + '_' + serviceCode);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            <span className="ml-3 text-gray-600">Laden...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug naar Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">🎯 Diensten Toewijzing</h1>
            {rosterId && <span className="text-sm text-gray-500">[Rooster: {rosterId.slice(0, 8)}...]</span>}
          </div>
          <Button
            onClick={() => loadData(rosterId)}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Tabel */}
        <Card className="overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr>
                  {/* Team kolom */}
                  <th className="border border-gray-300 p-3 text-left font-semibold text-gray-700 bg-white w-32">
                    Team
                  </th>
                  
                  {/* Naam kolom */}
                  <th className="border border-gray-300 p-3 text-left font-semibold text-gray-700 bg-white w-44">
                    Naam
                  </th>
                  
                  {/* Totaal kolom - DIRECT NA NAAM */}
                  <th className="border border-gray-300 p-3 text-center font-semibold text-gray-700 bg-blue-50 w-32">
                    Totaal
                  </th>
                  
                  {/* Dienstkolommen */}
                  {serviceTypes.map(service => (
                    <th 
                      key={service.code} 
                      className="border border-gray-300 p-2 text-center font-semibold text-gray-700 bg-white w-28"
                    >
                      <div className="flex flex-col items-center gap-1">
                        {/* Dienstcode met tooltip */}
                        <span 
                          className="text-sm font-bold cursor-help hover:text-purple-600 transition-colors" 
                          title={service.naam || service.code}
                        >
                          {service.code}
                        </span>
                        
                        {/* Dienstwaarde indien afwijkend van 1.0 */}
                        {service.dienstwaarde !== 1.0 && (
                          <span className="text-xs text-gray-500 font-normal">
                            ×{service.dienstwaarde}
                          </span>
                        )}
                        
                        {/* Mini-totaal badge */}
                        <div 
                          className="mt-1 px-2 py-0.5 bg-gray-200 text-xs rounded-full shadow-sm text-gray-700 font-semibold min-w-[28px] h-5 flex items-center justify-center border border-gray-300"
                          title={`Totaal: ${serviceTotals[service.code] || 0} diensten`}
                        >
                          {serviceTotals[service.code] || 0}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={serviceTypes.length + 3} 
                      className="border border-gray-300 p-8 text-center text-gray-500"
                    >
                      Geen medewerkers gevonden
                    </td>
                  </tr>
                ) : (
                  data.map((employee) => (
                    <tr 
                      key={employee.employeeId} 
                      className="hover:bg-purple-50 transition-colors"
                    >
                      {/* Team badge */}
                      <td className="border border-gray-300 p-3">
                        <span 
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium shadow-sm ${
                            employee.team === 'Groen' 
                              ? 'bg-green-100 text-green-800 border border-green-400' 
                              : employee.team === 'Oranje' 
                              ? 'bg-orange-100 text-orange-800 border border-orange-400' 
                              : 'bg-blue-100 text-blue-800 border border-blue-400'
                          }`}
                        >
                          {employee.team || 'Overig'}
                        </span>
                      </td>
                      
                      {/* Naam */}
                      <td className="border border-gray-300 p-3 font-medium text-gray-900">
                        {employee.employeeName}
                      </td>
                      
                      {/* Totaal - DIRECT NA NAAM */}
                      <td className="border border-gray-300 p-3 text-center font-bold bg-blue-50">
                        <span className={employee.isOnTarget ? 'text-green-600' : 'text-gray-900'}>
                          {employee.totalDiensten} / {employee.dienstenperiode}
                        </span>
                      </td>
                      
                      {/* Dienstcellen */}
                      {serviceTypes.map(service => {
                        const serviceData = employee.services?.[service.code] || { 
                          enabled: false, 
                          count: 0 
                        };
                        const cellKey = `${employee.employeeId}_${service.code}`;
                        const isSaved = saveState[cellKey];
                        
                        return (
                          <td 
                            key={service.code} 
                            className="border border-gray-300 p-2 text-center group hover:bg-purple-100 hover:shadow-inner transition-all duration-150"
                          >
                            <div className="flex items-center justify-center gap-2">
                              {/* Checkbox */}
                              <Checkbox
                                checked={serviceData.enabled}
                                onCheckedChange={() => 
                                  handleToggle(
                                    employee.employeeId, 
                                    service.code, 
                                    serviceData.enabled
                                  )
                                }
                                className="cursor-pointer"
                              />
                              
                              {/* Input veld - ALTIJD ZICHTBAAR */}
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0"
                                  max="35"
                                  value={serviceData.enabled ? serviceData.count : ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    handleCountChange(employee.employeeId, service.code, val);
                                  }}
                                  disabled={!serviceData.enabled}
                                  placeholder="0"
                                  className={`w-10 h-9 text-center text-sm rounded border-2 transition-all duration-150 ${
                                    serviceData.enabled 
                                      ? 'bg-white border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-gray-900' 
                                      : 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                                  }`}
                                  tabIndex={serviceData.enabled ? 0 : -1}
                                  autoComplete="off"
                                />
                                
                                {/* Groen vinkje bij opslaan - fade-out animatie */}
                                {isSaved && (
                                  <Check 
                                    className="absolute -right-6 top-2 text-green-600 animate-fadeout drop-shadow-sm" 
                                    size={18} 
                                  />
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* CSS animatie voor fade-out vinkje */}
        <style jsx>{`
          @keyframes fadeoutanim {
            0% { 
              opacity: 1; 
              transform: scale(1); 
            }
            85% { 
              opacity: 1; 
              transform: scale(1.15); 
            }
            100% { 
              opacity: 0; 
              transform: scale(0.85); 
            }
          }
          
          .animate-fadeout {
            animation: fadeoutanim 1.5s ease-out;
          }
        `}</style>

        {/* Instructies */}
        <div className="mt-6 space-y-2 text-sm text-gray-700 bg-blue-50 p-5 rounded-lg shadow-sm border border-blue-200">
          <p className="flex items-start gap-2">
            <span className="text-lg">💡</span>
            <span>
              <strong>Gebruik:</strong> Vink een dienst aan om deze toe te wijzen. Het getal geeft het aantal keer per periode aan.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-lg">🎯</span>
            <span>
              <strong>Doel:</strong> Groene getallen in de Totaal-kolom betekenen dat de medewerker op target is (totaal diensten = dienstenperiode).
            </span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-lg">📊</span>
            <span>
              <strong>Mini-totalen:</strong> Onder elke dienstcode zie je het totaal aantal toegewezen diensten (ongewogen) voor alle medewerkers.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-lg">✅</span>
            <span>
              <strong>Feedback:</strong> Bij opslaan verschijnt een groen vinkje naast het invoerveld.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-lg">🔄</span>
            <span>
              <strong>REFACTOR DRAAD-194-FASE1:</strong> Nu met roster_employee_services (team direct beschikbaar, geen employee-services JOIN meer).
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}