'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, toggleNBAssignment } from '@/lib/planning/rosterDesign';
import { getNBAssignmentsByRosterId } from '@/lib/services/roster-assignments-supabase';

export default function UnavailabilityClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = searchParams.get('rosterId');
  const [designData, setDesignData] = useState<any>(null);
  const [nbAssignments, setNbAssignments] = useState<Map<string, Set<string>>>(new Map());
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
        
        // ✅ FIX: Laad NB assignments uit database
        const nbMap = await getNBAssignmentsByRosterId(rosterId);
        setNbAssignments(nbMap);
        
        console.log('✅ Loaded unavailability data:', {
          rosterId,
          employeeCount: data?.employees?.length || 0,
          nbAssignmentsCount: nbMap.size
        });
      } catch (error) {
        console.error('❌ Error loading unavailability data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [rosterId, router]);

  async function handleToggleUnavailable(empId: string, date: string) {
    if (!rosterId) return;
    
    console.log('🔍 Toggle NB:', { rosterId, empId, date });
    
    const success = await toggleNBAssignment(rosterId, empId, date);
    
    if (success) {
      console.log('✅ Toggle succeeded, reloading data');
      
      // Herlaad NB assignments uit database
      const nbMap = await getNBAssignmentsByRosterId(rosterId);
      setNbAssignments(nbMap);
      
      // Ook designData herladen voor synchronisatie
      const updated = await loadRosterDesignData(rosterId);
      setDesignData(updated);
      
      console.log('✅ UI updated with new NB status');
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
            <strong>Instructie:</strong> Klik op een dag om een medewerker niet-beschikbaar (NB) te maken. Klik nogmaals om beschikbaar te maken. 
            Wijzigingen worden direct opgeslagen in de database.
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
              {designData.employees?.map((emp: any) => (
                <tr key={emp.id}>
                  <td className="border border-gray-300 p-3 font-medium bg-gray-50 sticky left-0 z-10">
                    {emp.voornaam || emp.name || 'Onbekend'}
                  </td>
                  {dates.map((date, idx) => {
                    const dateStr = date.toISOString().split('T')[0];
                    
                    // ✅ FIX: Check NB status uit roster_assignments database
                    const isUnavailable = nbAssignments.get(emp.id)?.has(dateStr) || false;
                    
                    return (
                      <td 
                        key={idx} 
                        className={`border border-gray-300 p-2 cursor-pointer text-center transition-colors ${
                          isUnavailable 
                            ? 'bg-red-200 hover:bg-red-300' 
                            : 'bg-white hover:bg-gray-100'
                        }`} 
                        onClick={()=>handleToggleUnavailable(emp.id, dateStr)}
                        title={isUnavailable ? 'Klik om beschikbaar te maken' : 'Klik om niet-beschikbaar te markeren'}
                      >
                        <span className="text-lg font-bold">
                          {isUnavailable ? '✕' : ''}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3 text-gray-900">Legenda</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white border border-gray-300 rounded"></div>
              <span className="text-gray-700">Beschikbaar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-200 border border-gray-300 rounded flex items-center justify-center text-lg font-bold">✕</div>
              <span className="text-gray-700">Niet Beschikbaar (NB)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-yellow-100 border border-gray-300 rounded"></div>
              <span className="text-gray-700">Weekend</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-center text-sm text-gray-600">
          Wijzigingen worden automatisch opgeslagen • 
          {nbAssignments.size > 0 && (
            <span className="text-blue-600 font-medium">
              {Array.from(nbAssignments.values()).reduce((total, dates) => total + dates.size, 0)} NB markering(en) geladen
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
