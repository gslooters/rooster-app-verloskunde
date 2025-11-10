// app/planning/period-staffing/page.tsx
// UI-component voor Diensten per Dag overzicht
import { useEffect, useState } from 'react';
import { getRosterPeriodStaffing, generateRosterPeriodStaffing, updateRosterPeriodStaffingMinMax, RosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';

// Locale util (NL weekinfo)
function getWeekNumber(dateStr: string) {
  const d = new Date(dateStr);
  d.setHours(0,0,0,0); d.setDate(d.getDate() + 4 - (d.getDay()||7));
  return Math.ceil((((d as any) - new Date(d.getFullYear(),0,1)) / 86400000 + 1)/7);
}

const dienstTypeKleuren: Record<string, string> = {
  dagdienst: '#E6F5D0',
  nachtdienst: '#FFEBEE',
  bereikbaarheidsdienst: '#F3E8FF',
};

export default function PeriodStaffingPage({ rosterId = "testrooster" }) {
  const [staffing, setStaffing] = useState<RosterPeriodStaffing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Indien nog geen data, initialiseer automatisch
      await generateRosterPeriodStaffing(rosterId, '2025-11-24', '2025-12-28');
      const records = await getRosterPeriodStaffing(rosterId);
      setStaffing(records);
      setLoading(false);
    }
    fetchData();
  }, [rosterId]);

  function handleChangeMinMax(id: string, min: number, max: number) {
    updateRosterPeriodStaffingMinMax(id, min, max).then(() => {
      setStaffing(list => list.map(s => s.id === id ? { ...s, minstaff: min, maxstaff: max } : s));
    });
  }

  // Groepeer per week -> per dag -> per dienst
  const weekGroups: Record<string, Record<string, RosterPeriodStaffing[]>> = {};
  staffing.forEach(entry => {
    const weekNum = getWeekNumber(entry.date);
    if (!weekGroups[weekNum]) weekGroups[weekNum] = {};
    if (!weekGroups[weekNum][entry.date]) weekGroups[weekNum][entry.date] = [];
    weekGroups[weekNum][entry.date].push(entry);
  });

  if (loading) return <div>Bezetting laden...</div>;

  return (
    <div style={{ fontFamily: 'Inter, Arial', fontSize: 14 }}>
      <h1>Bezetting per dag en dienst</h1>
      {Object.entries(weekGroups).map(([weekNum, days]) => (
        <div key={weekNum} style={{border:'1px solid #eee', padding:12, marginBottom:24}}>
          <h2 style={{marginBottom:6}}>Week {weekNum}</h2>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>Datum</th>
                <th style={{textAlign:'left'}}>Dienst</th>
                <th>Min</th>
                <th>Max</th>
                <th style={{textAlign:'left'}}>Team: Groen</th>
                <th>Team: Oranje</th>
                <th>Team: Totaal</th>
              </tr>
            </thead>
            <tbody>
            {Object.entries(days).map(([date, dienstArray]) => dienstArray.map(entry => (
                <tr key={entry.id} style={{background: dienstTypeKleuren[entry.serviceid] || '#FFF'}}>
                  <td>{date}</td>
                  <td>{entry.serviceid}</td>
                  <td>
                    <input type='number' min={0} max={30} value={entry.minstaff} style={{width:40}} onChange={e => handleChangeMinMax(entry.id, Number(e.target.value), entry.maxstaff)}/>
                  </td>
                  <td>
                    <input type='number' min={0} max={30} value={entry.maxstaff} style={{width:40}} onChange={e => handleChangeMinMax(entry.id, entry.minstaff, Number(e.target.value))}/>
                  </td>
                  <td>{entry.teamgro ? '✔️' : ''}</td>
                  <td>{entry.teamora ? '✔️' : ''}</td>
                  <td>{entry.teamtot ? '✔️' : ''}</td>
                </tr>
            )))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
