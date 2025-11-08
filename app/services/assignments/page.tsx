'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { getAllEmployeeServiceMappings, setServicesForEmployee } from '@/lib/services/medewerker-diensten-storage';
import { Dienst } from '@/lib/types/dienst';
import { Employee, TeamType, DienstverbandType } from '@/lib/types/employee';

const sortOrder = {
  teams: [TeamType.GROEN, TeamType.ORANJE, TeamType.OVERIG],
  dienstverband: [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP],
};
function medewerkerSort(a: Employee, b: Employee) {
  const teamSort =sortOrder.teams.indexOf(a.team)-sortOrder.teams.indexOf(b.team);
  if(teamSort!==0)return teamSort;
  const dbSort = sortOrder.dienstverband.indexOf(a.dienstverband)-sortOrder.dienstverband.indexOf(b.dienstverband);
  if(dbSort!==0)return dbSort;
  return a.voornaam.localeCompare(b.voornaam,'nl');
}

export default function ServiceAssignmentsTable() {
  const router=useRouter();
  const [services, setServices] = useState<Dienst[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [origMappings, setOrigMappings] = useState<Record<string,string[]>>({});
  const [mappings, setMappings] = useState<Record<string,string[]>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const firstRender = useRef(true);
  useEffect(()=>{
    async function loadAll() {
      const allServices = (await getAllServices()).filter(s=>s.actief);
      const allEmployees = getAllEmployees().filter(emp=>emp.actief);
      const allMappings = getAllEmployeeServiceMappings();
      setServices(allServices);
      setEmployees(allEmployees.sort(medewerkerSort));
      setOrigMappings(allMappings);
      setMappings(JSON.parse(JSON.stringify(allMappings)));
      setDirty(false);
      firstRender.current=false;
    }
    loadAll();
    const handler=(e: BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';return'';}};
    window.addEventListener('beforeunload',handler);
    return()=>window.removeEventListener('beforeunload',handler);
  },[]);
  // Changes alleen in ui-state! Pas bij opslaan naar storage
  const handleToggle=(empId:string,code:string)=>{
    setMappings(prev=>{
      const empCodes=prev[empId]||[];
      let nieuw;
      if(empCodes.includes(code)){
        nieuw=empCodes.filter(v=>v!==code);
      }else{
        nieuw=[...empCodes,code];
      }
      // dirty = alleen als huidig mapping differeert van origMappings
      const isDirty=Object.keys(origMappings).some(id=>{
        const ref=id===empId?nieuw:(prev[id]||[]);
        return JSON.stringify(ref)!==JSON.stringify(origMappings[id]||[]);
      });
      setDirty(isDirty);
      return {...prev,[empId]:nieuw};
    });
  };
  const handleSave=()=>{
    setSaving(true);
    Object.keys(mappings).forEach(empId=>{
      if(JSON.stringify(mappings[empId]||[])!==JSON.stringify(origMappings[empId]||[])){
        setServicesForEmployee(empId,mappings[empId]||[]);
      }
    });
    setSaving(false);
    setOrigMappings(JSON.parse(JSON.stringify(mappings)));
    setDirty(false);
  };
  function getServiceStats(serviceCode:string){
    return Object.values(mappings).filter(v=>v.includes(serviceCode)).length;
  }
  const TEAM_COLORS:Record<string,string>={
    Groen:'bg-green-100 text-green-800',
    Oranje:'bg-orange-100 text-orange-800',
    Overig:'bg-gray-100 text-gray-800',
  };
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
              >Terug vorig scherm</button>
              <button
                disabled={!dirty||saving}
                onClick={handleSave}
                className={`px-6 py-2 rounded-lg text-white font-bold shadow-md transition bg-blue-700 hover:bg-blue-800 mt-2 md:mt-0 ${!dirty||saving?'opacity-50 cursor-not-allowed':''}`}
              >
                {saving?'Bezig met opslaan...':'Opslaan'}
              </button>
            </div>
          </div>
          {dirty && <div className="mb-2"><span className="text-sm text-yellow-800 bg-yellow-50 px-3 py-1 rounded">Je hebt onopgeslagen wijzigingen!</span></div>}
          <div className="overflow-x-auto">
            <table className="min-w-full border table-fixed text-center ">
              <thead>...</thead>
              <tbody>...</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
