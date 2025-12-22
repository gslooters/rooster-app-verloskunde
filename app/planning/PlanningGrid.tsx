'use client';
import React, { useMemo } from 'react';
import '@/styles/planning.css';
import '@/styles/compact-service.css';

interface Service {
  code: string;
  name: string;
  employee_id?: string;
  dagblok?: string;
}

interface PlanningGridProps {
  rosterId?: string;
  employees: Array<{
    id: string;
    voornaam: string;
    achternaam: string;
  }>;
  services?: Service[];
  onCellClick?: (employeeId: string, dayIndex: number) => void;
  readOnly?: boolean;
}

/**
 * PlanningGrid: 5-week rooster weergave
 * Toont medewerkers (rijen) x dagblokken (kolommen)
 * 
 * Lay-out:
 * - Voornaam + Achternaam in eerste kolom (sticky)
 * - 35 kolommen voor 5 weken x 7 dagen
 * - Weekend kolommen in rode achtergrond
 * - Service codes gecodeerd per kleur (DG, NB, S, ZW)
 */
export default function PlanningGrid({
  rosterId = '',
  employees = [],
  services = [],
  onCellClick,
  readOnly = false,
}: PlanningGridProps) {
  const DAYS_PER_WEEK = 7;
  const WEEKS = 5;
  const TOTAL_DAYS = DAYS_PER_WEEK * WEEKS;

  const serviceMap = useMemo(() => {
    const map = new Map<string, Service>();
    for (const svc of services) {
      const key = `${svc.employee_id}|${svc.dagblok || '0'}`;
      map.set(key, svc);
    }
    return map;
  }, [services]);

  const getDayName = (dayOfWeek: number): string => {
    const names = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
    return names[dayOfWeek % DAYS_PER_WEEK];
  };

  const isWeekend = (dayOfWeek: number): boolean => {
    const dow = dayOfWeek % DAYS_PER_WEEK;
    return dow === 5 || dow === 6; // za=5, zo=6
  };

  const getWeekNumber = (dayIndex: number): number => {
    return Math.floor(dayIndex / DAYS_PER_WEEK) + 1;
  };

  const getServiceForCell = (employeeId: string, dayIndex: number): Service | undefined => {
    const key = `${employeeId}|${dayIndex}`;
    return serviceMap.get(key);
  };

  const renderServiceBadge = (service: Service | undefined): JSX.Element => {
    if (!service) return <span className="text-gray-300">—</span>;

    const className = `service-badge service-badge.${service.code.toUpperCase()}`;
    return <span className={className}>{service.code.toUpperCase()}</span>;
  };

  const renderCell = (employeeId: string, dayIndex: number): void => {
    if (!onCellClick) return;
    onCellClick(employeeId, dayIndex);
  };

  if (employees.length === 0) {
    return <div className="p-4 text-center text-gray-500">Geen medewerkers beschikbaar</div>;
  }

  return (
    <div className="planning-grid-container">
      <table>
        <thead>
          <tr>
            <th>Medewerker</th>
            {Array.from({ length: TOTAL_DAYS }).map((_, dayIndex) => {
              const weekNum = getWeekNumber(dayIndex);
              const dayName = getDayName(dayIndex);
              const isWknd = isWeekend(dayIndex);
              const isWeekStart = dayIndex % DAYS_PER_WEEK === 0;
              const isWeekEnd = dayIndex % DAYS_PER_WEEK === 6;

              if (isWeekEnd && dayIndex < TOTAL_DAYS - 1) {
                return (
                  <React.Fragment key={`day-${dayIndex}`}>
                    <th className={isWknd ? 'weekend' : ''}>
                      <div className="font-normal text-xs text-gray-500">W{weekNum}</div>
                      <div className="font-bold text-sm uppercase">{dayName}</div>
                    </th>
                    <th className="week-separator" key={`sep-${dayIndex}`}></th>
                  </React.Fragment>
                );
              }

              return (
                <th key={`day-${dayIndex}`} className={isWknd ? 'weekend' : ''}>
                  <div className="font-normal text-xs text-gray-500">W{weekNum}</div>
                  <div className="font-bold text-sm uppercase">{dayName}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                <div className="text-xs font-semibold text-gray-900">{employee.voornaam}</div>
                <div className="text-xs font-semibold text-gray-900">{employee.achternaam}</div>
              </td>
              {Array.from({ length: TOTAL_DAYS }).map((_, dayIndex) => {
                const service = getServiceForCell(employee.id, dayIndex);
                const isWknd = isWeekend(dayIndex);
                const isWeekEnd = dayIndex % DAYS_PER_WEEK === 6;

                if (isWeekEnd && dayIndex < TOTAL_DAYS - 1) {
                  return (
                    <React.Fragment key={`cell-${employee.id}-${dayIndex}`}>
                      <td
                        className={`${isWknd ? 'weekend' : ''}`}
                        onClick={() => !readOnly && renderCell(employee.id, dayIndex)}
                        style={{ cursor: readOnly ? 'default' : 'pointer' }}
                      >
                        {renderServiceBadge(service)}
                      </td>
                      <td className="week-separator" key={`sep-${employee.id}-${dayIndex}`}></td>
                    </React.Fragment>
                  );
                }

                return (
                  <td
                    key={`cell-${employee.id}-${dayIndex}`}
                    className={`${isWknd ? 'weekend' : ''}`}
                    onClick={() => !readOnly && renderCell(employee.id, dayIndex)}
                    style={{ cursor: readOnly ? 'default' : 'pointer' }}
                  >
                    {renderServiceBadge(service)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}