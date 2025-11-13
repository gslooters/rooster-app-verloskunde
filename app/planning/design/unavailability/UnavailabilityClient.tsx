'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, toggleNBAssignment } from '@/lib/planning/rosterDesign';
import { getAllAssignmentsByRosterId } from '@/lib/services/roster-assignments-supabase';

export default function UnavailabilityClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = searchParams.get('rosterId');
  const [designData, setDesignData] = useState<any>(null);
  const [allAssignments, setAllAssignments] = useState<Map<string, Map<string, string>>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rosterId) {
      router.push('/planning');
      return;
    }
    (async function loadData() {
      try {
        const data = await loadRosterDesignData(rosterId);
        setDesignData(data);
        
        // ✅ FIX DRAAD 26O: Laad ALLE assignments uit database (niet alleen NB)
        const assignmentMap = await getAllAssignmentsByRosterId(rosterId);
        setAllAssignments(assignmentMap);
        
        console.log('✅ Loaded unavailability data:', {
          rosterId,
          employeeCount: data?.employees?.length || 0,
          totalAssignments: Array.from(assignmentMap.values()).reduce((sum, map) => sum + map.size, 0)
        });
      } catch (error) {
        console.error('❌ Error loading unavailability data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [rosterId, router]);

  async function handleToggleUnavailable(emp: any, date: string) {
    if (!rosterId) return;
    
    // ✅ FIX DRAAD 26O: Gebruik originalEmployeeId (emp1) ipv snapshot ID (re_emp1)
    const employeeId = emp.originalEmployeeId || emp.id;
    
    console.log('🔍 Toggle NB click:', { 
      rosterId, 
      employeeId, 
      date,
      empName: emp.voornaam || emp.name
    });
    
    // Check huidige status
    const currentServiceCode = allAssignments.get(employeeId)?.get(date);
    
    console.log('📊 Current service code:', currentServiceCode || 'null (leeg)');
    
    // ✅ DRAAD 26O: Logica volgens specificatie
    if (currentServiceCode && currentServiceCode !== 'NB') {
      // Er staat een andere dienst dan NB -> NIET TOEGESTAAN
      alert(
        `Wijziging is niet mogelijk in dit scherm\n\n` +
        `Op ${date} staat voor ${emp.voornaam || emp.name} de dienst "${currentServiceCode}" ingepland.\n\n` +
        `Verwijder eerst deze dienst in het hoofdrooster voordat je NB kunt instellen.`
      );
      console.log('⚠️  Toggle geblokkeerd - andere dienst aanwezig:', currentServiceCode);
      return;
    }
    
    // Als currentServiceCode === null of === 'NB' -> toggle mag
    const success = await toggleNBAssignment(rosterId, employeeId, date);
    
    if (success) {
      console.log('✅ Toggle succeeded, reloading data');
      
      // Herlaad ALLE assignments uit database
      const assignmentMap = await getAllAssignmentsByRosterId(rosterId);
      setAllAssignments(assignmentMap);
      
      // Ook designData herladen voor synchronisatie
      const updated = await loadRosterDesignData(rosterId);
      setDesignData(updated);
      
      console.log('✅ UI updated with new assignment status');
    } else {
      console.error('❌ Toggle failed');
      alert('Fout bij opslaan niet-beschikbaarheid. Check console voor details.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Niet-beschikbaarheid wordt geladen...</p>
        </div>
      </div>
    );
  }
  
  if (!designData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2>
          <p className="text-red-600 mb-4">Geen rooster data gevonden</p>
          <button onClick={()=>router.push('/planning')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Terug naar overzicht</button>
        </div>
      </div>
    );
  }
  
  const startDate = new Date(designData.start_date || Date.now());
  const dates: Date[] = Array(35).fill(0).map((_, i) => { 
    let d = new Date(startDate); 
    d.setDate(startDate.getDate() + i); 
    return d; 
  });

  // Tel totaal aantal NB markeringen
  const totalNBCount = Array.from(allAssignments.values()).reduce(
    (sum, dateMap) => sum + Array.from(dateMap.values()).filter(code => code === 'NB').length,
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Niet Beschikbaar aanpassen</h1>
            <p className="text-gray-600 text-sm">Klik op een cel om een medewerker niet-beschikbaar te markeren (rood = NB)</p>
          </div>
          <button 
            onClick={()=>router.push(`/planning/design/dashboard?rosterId=${rosterId}`)} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <span>←</span>
            <span>Terug naar Dashboard</span>
          </button>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            <strong>Instructie:</strong> Klik op een <strong>lege cel</strong> om een medewerker niet-beschikbaar (NB) te maken. 
            Klik op een <strong>rode cel (NB)</strong> om deze beschikbaar te maken. 
            <strong>Cellen met andere diensten</strong> (zwart op wit) kunnen hier niet worden gewijzigd.
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 p-3 bg-gray-100 sticky left-0 z-10 font-semibold text-gray-900">Medewerker</th>
                {dates.map((date, idx) => {
                  const dayOfWeek = date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  return (
                    <th 
                      key={idx} 
                      className={`border border-gray-300 p-2 text-xs font-medium ${
                        isWeekend ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold">{['Zo','Ma','Di','Wo','Do','Vr','Za'][dayOfWeek]}</div>
                      <div className="text-gray-600">{date.getDate()}/{date.getMonth()+1}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {designData.employees?.map((emp: any) => {
                // ✅ FIX DRAAD 26O: Gebruik originalEmployeeId voor lookup
                const employeeId = emp.originalEmployeeId || emp.id;
                const employeeAssignments = allAssignments.get(employeeId) || new Map();
                
                return (
                  <tr key={emp.id}>
                    <td className="border border-gray-300 p-3 font-medium bg-gray-50 sticky left-0 z-10">
                      {emp.voornaam || emp.name || 'Onbekend'}
                    </td>
                    {dates.map((date, idx) => {
                      const dateStr = date.toISOString().split('T')[0];
                      const serviceCode = employeeAssignments.get(dateStr);
                      
                      // ✅ DRAAD 26O: 3 states bepalen
                      const isNB = serviceCode === 'NB';
                      const hasOtherService = serviceCode && serviceCode !== 'NB';
                      const isEmpty = !serviceCode;
                      
                      // Styling op basis van state
                      let cellClass = 'border border-gray-300 p-2 text-center transition-colors ';
                      let cursorClass = '';
                      let title = '';
                      
                      if (isNB) {
                        cellClass += 'bg-red-200 ';
                        cursorClass = 'cursor-pointer hover:bg-red-300';
                        title = 'Klik om beschikbaar te maken';
                      } else if (hasOtherService) {
                        cellClass += 'bg-white ';
                        cursorClass = 'cursor-not-allowed';
                        title = `Dienst "${serviceCode}" - wijziging niet mogelijk in dit scherm`;
                      } else {
                        cellClass += 'bg-white ';
                        cursorClass = 'cursor-pointer hover:bg-gray-100';
                        title = 'Klik om niet-beschikbaar te markeren';
                      }
                      
                      return (
                        <td 
                          key={idx} 
                          className={cellClass + cursorClass}
                          onClick={() => handleToggleUnavailable(emp, dateStr)}
                          title={title}
                        >
                          {isNB && (
                            <span className="text-lg font-bold text-red-800">✕</span>
                          )}
                          {hasOtherService && (
                            <span className="text-sm font-medium text-gray-900">{serviceCode}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3 text-gray-900">Legenda</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white border border-gray-300 rounded"></div>
              <span className="text-gray-700">Beschikbaar (leeg)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-200 border border-gray-300 rounded flex items-center justify-center text-lg font-bold text-red-800">✕</div>
              <span className="text-gray-700">Niet Beschikbaar (NB)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white border border-gray-300 rounded flex items-center justify-center text-xs font-medium text-gray-900">DD</div>
              <span className="text-gray-700">Andere dienst (zwart op wit - niet wijzigbaar)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-yellow-100 border border-gray-300 rounded"></div>
              <span className="text-gray-700">Weekend (header)</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-center text-sm text-gray-600">
          Wijzigingen worden automatisch opgeslagen • 
          {totalNBCount > 0 && (
            <span className="text-blue-600 font-medium">
              {' '}{totalNBCount} NB markering(en) geladen
            </span>
          )}
        </div>
      </div>
    </div>
  );
}