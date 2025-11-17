'use client';

import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar } from 'lucide-react';

// Types
interface RosterInfo {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

interface Service {
  id: string;
  naam: string;
  code: string;
  kleur: string;
}

interface Assignment {
  id?: string;
  roster_id: string;
  employee_id: string;
  service_id: string;
  date: string;
  period: 'ochtend' | 'middag' | 'avond' | 'nacht';
}

interface Employee {
  id: string;
  voornaam: string;
  achternaam: string;
}

// Utility functions
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getWeekDates(weekNumber: number, year: number): Date[] {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (weekNumber - 1) * 7;
  const weekStart = new Date(firstDayOfYear.getTime() + daysOffset * 86400000);
  
  // Adjust to Monday
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + diff);
  
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Main content component
function DienstenPerDagContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rosterId = searchParams?.get('rosterId');

  const [roster, setRoster] = useState<RosterInfo | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(getWeekNumber(new Date()));
  const [currentYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!rosterId) {
        setError('Geen rooster ID gevonden');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Load roster - GEFIXTE TABELNAAM: 'roosters' (dubbele o)
        const { data: rosterData, error: rosterError } = await supabase
          .from('roosters')
          .select('*')
          .eq('id', rosterId)
          .single();

        if (rosterError) throw rosterError;
        setRoster(rosterData);

        // Load employees
        const { data: employeesData, error: employeesError } = await supabase
          .from('employees')
          .select('*')
          .order('achternaam');

        if (employeesError) throw employeesError;
        setEmployees(employeesData || []);

        // Load services - GEFIXTE TABELNAAM: 'service_types'
        const { data: servicesData, error: servicesError } = await supabase
          .from('service_types')
          .select('*')
          .eq('actief', true)
          .order('naam');

        if (servicesError) throw servicesError;
        setServices(servicesData || []);

        // Load assignments for this roster
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('diensten_per_dag')
          .select('*')
          .eq('roster_id', rosterId);

        if (assignmentsError) throw assignmentsError;
        setAssignments(assignmentsData || []);

        setError(null);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Fout bij laden van gegevens');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [rosterId]);

  // Save assignment
  async function handleAssignment(
    employeeId: string,
    date: string,
    period: 'ochtend' | 'middag' | 'avond' | 'nacht',
    serviceId: string | null
  ) {
    if (!rosterId) return;

    try {
      const existing = assignments.find(
        a => a.employee_id === employeeId && a.date === date && a.period === period
      );

      if (serviceId === null) {
        // Delete assignment
        if (existing?.id) {
          const { error } = await supabase
            .from('diensten_per_dag')
            .delete()
            .eq('id', existing.id);

          if (error) throw error;

          setAssignments(prev => prev.filter(a => a.id !== existing.id));
        }
      } else {
        if (existing?.id) {
          // Update existing
          const { error } = await supabase
            .from('diensten_per_dag')
            .update({ service_id: serviceId })
            .eq('id', existing.id);

          if (error) throw error;

          setAssignments(prev =>
            prev.map(a => (a.id === existing.id ? { ...a, service_id: serviceId } : a))
          );
        } else {
          // Insert new
          const newAssignment: Assignment = {
            roster_id: rosterId,
            employee_id: employeeId,
            service_id: serviceId,
            date,
            period
          };

          const { data, error } = await supabase
            .from('diensten_per_dag')
            .insert(newAssignment)
            .select()
            .single();

          if (error) throw error;
          if (data) {
            setAssignments(prev => [...prev, data]);
          }
        }
      }
    } catch (err: any) {
      console.error('Error saving assignment:', err);
      alert('Fout bij opslaan: ' + err.message);
    }
  }

  const weekDates = getWeekDates(currentWeek, currentYear);
  const periods = ['ochtend', 'middag', 'avond', 'nacht'] as const;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Diensten per dagdeel wordt geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !roster) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error || 'Rooster niet gevonden'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Terug naar Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Diensten per Dagdeel
        </h1>
        <p className="text-gray-600">
          Rooster: <span className="font-semibold">{roster.name}</span>
        </p>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
        <button
          onClick={() => setCurrentWeek(prev => prev - 1)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Vorige Week
        </button>
        
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-blue-600" />
          Week {currentWeek}, {currentYear}
        </div>
        
        <button
          onClick={() => setCurrentWeek(prev => prev + 1)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Volgende Week
          <ChevronRight className="h-4 w-4 ml-2" />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 sticky left-0 bg-gray-100 z-10">
                  Medewerker
                </th>
                {weekDates.map((date, i) => (
                  <th key={i} className="border border-gray-300 p-2 text-center min-w-[140px]">
                    <div className="font-semibold">
                      {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'][i]}
                    </div>
                    <div className="text-xs text-gray-600">
                      {date.getDate()}/{date.getMonth() + 1}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(employee => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2 font-medium sticky left-0 bg-white z-10">
                    {employee.voornaam} {employee.achternaam}
                  </td>
                  {weekDates.map((date, dayIndex) => {
                    const dateStr = formatDate(date);
                    return (
                      <td key={dayIndex} className="border border-gray-300 p-1">
                        <div className="flex flex-col gap-1">
                          {periods.map(period => {
                            const assignment = assignments.find(
                              a =>
                                a.employee_id === employee.id &&
                                a.date === dateStr &&
                                a.period === period
                            );
                            const service = services.find(s => s.id === assignment?.service_id);

                            return (
                              <select
                                key={period}
                                value={assignment?.service_id || ''}
                                onChange={e =>
                                  handleAssignment(
                                    employee.id,
                                    dateStr,
                                    period,
                                    e.target.value || null
                                  )
                                }
                                className="text-xs p-1 border rounded cursor-pointer"
                                style={{
                                  backgroundColor: service?.kleur || '#fff',
                                  color: service ? '#000' : '#666'
                                }}
                              >
                                <option value="">
                                  {period.charAt(0).toUpperCase() + period.slice(1)}
                                </option>
                                {services.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.code} - {s.naam}
                                  </option>
                                ))}
                              </select>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-semibold mb-2">Diensten Legenda:</h3>
        <div className="flex flex-wrap gap-2">
          {services.map(service => (
            <div
              key={service.id}
              className="flex items-center gap-2 px-3 py-1 rounded"
              style={{ backgroundColor: service.kleur }}
            >
              <span className="font-mono font-bold">{service.code}</span>
              <span>{service.naam}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function DienstenPerDagPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Pagina wordt geladen...</p>
        </div>
      </div>
    }>
      <DienstenPerDagContent />
    </Suspense>
  );
}