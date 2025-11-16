'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RefreshCw, Check, FileDown } from 'lucide-react';
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
  const [exportingPDF, setExportingPDF] = useState(false);
  const [data, setData] = useState<EmployeeServiceRow[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

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
      
      // Toon klein groen vinkje
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
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

      // Toon klein groen vinkje
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
    } catch (err: any) {
      console.error('Error updating count:', err);
      setError(err.message);
    }
  }

  // PDF Export functie
  async function exportToPDF() {
    try {
      setExportingPDF(true);
      
      // Dynamische import om bundle size klein te houden
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      if (!tableRef.current) {
        throw new Error('Tabel niet gevonden');
      }

      // Maak screenshot van tabel
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      // A4 landscape formaat (297mm x 210mm)
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Marges
      const margin = 10;
      const availableWidth = pageWidth - (2 * margin);
      const availableHeight = pageHeight - (2 * margin) - 15; // 15mm voor header

      // Bereken schaling
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(availableWidth / (imgWidth * 0.264583), availableHeight / (imgHeight * 0.264583));
      
      const scaledWidth = (imgWidth * 0.264583) * ratio;
      const scaledHeight = (imgHeight * 0.264583) * ratio;

      // Centreer op pagina
      const xPos = (pageWidth - scaledWidth) / 2;
      const yPos = margin + 15; // Na header

      // Header met titel en datum/tijd
      const now = new Date();
      const dateStr = now.toLocaleDateString('nl-NL', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
      const timeStr = now.toLocaleTimeString('nl-NL', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('🧩 Diensten Toewijzing', margin, margin + 7);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Gegenereerd op: ${dateStr} om ${timeStr}`, pageWidth - margin, margin + 7, { align: 'right' });

      // Voeg afbeelding toe
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', xPos, yPos, scaledWidth, scaledHeight);

      // Genereer bestandsnaam: DienstenToewijzing20251116hhmm.pdf
      const fileDate = now.toISOString().slice(0, 10).replace(/-/g, '');
      const fileTime = now.toTimeString().slice(0, 5).replace(':', '');
      const fileName = `DienstenToewijzing${fileDate}${fileTime}.pdf`;

      // Download PDF
      pdf.save(fileName);
      
      console.log('✅ PDF exported:', fileName);
    } catch (err: any) {
      console.error('❌ Error exporting PDF:', err);
      setError('Fout bij genereren PDF: ' + err.message);
    } finally {
      setExportingPDF(false);
    }
  }

  // Helper functie om naam te trunceren
  function truncateName(name: string, max: number) {
    return name.length > max ? name.substring(0, max - 1) + '…' : name;
  }

  // Bereken team-counts per diensttype
  function calculateServiceCounts() {
    const counts = {
      Groen: {} as Record<string, number>,
      Oranje: {} as Record<string, number>,
      Overig: {} as Record<string, number>
    };
    
    // Initialiseer alle diensten met 0
    serviceTypes.forEach(code => {
      counts.Groen[code] = 0;
      counts.Oranje[code] = 0;
      counts.Overig[code] = 0;
    });
    
    // Tel werkelijke aantallen per team
    data.forEach(emp => {
      serviceTypes.forEach(code => {
        const service = emp.services?.[code];
        if (service?.enabled && service?.count > 0) {
          const team = emp.team === 'Groen' ? 'Groen' 
                     : emp.team === 'Oranje' ? 'Oranje' 
                     : 'Overig';
          counts[team][code] += service.count;
        }
      });
    });
    
    return counts;
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

  // Bereken counts dynamisch
  const serviceCounts = calculateServiceCounts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Card className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/services')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Terug naar Dashboard
              </Button>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
                <span className="text-2xl mr-3">🧩</span>
                Diensten Toewijzing
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Klein groen vinkje bij succesvolle save */}
              {success && (
                <div className="flex items-center gap-1 text-green-600 animate-pulse">
                  <Check className="w-5 h-5" />
                </div>
              )}
              <Button
                onClick={() => loadData()}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Vernieuwen
              </Button>
              <Button
                onClick={exportToPDF}
                variant="outline"
                size="sm"
                disabled={exportingPDF}
              >
                <FileDown className={`w-4 h-4 mr-2 ${exportingPDF ? 'animate-bounce' : ''}`} />
                {exportingPDF ? 'PDF wordt gegenereerd...' : 'PDF Export'}
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Tabel met sticky header */}
          <div className="overflow-x-auto" ref={tableRef}>
            <table className="w-full border-collapse">
              <thead>
                {/* Hoofdheader - STICKY */}
                <tr className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                  <th className="border p-3 text-left font-semibold text-gray-700 bg-gray-100">Team</th>
                  <th className="border p-3 text-left font-semibold text-gray-700 bg-gray-100">Naam</th>
                  <th className="border px-5 py-3 text-center font-semibold text-gray-700 min-w-[110px] bg-gray-100">Totaal</th>
                  {serviceTypes.map(code => (
                    <th key={code} className="border p-3 text-center font-semibold text-gray-700 bg-gray-100">
                      {code}
                    </th>
                  ))}
                </tr>
                {/* Team-tellers - STICKY onder hoofdheader */}
                <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-300 sticky z-10" style={{ top: '49px' }}>
                  <td colSpan={3} className="border p-3 text-sm text-gray-600 font-medium bg-gray-100">
                    Per team:
                  </td>
                  {serviceTypes.map(code => {
                    const groen = serviceCounts.Groen[code] || 0;
                    const oranje = serviceCounts.Oranje[code] || 0;
                    const overig = serviceCounts.Overig[code] || 0;
                    const totaal = groen + oranje + overig;
                    
                    return (
                      <td key={`count-${code}`} className="border p-2 bg-gray-50">
                        <div className="flex items-center justify-center gap-2 text-sm font-semibold tabular-nums">
                          <span className="text-green-700" title="Groen team">
                            {groen.toString().padStart(2, '0')}
                          </span>
                          <span className="text-orange-600" title="Oranje team">
                            {oranje.toString().padStart(2, '0')}
                          </span>
                          <span className="text-blue-600" title="Totaal alle teams">
                            {totaal.toString().padStart(2, '0')}
                          </span>
                        </div>
                      </td>
                    );
                  })}
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
                      <td className="border p-3 font-medium truncate w-[130px] max-w-[130px]">{truncateName(employee.employeeName, 12)}</td>
                      <td className="border px-5 py-3 text-center font-semibold min-w-[110px]">
                        <span className={employee.isOnTarget ? 'text-green-600' : 'text-gray-900'}>
                          {employee.totalDiensten} / {employee.dienstenperiode}
                        </span>
                      </td>
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
                              <Input
                                type="number"
                                min="0"
                                max="35"
                                value={enabled ? count : 0}
                                onChange={(e) => {
                                  if (enabled) {
                                    handleCountChange(
                                      employee.employeeId,
                                      code,
                                      parseInt(e.target.value) || 0
                                    );
                                  }
                                }}
                                disabled={!enabled}
                                className={`w-16 h-8 text-center transition-all ${
                                  !enabled 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                    : 'bg-white'
                                }`}
                              />
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

          {/* Footer info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
            <p>💡 <strong>Gebruik:</strong> Vink een dienst aan om deze toe te wijzen. Het getal geeft het aantal keer per periode aan.</p>
            <p className="mt-1">🎯 <strong>Doel:</strong> Groene getallen betekenen dat de medewerker op target is (totaal diensten = dienstenperiode).</p>
            <p className="mt-1">⚙️ <strong>Tip:</strong> Input velden met waarde 0 zijn uitgeschakeld maar blijven zichtbaar voor overzicht en ad-hoc planning.</p>
            <p className="mt-1">📊 <strong>Team-tellers:</strong> Tonen totaal aantal diensten per team (niet aantal medewerkers): <span className="text-green-700 font-semibold">Groen</span> <span className="text-orange-600 font-semibold">Oranje</span> <span className="text-blue-600 font-semibold">Totaal</span></p>
            <p className="mt-1">📄 <strong>PDF Export:</strong> Klik op 'PDF Export' om een printvriendelijke PDF te genereren met datum/tijd.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}