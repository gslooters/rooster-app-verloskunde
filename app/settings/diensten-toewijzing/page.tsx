'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RefreshCw, Check } from 'lucide-react';
import {
  getEmployeeServicesOverview,
  upsertEmployeeService,
  getServiceIdByCode
} from '@/lib/services/medewerker-diensten-supabase';
import { supabase } from '@/lib/services/medewerker-diensten-supabase';
import type { EmployeeServiceRow } from '@/lib/types/employee-services';

// CRITICAL: Force dynamic rendering - no caching whatsoever
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DienstenToewijzingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EmployeeServiceRow[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ code: string; dienstwaarde: number; naam?: string; kleur?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [serviceTotals, setServiceTotals] = useState<Record<string, number>>({});
  const [saveState, setSaveState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (data.length > 0 && serviceTypes.length > 0) {
      const totals: Record<string, number> = {};
      serviceTypes.forEach(st => {
        let count = 0;
        data.forEach(emp => {
          const c = emp.services?.[st.code]?.count || 0;
          if (emp.services?.[st.code]?.enabled && c > 0) {
            count += c;
          }
        });
        totals[st.code] = count;
      });
      setServiceTotals(totals);
    }
  }, [data, serviceTypes]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const { data: services } = await supabase
        .from('service_types')
        .select('code, dienstwaarde, naam, kleur')
        .eq('actief', true)
        .order('code', { ascending: true });
      const serviceInfo = services?.map(s => ({
        code: s.code,
        dienstwaarde: s.dienstwaarde || 1.0,
        naam: s.naam,
        kleur: s.kleur
      })) || [];
      setServiceTypes(serviceInfo);
      const overview = await getEmployeeServicesOverview();
      setData(overview);
    } catch (err: any) {
      setError(err.message || 'Fout bij laden van gegevens');
    } finally {
      setLoading(false);
    }
  }

  function markSaved(key: string) {
    setSaveState(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setSaveState(prev => ({ ...prev, [key]: false })), 1500);
  }

  async function handleToggle(employeeId: string, serviceCode: string, currentEnabled: boolean) {
    try {
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
          if (s.enabled && s.count > 0) newTotal += s.count * s.dienstwaarde;
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
      if (newCount < 0 || newCount > 35) {
        setError('Aantal moet tussen 0 en 35 liggen');
        return;
      }
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
          if (s.enabled && s.count > 0) newTotal += s.count * s.dienstwaarde;
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
          </div>
          <Button
            onClick={() => loadData()}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm">
                <tr>
                  <th className="border border-gray-300 p-3 text-left font-semibold text-gray-700 bg-white">Team</th>
                  <th className="border border-gray-300 p-3 text-left font-semibold text-gray-700 bg-white">Naam</th>
                  <th className="border border-gray-300 p-3 text-center font-semibold text-gray-700 bg-blue-50">Totaal</th>
                  {serviceTypes.map(service => (
                    <th key={service.code} className="border border-gray-300 p-2 text-center font-semibold text-gray-700 min-w-[100px] bg-white">
                      <div className="flex flex-col items-center gap-1">
                        <span 
                          className="text-sm cursor-help hover:text-purple-600 transition-colors" 
                          title={service.naam || service.code}
                        >
                          {service.code}
                        </span>
                        {service.dienstwaarde !== 1.0 && (
                          <span className="text-xs text-gray-500">×{service.dienstwaarde}</span>
                        )}
                        <div className="mt-1 px-2 py-0.5 bg-gray-200 text-xs rounded-full shadow-sm text-gray-700 min-w-[24px] min-h-[20px] flex items-center justify-center">
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
                    <td colSpan={serviceTypes.length + 3} className="border border-gray-300 p-8 text-center text-gray-500">
                      Geen medewerkers gevonden
                    </td>
                  </tr>
                ) : (
                  data.map((employee) => (
                    <tr key={employee.employeeId} className="hover:bg-purple-50 transition-colors">
                      <td className="border border-gray-300 p-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium shadow-sm ${
                          employee.team === 'Groen' 
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : employee.team === 'Oranje' 
                            ? 'bg-orange-100 text-orange-800 border border-orange-300' 
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}>
                          {employee.team}
                        </span>
                      </td>
                      <td className="border border-gray-300 p-3 font-medium text-gray-900">{employee.employeeName}</td>
                      <td className="border border-gray-300 p-3 text-center font-bold bg-blue-50">
                        <span className={employee.isOnTarget ? 'text-green-600' : 'text-gray-900'}>
                          {employee.totalDiensten} / {employee.dienstenperiode}
                        </span>
                      </td>
                      {serviceTypes.map(service => {
                        const serviceData = employee.services?.[service.code] || { enabled: false, count: 0 };
                        const cellKey = employee.employeeId + '_' + service.code;
                        return (
                          <td 
                            key={service.code} 
                            className="border border-gray-300 p-2 text-center group hover:bg-purple-100 hover:shadow-inner transition-all duration-150 min-w-[100px]"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <Checkbox
                                checked={serviceData.enabled}
                                onCheckedChange={() => handleToggle(employee.employeeId, service.code, serviceData.enabled)}
                                className="cursor-pointer"
                              />
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0"
                                  max="35"
                                  value={serviceData.enabled ? serviceData.count : ''}
                                  onChange={e => handleCountChange(employee.employeeId, service.code, parseInt(e.target.value) || 0)}
                                  disabled={!serviceData.enabled}
                                  placeholder="0"
                                  className={`w-12 h-9 text-center text-sm rounded border-2 transition-all duration-150 ${
                                    serviceData.enabled 
                                      ? 'bg-white border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200' 
                                      : 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                                  }`}
                                  style={{ fontSize: '0.95rem' }}
                                  tabIndex={serviceData.enabled ? 0 : -1}
                                />
                                {saveState[cellKey] && (
                                  <Check className="absolute -right-6 top-2 text-green-600 animate-fadeout drop-shadow-sm" size={18} />
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

        <style jsx>{`
          @keyframes fadeoutanim {
            0% { opacity: 1; transform: scale(1); }
            85% { opacity: 1; transform: scale(1.1); }
            100% { opacity: 0; transform: scale(0.9); }
          }
          .animate-fadeout {
            animation: fadeoutanim 1.5s ease-out;
          }
        `}</style>

        <div className="mt-6 space-y-2 text-sm text-gray-700 bg-blue-50 p-5 rounded-lg shadow-sm border border-blue-200">
          <p className="flex items-start gap-2">
            <span className="text-lg">💡</span>
            <span><strong>Gebruik:</strong> Vink een dienst aan om deze toe te wijzen. Het getal geeft het aantal keer per periode aan.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-lg">🎯</span>
            <span><strong>Doel:</strong> Groene getallen in de Totaal-kolom betekenen dat de medewerker op target is (totaal diensten = dienstenperiode).</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-lg">📊</span>
            <span><strong>Mini-totalen:</strong> Onder elke dienstcode zie je het totaal aantal toegewezen diensten (ongewogen) voor alle medewerkers.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
