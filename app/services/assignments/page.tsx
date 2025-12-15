'use client';

// CRITICAL: Force dynamic rendering - no caching whatsoever
// Reason: This page uses Supabase client to fetch real-time data
// Static generation would fail because Supabase env vars aren't available at build time
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RefreshCw, Check, FileDown } from 'lucide-react';

// LAZY IMPORT: Delay Supabase import until client-side rendering
// This prevents "supabaseUrl is required" error during static generation
let getEmployeeServicesOverview: any;
let upsertEmployeeService: any;
let getServiceIdByCode: any;
let supabase: any;
let EmployeeServiceRow: any;

const loadSupabaseModules = async () => {
  if (!getEmployeeServicesOverview) {
    const mod = await import('@/lib/services/medewerker-diensten-supabase');
    getEmployeeServicesOverview = mod.getEmployeeServicesOverview;
    upsertEmployeeService = mod.upsertEmployeeService;
    getServiceIdByCode = mod.getServiceIdByCode;
    supabase = mod.supabase;
    
    const typesModule = await import('@/lib/types/employee-services');
    EmployeeServiceRow = typesModule.EmployeeServiceRow;
  }
};

export default function DienstenToewijzingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [data, setData] = useState<any[]>([]);
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
      
      // Load Supabase modules FIRST, client-side only
      await loadSupabaseModules();
      
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
      
      const serviceCodes = services?.map((s: any) => s.code) || [];
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
      await loadSupabaseModules();
      const serviceId = await getServiceIdByCode(serviceCode);
      if (!serviceId) {
        throw new Error(`Dienst ${serviceCode} niet gevonden`);
      }

      // Vind huidge count
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
      await loadSupabaseModules();
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

  // PDF Export functie - VERSIE 2 MET KLEUR & FORMAT FIXES
  async function exportToPDF() {
    try {
      setExportingPDF(true);
      
      // Dynamische import van jsPDF en autoTable plugin
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      // Initialiseer jsPDF met compressie
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Gebruik Helvetica font voor correcte text encoding
      doc.setFont('helvetica', 'normal');
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      
      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Diensten Toewijzing', margin, margin + 5);
      
      // Datum en tijd
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
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Datum: ${dateStr} om ${timeStr}`, pageWidth - margin, margin + 5, { align: 'right' });
      
      // Bereken team counts
      const serviceCounts = calculateServiceCounts();
      
      // Bouw tabel data
      const tableData = [];
      
      // Header rij
      const headerRow = ['Team', 'Naam', 'Totaal'];
      serviceTypes.forEach(code => {
        headerRow.push(code);
      });
      tableData.push(headerRow);
      
      // Team counts rij - FIX: Format met leading zeros
      const teamCountRow = ['', 'Per team:', ''];
      serviceTypes.forEach(code => {
        const groen = (serviceCounts.Groen[code] || 0).toString().padStart(2, '0');
        const oranje = (serviceCounts.Oranje[code] || 0).toString().padStart(2, '0');
        const totaal = ((serviceCounts.Groen[code] || 0) + (serviceCounts.Oranje[code] || 0) + (serviceCounts.Overig[code] || 0)).toString().padStart(2, '0');
        teamCountRow.push(`${groen} ${oranje} ${totaal}`);
      });
      tableData.push(teamCountRow);
      
      // Data rijen - FIX: Getallen met leading zeros en tracking voor kleur
      const rowsWithTeam: Array<{row: any[], team: string}> = [];
      data.forEach(emp => {
        const row = [
          emp.team || '',
          emp.employeeName || '',
          `${emp.totalDiensten} / ${emp.dienstenperiode}`
        ];
        
        serviceTypes.forEach(code => {
          const service = emp.services?.[code];
          const count = service?.enabled ? (service?.count || 0) : 0;
          // FIX 1: Format met leading zero (##)
          row.push(count.toString().padStart(2, '0'));
        });
        
        tableData.push(row);
        rowsWithTeam.push({ row, team: emp.team || '' });
      });
      
      // Genereer tabel met autoTable
      (doc as any).autoTable({
        head: [tableData[0]],
        body: tableData.slice(1),
        startY: margin + 12,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          halign: 'center',
          valign: 'middle',
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 20, halign: 'left' },
          1: { cellWidth: 35, halign: 'left' },
          2: { cellWidth: 25, halign: 'center' }
        },
        didParseCell: function(hookData: any) {
          // Kleur team kolom
          if (hookData.section === 'body' && hookData.column.index === 0) {
            const teamNaam = hookData.cell.raw;
            if (teamNaam === 'Groen') {
              hookData.cell.styles.fillColor = [144, 238, 144];
            } else if (teamNaam === 'Oranje') {
              hookData.cell.styles.fillColor = [255, 200, 124];
            } else if (teamNaam === 'Overig') {
              hookData.cell.styles.fillColor = [173, 216, 230];
            }
          }
          
          // Team counts rij opmaak
          if (hookData.section === 'body' && hookData.row.index === 0) {
            hookData.cell.styles.fillColor = [240, 240, 240];
            hookData.cell.styles.fontStyle = 'bold';
          }
          
          // FIX 1: Kleur de getallen per team (kolom 3 en hoger)
          if (hookData.section === 'body' && hookData.row.index > 0 && hookData.column.index >= 3) {
            // Bepaal het team van deze rij (row.index - 1 omdat eerste rij team counts is)
            const dataRowIndex = hookData.row.index - 1;
            if (dataRowIndex >= 0 && dataRowIndex < rowsWithTeam.length) {
              const team = rowsWithTeam[dataRowIndex].team;
              
              // Zet text kleur op basis van team
              if (team === 'Groen') {
                hookData.cell.styles.textColor = [0, 128, 0];  // Groen
              } else if (team === 'Oranje') {
                hookData.cell.styles.textColor = [255, 140, 0];  // Oranje
              } else if (team === 'Overig') {
                hookData.cell.styles.textColor = [0, 0, 255];  // Blauw
              }
            }
          }
        }
      });
      
      // FIX 2: Footer tekst VERWIJDERD (was: Gebruik instructies en Team-tellers)
      // Geen footer meer nodig
      
      // Bestandsnaam met timestamp
      const fileDate = now.toISOString().slice(0, 10).replace(/-/g, '');
      const fileTime = now.toTimeString().slice(0, 5).replace(':', '');
      const fileName = `DienstenToewijzing${fileDate}${fileTime}.pdf`;
      
      // Opslaan met compressie
      doc.save(fileName);
      
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