import { useState, useEffect, useRef } from 'react';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { getAllEmployeeServiceMappings, setServicesForEmployee } from '@/lib/services/medewerker-diensten-storage';
import { Dienst } from '@/lib/types/dienst';
import { Employee, TeamType, DienstverbandType } from '@/lib/types/employee';

// Helper sortfunctie volgens gewenste volgorde
const sortOrder = {
  teams: [TeamType.GROEN, TeamType.ORANJE, TeamType.OVERIG],
  dienstverband: [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP],
};
function medewerkerSort(a: Employee, b: Employee) {
  // Team
  const teamSort =sortOrder.teams.indexOf(a.team) - sortOrder.teams.indexOf(b.team);
  if (teamSort !== 0) return teamSort;
  // Dienstverband
  const dbSort = sortOrder.dienstverband.indexOf(a.dienstverband)-sortOrder.dienstverband.indexOf(b.dienstverband);
  if (dbSort !== 0) return dbSort;
  // Voornaam
  return a.voornaam.localeCompare(b.voornaam, 'nl');
}

export default function ServiceAssignmentsTable() {
  const [services, setServices] = useState<Dienst[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [origMappings, setOrigMappings] = useState<Record<string, string[]>>({});
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const warnReset = useRef(false);
  
  useEffect(() => {
    loadData();
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  
  const loadData = () => {
    const allServices = getAllServices().filter(s => s.actief);
    const allEmployees = getAllEmployees().filter(emp => emp.actief);
    const allMappings = getAllEmployeeServiceMappings();
    setServices(allServices);
    setEmployees(allEmployees.sort(medewerkerSort));
    setOrigMappings(allMappings);
    setMappings(JSON.parse(JSON.stringify(allMappings)));
    setDirty(false);
  };

  const handleToggle = (empId: string, code: string) => {
    setMappings(prev => {
      const empCodes = prev[empId] || [];
      let nieuw;
      if (empCodes.includes(code)) {
        nieuw = empCodes.filter(v => v !== code);
      } else {
        nieuw = [...empCodes, code];
      }
      const nieuwMap = { ...prev, [empId]: nieuw };
      setDirty(true);
      return nieuwMap;
    });
  };

  const handleSave = () => {
    setSaving(true);
    Object.keys(mappings).forEach(empId => {
      if (JSON.stringify(mappings[empId]||[]) !== JSON.stringify(origMappings[empId]||[])) {
        setServicesForEmployee(empId, mappings[empId]||[]);
      }
    });
    setSaving(false);
    setOrigMappings(JSON.parse(JSON.stringify(mappings)));
    setDirty(false);
  };

  // Tellers
  function getServiceStats(serviceCode: string) {
    return Object.values(mappings).filter(v => v.includes(serviceCode)).length;
  }

  // Teamkleuren visual (voor display in tabel)
  const TEAM_COLORS: Record<string, string> = {
    Groen: 'bg-green-100 text-green-800',
    Oranje: 'bg-orange-100 text-orange-800',
    Overig: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 overflow-x-auto">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
            <span className="text-xl mr-3">🧩</span>
            Diensten Toewijzing
          </h1>
          <p className="mb-5 text-gray-600">Configureer snel via een overzichtelijke tabel welke diensten je medewerkers kunnen uitvoeren. Je wijzigingen worden pas opgeslagen na klikken op <strong>Opslaan</strong>.</p>

          <div className="overflow-x-auto">
            <table className="min-w-full border table-fixed text-center">
              <thead>
                <tr>
                  <th className="bg-blue-50 font-bold text-left px-2 py-1">Team / Naam</th>
                  {services.map(service => (
                    <th key={service.code} className="px-1 py-1 align-bottom">
                      <div className="font-semibold text-sm truncate" title={service.naam}>{service.code}</div>
                      <div className="text-xs text-gray-500">{getServiceStats(service.code)}<br/>medew.</div>
                      <div className="flex justify-center mt-1">
                        <div className="w-4 h-4 rounded-full" style={{ background: service.kleur }} title={service.naam}></div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(employee => (
                  <tr key={employee.id}>
                    <td className="text-left px-2 py-1 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded mr-1 text-xs ${TEAM_COLORS[employee.team]}`}>{employee.team}</span>
                      {employee.voornaam}
                      <span className="ml-2 text-xs text-gray-400">({employee.dienstverband})</span>
                    </td>
                    {services.map(service => {
                      const checked = (mappings[employee.id] || []).includes(service.code);
                      return (
                        <td key={service.code}>
                          <button
                            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto transition-all focus:outline-none
                              ${checked
                                ? 'bg-blue-600 border-blue-700 text-white shadow-md font-extrabold'
                                : 'bg-gray-50 border-gray-300 text-gray-300'}
                            `}
                            style={{ boxShadow: checked ? '0 0 2px 1px #62aaff80' : '' }}
                            aria-label={`Dienst ${service.code} voor ${employee.voornaam}`}
                            onClick={() => handleToggle(employee.id, service.code)}
                            tabIndex={0}
                          >
                            {checked ? '✓' : ''}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col md:flex-row gap-2 md:gap-5 mt-5 items-center">
            <button
              disabled={!dirty||saving}
              onClick={handleSave}
              className={`px-6 py-2 rounded-lg text-white font-bold shadow-md transition bg-blue-700 hover:bg-blue-800 
                ${!dirty || saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? 'Bezig met opslaan...' : 'Opslaan'}
            </button>
            {dirty && <span className="text-sm text-yellow-800 bg-yellow-50 px-3 py-1 rounded">Je hebt onopgeslagen wijzigingen!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
