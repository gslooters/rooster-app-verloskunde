'use client';

import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar } from 'lucide-react';

// Types - AANGEPAST NAAR WERKELIJKE DATABASE SCHEMA
interface RosterInfo {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Service {
  id: string;
  naam: string;
  code: string;
  kleur: string;
}

// GEFIXTE TYPE - Correct volgens roster_period_staffing_dagdelen schema
interface DagdeelAssignment {
  id?: string;
  roster_period_staffing_id: string;
  dagdeel: string;
  team: string;
  status: string;
  aantal: number;
  created_at?: string;
  updated_at?: string;
}

interface Employee {
  id: string;
  voornaam: string;
  achternaam: string;
  team: string;
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
  const [assignments, setAssignments] = useState<DagdeelAssignment[]>([]);
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

        // Load roster
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
          .eq('actief', true)
          .order('achternaam');

        if (employeesError) throw employeesError;
        setEmployees(employeesData || []);

        // Load services
        const { data: servicesData, error: servicesError } = await supabase
          .from('service_types')
          .select('*')
          .eq('actief', true)
          .order('naam');

        if (servicesError) throw servicesError;
        setServices(servicesData || []);

        // GEFIXTE QUERY - Gebruik correcte tabelnaam roster_period_staffing_dagdelen
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('roster_period_staffing_dagdelen')
          .select(`
            *,
            roster_period_staffing!inner(roster_id)
          `)
          .eq('roster_period_staffing.roster_id', rosterId);

        if (assignmentsError) {
          console.error('Error loading dagdeel assignments:', assignmentsError);
          throw assignmentsError;
        }
        
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

  // GEFIXTE FUNCTIE - Gebruik correcte tabelnaam en velden
  async function handleDagdeelChange(
    rosterPeriodStaffingId: string,
    dagdeel: string,
    team: string,
    newAantal: number
  ) {
    if (!rosterId) return;

    try {
      const existing = assignments.find(
        a => 
          a.roster_period_staffing_id === rosterPeriodStaffingId &&
          a.dagdeel === dagdeel &&
          a.team === team
      );

      if (existing?.id) {
        // Update bestaande
        const { error } = await supabase
          .from('roster_period_staffing_dagdelen')
          .update({ 
            aantal: newAantal,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;

        setAssignments(prev =>
          prev.map(a => (a.id === existing.id ? { ...a, aantal: newAantal } : a))
        );
      } else {
        // Nieuwe invoegen
        const newAssignment: DagdeelAssignment = {
          roster_period_staffing_id: rosterPeriodStaffingId,
          dagdeel,
          team,
          status: 'MAG',
          aantal: newAantal
        };

        const { data, error } = await supabase
          .from('roster_period_staffing_dagdelen')
          .insert(newAssignment)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setAssignments(prev => [...prev, data]);
        }
      }
    } catch (err: any) {
      console.error('Error saving dagdeel assignment:', err);
      alert('Fout bij opslaan: ' + err.message);
    }
  }

  const weekDates = getWeekDates(currentWeek, currentYear);
  const dagdelen = ['ochtend', 'middag', 'avond', 'nacht'];
  const teams = ['TOT', 'GRO', 'ORA'];

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
          Rooster: <span className="font-semibold">{roster.name || 'Onbekend'}</span>
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

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Dagdeel Overzicht</h3>
        <p className="text-sm text-blue-800">
          Totaal dagdeel records: <strong>{assignments.length}</strong>
        </p>
        <p className="text-sm text-blue-700 mt-1">
          Teams: {teams.join(', ')} | Dagdelen: {dagdelen.join(', ')}
        </p>
      </div>

      {/* Grid - Simplified view voor roster_period_staffing_dagdelen */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-3 text-left">Dagdeel</th>
                <th className="border border-gray-300 p-3 text-left">Team</th>
                <th className="border border-gray-300 p-3 text-left">Status</th>
                <th className="border border-gray-300 p-3 text-center">Aantal</th>
                <th className="border border-gray-300 p-3 text-left">ID</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-gray-300 p-4 text-center text-gray-500">
                    Geen dagdeel gegevens gevonden voor dit rooster
                  </td>
                </tr>
              ) : (
                assignments.map((assignment, index) => (
                  <tr key={assignment.id || index} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3 font-medium">
                      {assignment.dagdeel}
                    </td>
                    <td className="border border-gray-300 p-3">
                      <span className={`px-2 py-1 rounded text-sm font-semibold ${
                        assignment.team === 'TOT' ? 'bg-purple-100 text-purple-800' :
                        assignment.team === 'GRO' ? 'bg-green-100 text-green-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {assignment.team}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        assignment.status === 'MOET' ? 'bg-red-100 text-red-800' :
                        assignment.status === 'MAG' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {assignment.status}
                      </span>
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={assignment.aantal}
                        onChange={(e) => handleDagdeelChange(
                          assignment.roster_period_staffing_id,
                          assignment.dagdeel,
                          assignment.team,
                          parseInt(e.target.value) || 0
                        )}
                        className="w-20 px-2 py-1 border rounded text-center"
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-xs text-gray-500 font-mono">
                      {assignment.id?.substring(0, 8)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-semibold mb-3">Status Legenda:</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded bg-red-100 text-red-800 text-sm">MOET</span>
            <span className="text-sm text-gray-600">Vereist minimum</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded bg-blue-100 text-blue-800 text-sm">MAG</span>
            <span className="text-sm text-gray-600">Optioneel maximum</span>
          </div>
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