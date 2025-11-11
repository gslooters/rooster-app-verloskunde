'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { getEmployeeServicesMappings, setServicesForEmployee } from '@/lib/services/medewerker-diensten-supabase';
import { getAllEmployeeServiceMappings as fallbackLocal } from '@/lib/services/medewerker-diensten-storage';
import { Dienst } from '@/lib/types/dienst';
import { Employee, TeamType, DienstverbandType } from '@/lib/types/employee';

const sortOrder = {
  teams: [TeamType.GROEN, TeamType.ORANJE, TeamType.OVERIG],
  dienstverband: [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP],
};
const TEAM_TAGS: Record<string,string> = {
  Groen: 'bg-green-100 text-green-900 border-green-400',
  Oranje: 'bg-orange-100 text-orange-900 border-orange-400',
  Overig: 'bg-blue-100 text-blue-900 border-blue-400',
};
function medewerkerSort(a: Employee, b: Employee) {
  const teamSort =sortOrder.teams.indexOf(a.team)-sortOrder.teams.indexOf(b.team);
  if(teamSort!==0)return teamSort;
  const dbSort = sortOrder.dienstverband.indexOf(a.dienstverband)-sortOrder.dienstverband.indexOf(b.dienstverband);
  if(dbSort!==0)return dbSort;
  return a.voornaam.localeCompare(b.voornaam,'nl');
}

const SERVICE_PRIORITEIT = ['NB','==='];
const SERVICE_COLORS: Record<string,string> = {
  'NB':'bg-yellow-100 border-yellow-400',
  '===':'bg-green-100 border-green-400',
};

export default function ServiceAssignmentsTable() {
  const router = useRouter();
  const [services, setServices] = useState<Dienst[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [origMappings, setOrigMappings] = useState<Record<string,string[]>>({});
  const [mappings, setMappings] = useState<Record<string,string[]>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const firstRender = useRef(true);
  useEffect(()=>{
    async function loadAll() {
      setLoading(true);
      const allServices = (await getAllServices()).filter(s=>s.actief);
      // Gesorteerd: eerst NB en ===, daarna overige op code
      const prioritized = allServices.filter(s=>SERVICE_PRIORITEIT.includes(s.code));
      const rest = allServices.filter(s=>!SERVICE_PRIORITEIT.includes(s.code)).sort((a,b)=>a.code.localeCompare(b.code,'nl'));
      setServices([...prioritized,...rest]);
      const allEmployees = getAllEmployees().filter(emp=>emp.actief).sort(medewerkerSort);
      setEmployees(allEmployees);
      let allMappings: Record<string, string[]> = {};
      try {
        allMappings = await getEmployeeServicesMappings();
        if (!allMappings || typeof allMappings !== 'object') allMappings = {};
      } catch (err) {
        allMappings = fallbackLocal();
      }
      setOrigMappings(allMappings);
      setMappings(JSON.parse(JSON.stringify(allMappings)));
      setDirty(false);
      setLoading(false);
      firstRender.current=false;
    }
    loadAll();
    const handler=(e: BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';return'';}};
    window.addEventListener('beforeunload',handler);
    return()=>window.removeEventListener('beforeunload',handler);
  },[]);
  // Verbeterde dirty-detection: elk verschil (ook als user/rij nieuw is)
  const handleToggle=(empId:string,code:string)=>{
    setMappings(prev=>{
      const empCodes=prev[empId]||[];
      let nieuw;
      if(empCodes.includes(code)){
        nieuw=empCodes.filter(v=>v!==code);
      }else{
        nieuw=[...empCodes,code];
      }
      // Verbeterde dirty-check - alle ids!
      const allIds = new Set([...Object.keys(origMappings), ...Object.keys(prev), empId]);
      const isDirty = [...allIds].some(id => {
        const current = id===empId? nieuw : (prev[id]||[]);
        return JSON.stringify(current)!==JSON.stringify(origMappings[id]||[]);
      });
      setDirty(isDirty);
      return {...prev,[empId]:nieuw};
    });
  };
  // Extra logging + feedback voor save errors
  const handleSave=async()=>{
    setSaving(true);
    let hadErrors = false;
    await Promise.all(Object.keys(mappings).map(async empId=>{
      if(JSON.stringify(mappings[empId]||[])!==JSON.stringify(origMappings[empId]||[])){
        try {
          await setServicesForEmployee(empId,mappings[empId]||[]);
        } catch(e) {
          hadErrors = true;
          console.error('Opslaan voor medewerker', empId, 'mislukt:', e);
          localStorage.setItem('employeeServiceMappings', JSON.stringify(mappings));
        }
      }
    }));
    setSaving(false);
    setOrigMappings(JSON.parse(JSON.stringify(mappings)));
    setDirty(false);
    if(hadErrors) {
      alert('Niet alle wijzigingen konden worden opgeslagen. Controleer je internetverbinding of vraag de beheerder om hulp.');
    }
  };
  function cellAssigned(empId: string, code: string) {
    return (mappings[empId]||[]).includes(code);
  }
  const getDienstKolomStijl = (s: Dienst) => {
    if (s.code==='NB') return 'border font-bold bg-yellow-50 text-yellow-700 w-14 max-w-[5ch]';
    if (s.code==='===') return 'border font-bold bg-green-50 text-green-700 w-14 max-w-[5ch]';
    return 'border font-bold bg-blue-50 text-blue-900 w-14 max-w-[5ch]';
  };
  const getTeamTag = (team: string) => {
    const display = team==='Groen'? 'Groen': team==='Oranje'? 'Oranje':'Overig';
    return (
      <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${TEAM_TAGS[display]} h-6 min-w-[38px] items-center justify-center`}>
        {display}
      </span>
    );
  };
  if (loading) {
    return <div className="p-10 text-xl">Laden...</div>;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 overflow-x-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-3 md:mb-5 gap-2 md:gap-0">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900 flex items-center mb-0 md:mb-0"><span className="text-xl mr-3">🧩</span>Diensten Toewijzing</h1>
            </div>
            <div className="flex flex-row gap-4 items-end">
              <button
                onClick={()=>router.back()}
                className="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium shadow-none border-gray-200"
                type="button"
              >← Terug naar Dashboard</button>
              <button
                disabled={!dirty||saving}
                onClick={handleSave}
                className={`px-6 py-2 rounded-lg text-white font-bold shadow-md transition bg-purple-600 hover:bg-purple-700 mt-2 md:mt-0 ${!dirty||saving?'opacity-50 cursor-not-allowed':''}`}
              >
                {saving?'Bezig met opslaan...':'Opslaan en Doorgaan →'}
              </button>
            </div>
          </div>
          {dirty && <div className="mb-2"><span className="text-sm text-yellow-800 bg-yellow-50 px-3 py-1 rounded">Je hebt onopgeslagen wijzigingen!</span></div>}
          <div className="overflow-x-auto">
            <table className="min-w-full border table-fixed text-center ">
              <thead>
                <tr>
                  <th className="border bg-gray-50 w-20 text-center px-1 py-1">Team</th>
                  <th className="border bg-gray-50 w-28 text-left px-2 py-1">Naam</th>
                  {services.map((s)=>(
                    <th key={s.code} className={getDienstKolomStijl(s)+" px-1 py-1"}><b>{s.code}</b></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp=>(
                  <tr key={emp.id} className="border-b border-gray-100">
                    <td className="border bg-gray-50 text-center px-0 py-1">{getTeamTag(emp.team)}</td>
                    <td className="border bg-gray-50 text-left px-1 py-1"><span className="whitespace-nowrap font-medium text-gray-900">{emp.voornaam}</span></td>
                    {services.map(s=>(
                      <td
                        key={s.code}
                        onClick={()=>handleToggle(emp.id,s.code)}
                        className={
                          "border cursor-pointer transition duration-200 w-14 max-w-[5ch] overflow-hidden text-ellipsis "+
                          (cellAssigned(emp.id,s.code)
                            ? ((SERVICE_COLORS[s.code]||'bg-blue-100 border-blue-400')+ ' ring-2 ring-blue-500')
                            : 'bg-white opacity-45 hover:bg-blue-50'
                          )
                        }
                        title={cellAssigned(emp.id,s.code)?'Dienst toegekend':'Niet toegekend'}
                        style={{maxWidth:'5ch'}}
                      >
                        {cellAssigned(emp.id,s.code) ? '✔' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length===0&&<div className="p-3">Geen medewerkers gevonden.</div>}
            {services.length===0&&<div className="p-3">Geen diensten geregistreerd.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}