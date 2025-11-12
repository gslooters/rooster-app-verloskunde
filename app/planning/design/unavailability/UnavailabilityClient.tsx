'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, toggleNBAssignment } from '@/lib/planning/rosterDesign';

export default function UnavailabilityClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = searchParams.get('rosterId');
  const [designData, setDesignData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rosterId) {
      router.push('/planning');
      return;
    }
    (async function loadData() {
      const data = await loadRosterDesignData(rosterId);
      setDesignData(data);
      setLoading(false);
    })();
  }, [rosterId, router]);

  async function handleToggleUnavailable(empId: string, date: string) {
    if (!rosterId) return;
    const success = await toggleNBAssignment(rosterId, empId, date);
    if (success) {
      // Herlaad data
      const updated = await loadRosterDesignData(rosterId);
      setDesignData(updated);
    } else {
      alert('Fout bij opslaan niet-beschikbaarheid');
    }
  }

  if (loading) {
    return (<div className="min-h-screen flex items-center justify-center"><div>Laden...</div></div>);
  }
  if (!designData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6"><h2 className="text-lg font-semibold text-red-800">Fout</h2><p className="text-red-600">Geen rooster data</p><button onClick={()=>router.push('/planning')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Terug</button></div>
      </div>
    );
  }
  const startDate = new Date(designData.start_date || Date.now());
  const dates: Date[] = Array(35).fill(0).map((_, i) => { let d = new Date(startDate); d.setDate(startDate.getDate() + i); return d; });

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Niet Beschikbaar aanpassen</h1>
            <p className="text-gray-600 text-sm">Klik op een cel om een medewerker niet-beschikbaar te markeren</p>
          </div>
          <button onClick={()=>router.push('/planning/design?rosterId=' + rosterId)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">← Terug</button>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 bg-gray-100 sticky left-0 z-10">Medewerker</th>
                {dates.map((date, idx) => (
                  <th key={idx} className="border p-2 bg-gray-100 text-xs"><div>{['Zo','Ma','Di','Wo','Do','Vr','Za'][date.getDay()]}</div><div>{date.getDate()}/{date.getMonth()+1}</div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {designData.employees?.map((emp: any) => (
                <tr key={emp.id}>
                  <td className="border p-2 font-medium bg-gray-50 sticky left-0 z-10">{emp.name}</td>
                  {dates.map((date, idx) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isUnavailable = designData.unavailabilityData?.[emp.id]?.[dateStr];
                    return (
                      <td key={idx} className={`border p-2 cursor-pointer text-center ${isUnavailable ? 'bg-red-200 hover:bg-red-300' : 'bg-white hover:bg-gray-100'}`} onClick={()=>handleToggleUnavailable(emp.id, dateStr)}>{isUnavailable ? '✗' : ''}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 bg-white rounded-lg p-4"><h3 className="font-semibold mb-2">Legenda</h3><div className="flex gap-4 text-sm"><div className="flex items-center gap-2"><div className="w-6 h-6 bg-white border"></div><span>Beschikbaar</span></div><div className="flex items-center gap-2"><div className="w-6 h-6 bg-red-200 border"></div><span>Niet Beschikbaar</span></div></div></div>
      </div>
    </div>
  );
}
