'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, RefreshCw } from 'lucide-react';
import { 
  getEmployeeServicesOverview, 
  upsertEmployeeService,
  getServiceIdByCode
} from '@/lib/services/medewerker-diensten-supabase';
import { supabase } from '@/lib/services/medewerker-diensten-supabase';
import type { EmployeeServiceRow } from '@/lib/types/employee-services';

export default function DienstenToewijzingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<EmployeeServiceRow[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Starting loadData...');
      
      // Haal diensten op
      const { data: services, error: servError } = await supabase
        .from('service_types')
        .select('code')
        .eq('actief', true)
        .order('code', { ascending: true });
      
      if (servError) {
        console.error('❌ Service error:', servError);
        throw servError;
      }
      
      const serviceCodes = services?.map(s => s.code) || [];
      console.log('✅ Service types loaded:', serviceCodes);
      setServiceTypes(serviceCodes);

      // Haal employee overview op
      const overview = await getEmployeeServicesOverview();
      console.log('✅ Employee overview loaded:', overview.length, 'employees');
      console.log('📊 First employee sample:', overview[0]);
      setData(overview);
    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      setError(err.message || 'Fout bij laden van gegevens');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(employeeId: string, serviceCode: string, currentEnabled: boolean) {
    try {
      const serviceId = await getServiceIdByCode(serviceCode);
      if (!serviceId) {
        throw new Error(`Dienst ${serviceCode} niet gevonden`);
      }

      // Vind huidige count
      const employee = data.find(e => e.employeeId === employeeId);
      const currentCount = employee?.services[serviceCode]?.count || 0;

      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        actief: !currentEnabled,
        aantal: currentEnabled ? 0 : (currentCount || 1)
      });

      // Update local state
      setData(prev => prev.map(emp => {
        if (emp.employeeId === employeeId) {
          const newServices = { ...emp.services };
          const service = newServices[serviceCode];
          newServices[serviceCode] = {
            ...service,
            enabled: !currentEnabled,
            count: currentEnabled ? 0 : (currentCount || 1)
          };
          
          // Herbereken totaal
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
        }
        return emp;
      }));
      
      setSuccess('Opgeslagen!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      console.error('Error toggling service:', err);
      setError(err.message);
    }
  }

  async function handleCountChange(employeeId: string, serviceCode: string, newCount: number) {
    try {
      const serviceId = await getServiceIdByCode(serviceCode);
      if (!serviceId) throw new Error(`Dienst ${serviceCode} niet gevonden`);

      await upsertEmployeeService({
        employee_id: employeeId,
        service_id: serviceId,
        actief: true,
        aantal: newCount
      });

      // Update local state
      setData(prev => prev.map(emp => {
        if (emp.employeeId === employeeId) {
          const newServices = { ...emp.services };
          const service = newServices[serviceCode];
          newServices[serviceCode] = {
            ...service,
            count: newCount,
            enabled: true
          };
          
          // Herbereken totaal
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
        }
        return emp;
      }));

      setSuccess('Opgeslagen!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      console.error('Error updating count:', err);
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
            <h1 className="text-3xl font-bold text-gray-900">Diensten Toewijzing</h1>
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

        {/* Debug info */}
        <div className="mb-4 p-3 bg-blue-50 rounded text-xs">
          <p><strong>Debug Info:</strong></p>
          <p>Medewerkers geladen: {data.length}</p>
          <p>Dienst types: {serviceTypes.join(', ')}</p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 border-green-500 bg-green-50">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Tabel */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left font-semibold text-gray-700">Team</th>
                  <th className="border p-3 text-left font-semibold text-gray-700">Naam</th>
                  {serviceTypes.map(code => (
                    <th key={code} className="border p-3 text-center font-semibold text-gray-700">
                      {code}
                    </th>
                  ))}
                  <th className="border p-3 text-center font-semibold text-gray-700">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={serviceTypes.length + 3} className="border p-8 text-center text-gray-500">
                      Geen medewerkers gevonden
                    </td>
                  </tr>
                ) : (
                  data.map((employee) => (
                    <tr key={employee.employeeId} className="hover:bg-gray-50">
                      <td className="border p-3">
                        <span 
                          className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                            employee.team === 'Groen' 
                              ? 'bg-green-100 text-green-800'
                              : employee.team === 'Oranje'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {employee.team}
                        </span>
                      </td>
                      <td className="border p-3 font-medium">{employee.employeeName}</td>
                      {serviceTypes.map(code => {
                        const service = employee.services?.[code];
                        const enabled = service?.enabled || false;
                        const count = service?.count || 0;

                        return (
                          <td key={code} className="border p-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Checkbox
                                checked={enabled}
                                onCheckedChange={() => handleToggle(
                                  employee.employeeId,
                                  code,
                                  enabled
                                )}
                              />
                              {enabled && (
                                <Input
                                  type="number"
                                  min="0"
                                  max="35"
                                  value={count}
                                  onChange={(e) => handleCountChange(
                                    employee.employeeId,
                                    code,
                                    parseInt(e.target.value) || 0
                                  )}
                                  className="w-16 h-8 text-center"
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="border p-3 text-center font-semibold">
                        <span className={employee.isOnTarget ? 'text-green-600' : 'text-gray-900'}>
                          {employee.totalDiensten} / {employee.dienstenperiode}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Footer info */}
        <div className="mt-4 text-sm text-gray-600">
          <p>💡 <strong>Tip:</strong> Vink een dienst aan om deze toe te wijzen. Het getal geeft het aantal keer per periode aan.</p>
          <p className="mt-1">🎯 Groene getallen betekenen dat de medewerker op target is (totaal diensten = dienstenperiode).</p>
        </div>
      </div>
    </div>
  );
}
