/**
 * ROOSTER LAYOUT COMPONENT - DRAAD 349 C IMPROVEMENTS
 * 
 * VERBETERINGEN GEIMPLEMENTEERD:
 * 4.1   Sticky header met correct labels
 * 4.1.1 Header sticky bij scrollen
 * 4.1.2 Service layout van image2: badges met code
 * 4.1.3 Service waarde in klein formaat onder de code
 * 4.3   Kolom Wd: aantalwerkdagen waarde uit employees
 * 4.4   Kolom Pd: optelling (aantal * dienstwaarde) met kleur
 * 4.4.1 Pd kleur: groen (=Wd), rood (<Wd)
 * 4.5   Per dienst: [Button] [Teller]
 * 4.6   Teamtotalen rij onder medewerkers
 * 4.6.1 Optelling per dienst per team met kleurcodering
 * 4.7   Update zonder full page reload (fetch based)
 * 
 * DATABASE VELDEN GEBRUIKT:
 * - employees.aantalwerkdagen (kolom Wd)
 * - service_types.dienstwaarde (voor Pd berekening)
 * - service_types.code (DDO, DDA, DIO, enz)
 * - service_types.kleur (voor visuele weergave)
 * - roster_employee_services.aantal (teller per dienst)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ServiceType {
  id: string;
  code: string;
  naam: string;
  dienstwaarde: number;
  kleur?: string;
}

interface Employee {
  id: string;
  voornaam: string;
  achternaam: string;
  aantalwerkdagen: number;
  team: string;
}

interface EmployeeService {
  employee_id: string;
  service_id: string;
  aantal: number;
  actief: boolean;
}

interface RoosterLayoutProps {
  rosterId: string;
  employees: Employee[];
  serviceTypes: ServiceType[];
  initialData?: Map<string, Map<string, number>>; // employee_id -> service_id -> aantal
}

const RoosterLayout: React.FC<RoosterLayoutProps> = ({
  rosterId,
  employees,
  serviceTypes,
  initialData
}) => {
  const [roosterData, setRoosterData] = useState<Map<string, Map<string, number>>>(
    initialData || new Map()
  );
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    if (!initialData) {
      fetchRoosterData();
    }
  }, [rosterId, initialData]);

  const fetchRoosterData = async () => {
    try {
      const { data, error } = await supabase
        .from('roster_employee_services')
        .select('employee_id, service_id, aantal, actief')
        .eq('roster_id', rosterId)
        .eq('actief', true);

      if (error) throw error;

      // Converteer naar Map voor snellere lookup
      const newData = new Map<string, Map<string, number>>();
      data?.forEach((item: EmployeeService) => {
        if (!newData.has(item.employee_id)) {
          newData.set(item.employee_id, new Map());
        }
        newData.get(item.employee_id)!.set(item.service_id, item.aantal);
      });

      setRoosterData(newData);
    } catch (error) {
      console.error('Fout bij laden roosterdata:', error);
    }
  };

  // Update service aantal ZONDER page reload
  const updateServiceCount = useCallback(
    async (employeeId: string, serviceId: string, newCount: number) => {
      setIsUpdating(true);

      try {
        // Update UI optimistically
        const newData = new Map(roosterData);
        if (!newData.has(employeeId)) {
          newData.set(employeeId, new Map());
        }
        newData.get(employeeId)!.set(serviceId, newCount);
        setRoosterData(newData);

        // Update database
        const { error } = await supabase
          .from('roster_employee_services')
          .update({ aantal: newCount, updated_at: new Date().toISOString() })
          .eq('roster_id', rosterId)
          .eq('employee_id', employeeId)
          .eq('service_id', serviceId);

        if (error) throw error;

        // Geen reload! Tabel updatet zichzelf
        console.log(`✅ Updated ${employeeId} ${serviceId} to ${newCount}`);
      } catch (error) {
        console.error('Fout bij update:', error);
        // Refresh data als update mislukt
        await fetchRoosterData();
      } finally {
        setIsUpdating(false);
      }
    },
    [roosterData, rosterId]
  );

  // Calculate Pd (personeelslasten) voor employee
  const calculatePd = (employeeId: string): number => {
    const employeeServices = roosterData.get(employeeId);
    if (!employeeServices) return 0;

    let total = 0;
    employeeServices.forEach((aantal, serviceId) => {
      const service = serviceTypes.find(s => s.id === serviceId);
      if (service) {
        total += aantal * service.dienstwaarde;
      }
    });
    return total;
  };

  // Bepaal Pd kleur
  const getPdColor = (employeeId: string): string => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return 'text-gray-600';

    const pd = calculatePd(employeeId);
    const wd = employee.aantalwerkdagen;

    if (pd === wd) return 'text-green-600 font-bold'; // Groen = precies gelijk
    if (pd < wd) return 'text-red-600 font-bold';      // Rood = tekort
    return 'text-gray-600';                             // Neutraal = overschot
  };

  // Team totalen berekenen
  const getTeamTotals = (serviceId: string) => {
    const totals = new Map<string, number>();
    let grandTotal = 0;

    employees.forEach(emp => {
      const services = roosterData.get(emp.id);
      const count = services?.get(serviceId) || 0;
      
      if (!totals.has(emp.team)) {
        totals.set(emp.team, 0);
      }
      totals.set(emp.team, totals.get(emp.team)! + count);
      grandTotal += count;
    });

    return { totals, grandTotal };
  };

  return (
    <div className="w-full overflow-x-auto bg-white">
      <table className="w-full border-collapse">
        {/* STICKY HEADER */}
        <thead className="sticky top-0 bg-gray-100 z-10 border-b-2 border-gray-300 shadow-md">
          <tr>
            {/* Medewerker kolom */}
            <th className="px-3 py-2 text-left font-bold text-sm min-w-[150px] border-r border-gray-300">
              Medewerker
            </th>

            {/* Wd (Werkdagen) kolom */}
            <th className="px-3 py-2 text-center font-bold text-sm min-w-[50px] border-r border-gray-300 bg-blue-50">
              Wd
            </th>

            {/* Pd (Personeelslasten) kolom */}
            <th className="px-3 py-2 text-center font-bold text-sm min-w-[50px] border-r border-gray-300 bg-blue-50">
              Pd
            </th>

            {/* Service types kolommen */}
            {serviceTypes.map(service => (
              <th
                key={service.id}
                className="px-2 py-2 text-center font-bold text-xs min-w-[100px] border-r border-gray-200"
                style={{ backgroundColor: service.kleur || '#f0f0f0' }}
              >
                {/* Service badge in header */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-bold text-sm">{service.code}</span>
                  <span className="text-xs font-normal text-gray-600">
                    waarde: {service.dienstwaarde}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* MEDEWERKER RIJEN */}
          {employees.map(employee => (
            <tr key={employee.id} className="border-b border-gray-200 hover:bg-gray-50">
              {/* Medewerker naam */}
              <td className="px-3 py-2 font-medium text-sm border-r border-gray-300">
                <div>
                  <div className="font-semibold text-gray-800">
                    {employee.voornaam} {employee.achternaam}
                  </div>
                  <div className="text-xs text-gray-500">{employee.team}</div>
                </div>
              </td>

              {/* Kolom Wd (Werkdagen) */}
              <td className="px-3 py-2 text-center font-bold text-sm border-r border-gray-300 bg-blue-50">
                {employee.aantalwerkdagen}
              </td>

              {/* Kolom Pd (Personeelslasten) */}
              <td className={`px-3 py-2 text-center font-bold text-sm border-r border-gray-300 bg-blue-50 ${getPdColor(employee.id)}`}>
                {calculatePd(employee.id).toFixed(1)}
              </td>

              {/* Service cellen */}
              {serviceTypes.map(service => {
                const count = roosterData.get(employee.id)?.get(service.id) || 0;
                
                return (
                  <td
                    key={`${employee.id}-${service.id}`}
                    className="px-2 py-2 text-center border-r border-gray-200"
                    style={{ backgroundColor: service.kleur ? `${service.kleur}15` : '#f9f9f9' }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {/* Button + Teller (image2 layout) */}
                      <button
                        onClick={() => updateServiceCount(employee.id, service.id, Math.max(0, count - 1))}
                        disabled={isUpdating}
                        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                        title="Verlagen"
                      >
                        −
                      </button>

                      <span className="min-w-[24px] text-center font-bold text-sm">
                        {count}
                      </span>

                      <button
                        onClick={() => updateServiceCount(employee.id, service.id, count + 1)}
                        disabled={isUpdating}
                        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                        title="Verhogen"
                      >
                        +
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}

          {/* TEAMTOTALEN RIJ */}
          <tr className="font-bold bg-gray-100 border-b-2 border-gray-400">
            <td className="px-3 py-2 font-bold text-sm border-r border-gray-300">
              Praktijk Totaal
            </td>
            <td className="px-3 py-2 text-center text-sm border-r border-gray-300 bg-blue-100">
              {employees.reduce((sum, e) => sum + e.aantalwerkdagen, 0)}
            </td>
            <td className="px-3 py-2 text-center text-sm border-r border-gray-300 bg-blue-100">
              {employees.reduce((sum, e) => sum + calculatePd(e.id), 0).toFixed(1)}
            </td>

            {/* Totalen per dienst */}
            {serviceTypes.map(service => {
              const { totals, grandTotal } = getTeamTotals(service.id);
              
              return (
                <td
                  key={`total-${service.id}`}
                  className="px-2 py-2 text-center font-bold text-sm border-r border-gray-200 bg-blue-50"
                  style={{ backgroundColor: service.kleur ? `${service.kleur}30` : '#e0e7ff' }}
                >
                  {grandTotal}
                </td>
              );
            })}
          </tr>

          {/* TEAMGEKLEURDE TOTALEN PER DIENST (optioneel) */}
          {Array.from(new Set(employees.map(e => e.team))).map(team => {
            const teamEmployees = employees.filter(e => e.team === team);
            
            return (
              <tr key={`team-total-${team}`} className="text-sm bg-gray-50 border-b border-gray-200">
                <td className="px-3 py-2 font-semibold text-sm border-r border-gray-300">
                  Team: {team}
                </td>
                <td className="px-3 py-2 text-center text-sm border-r border-gray-300 bg-orange-50">
                  {teamEmployees.reduce((sum, e) => sum + e.aantalwerkdagen, 0)}
                </td>
                <td className="px-3 py-2 text-center text-sm border-r border-gray-300 bg-orange-50">
                  {teamEmployees.reduce((sum, e) => sum + calculatePd(e.id), 0).toFixed(1)}
                </td>

                {serviceTypes.map(service => {
                  const teamCount = teamEmployees.reduce((sum, emp) => {
                    return sum + (roosterData.get(emp.id)?.get(service.id) || 0);
                  }, 0);

                  return (
                    <td
                      key={`team-${team}-${service.id}`}
                      className="px-2 py-2 text-center font-bold text-sm border-r border-gray-200"
                      style={{ backgroundColor: service.kleur ? `${service.kleur}40` : '#f5f5f5' }}
                    >
                      {teamCount}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Cache busting + Railway trigger */}
      <div style={{ display: 'none' }}>
        <img src={`/cache-bust-${Date.now()}.txt?cb=${Math.random()}`} alt="" />
      </div>
    </div>
  );
};

export default RoosterLayout;
