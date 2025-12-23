'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Download, BarChart3, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

// CRITICAL: Force dynamic rendering - no caching whatsoever
export const dynamic = 'force-dynamic';

// LAZY IMPORT: Delay Supabase import until client-side rendering
// HERSTELD OPTIE A: Use getEmployeeServicesOverview (employee_services macro)
let getEmployeeServicesOverview: any;
let upsertEmployeeService: any;
let supabase: any;

const loadSupabaseModules = async () => {
  if (!getEmployeeServicesOverview) {
    const mod1 = await import('@/lib/services/medewerker-diensten-supabase');
    getEmployeeServicesOverview = mod1.getEmployeeServicesOverview;
    upsertEmployeeService = mod1.upsertEmployeeService;
    const mod2 = await import('@supabase/supabase-js');
    supabase = mod2.createClient;
  }
};

interface ServiceAssignment {
  id: string;
  employee_id: string;
  employee_name: string;
  service_code: string;
  service_naam?: string;
  aantal: number;
  team?: string;
  dienstwaarde?: number;
  enabled: boolean;
}

interface ServiceSummary {
  code: string;
  name?: string;
  kleur?: string;
  totalAssigned: number;
  employeeCount: number;
  totalValue: number;
}

interface EmployeeData {
  employeeId: string;
  employeeName: string;
  team?: string;
  aantal_werkdagen?: number;
  services?: Record<string, any>;
}

export default function ServiceAssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ServiceAssignment[]>([]);
  const [summary, setSummary] = useState<Record<string, ServiceSummary>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    // HERSTELD: Always macro-config (no rosterId parameter)
    loadData(null);
  }, []);

  async function loadData(rId: string | null) {
    try {
      setLoading(true);
      setError(null);
      
      await loadSupabaseModules();
      
      // HERSTELD OPTIE A: Altijd getEmployeeServicesOverview (macro-config)
      const overview = await getEmployeeServicesOverview();
      
      if (!overview || overview.length === 0) {
        console.warn('⚠️ No employee services overview data');
        setData([]);
        setSummary({});
        setLoading(false);
        return;
      }
      
      const assignments: ServiceAssignment[] = [];
      const summaryMap: Record<string, ServiceSummary> = {};
      
      // Transform employee_services data to assignments format
      overview.forEach((emp: EmployeeData) => {
        if (!emp.employeeId) return;
        
        // Process each service for this employee
        Object.entries(emp.services || {}).forEach(([serviceCode, srvData]: any) => {
          // Register service type in summary
          if (!summaryMap[serviceCode]) {
            summaryMap[serviceCode] = {
              code: serviceCode,
              name: srvData.naam || serviceCode,
              kleur: srvData.kleur || '#cccccc',
              totalAssigned: 0,
              employeeCount: 0,
              totalValue: 0
            };
          }
          
          // Add assignment if active
          if (srvData.enabled && srvData.count > 0) {
            const assignment: ServiceAssignment = {
              id: `${emp.employeeId}_${serviceCode}`,
              employee_id: emp.employeeId,
              employee_name: emp.employeeName,
              service_code: serviceCode,
              service_naam: srvData.naam || serviceCode,
              aantal: srvData.count,
              team: emp.team,
              dienstwaarde: srvData.dienstwaarde || 1.0,
              enabled: true
            };
            
            assignments.push(assignment);
            
            // Update summary
            summaryMap[serviceCode].totalAssigned += assignment.aantal;
            summaryMap[serviceCode].employeeCount += 1;
            summaryMap[serviceCode].totalValue += 
              (assignment.aantal * (assignment.dienstwaarde || 1.0));
          }
        });
      });
      
      setData(assignments);
      setSummary(summaryMap);
    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      setError(err.message || 'Fout bij laden van gegevens');
    } finally {
      setLoading(false);
    }
  }

  const handleSaveAssignment = async (assignmentId: string, enabled: boolean, aantal: number) => {
    try {
      setSaving(assignmentId);
      setSaveSuccess(null);
      setError(null);
      
      const [employeeId, serviceCode] = assignmentId.split('_');
      
      // Call upsertEmployeeService to save to employee_services table
      await upsertEmployeeService(employeeId, serviceCode, {
        aantal: aantal,
        enabled: enabled
      });
      
      setSaveSuccess(assignmentId);
      
      // Reload data after save
      setTimeout(() => {
        loadData(null);
      }, 500);
    } catch (err: any) {
      console.error('❌ Error saving assignment:', err);
      setError(`Fout bij opslaan: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const filteredData = filter === 'all' 
    ? data 
    : data.filter(d => d.service_code === filter);

  const teamStats = (() => {
    const stats: Record<string, { count: number; services: number }> = {};
    filteredData.forEach(d => {
      if (!stats[d.team || 'Overig']) {
        stats[d.team || 'Overig'] = { count: 0, services: 0 };
      }
      stats[d.team || 'Overig'].count += d.aantal;
      stats[d.team || 'Overig'].services += 1;
    });
    return stats;
  })();

  const handleExport = async () => {
    try {
      // Simple CSV export
      const headers = ['Medewerker', 'Team', 'Dienst', 'Aantal', 'Waarde'];
      const rows = filteredData.map(d => [
        d.employee_name,
        d.team || 'Overig',
        d.service_code,
        d.aantal,
        (d.aantal * (d.dienstwaarde || 1.0)).toFixed(2)
      ]);
      
      const csv = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `diensten-toewijzingen-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            <span className="ml-3 text-gray-600">Laden...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">🎯 Diensten Medewerkers</h1>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => loadData(null)}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Vernieuwen
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="text-blue-600 hover:text-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV Export
            </Button>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-gray-600 mb-6">Beheer macro-config: welke diensten zijn actief voor welke medewerkers</p>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Mode Indicator */}
        {/* HERSTELD: No rooster-scoped view in macro-config */}
        <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-4">
          <p className="text-sm text-amber-800">
            <strong>Mode:</strong> Macro-configuratie (global) - geldt voor alle roosters
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Totaal Diensten</p>
                <p className="text-3xl font-bold text-blue-700 mt-2">
                  {filteredData.reduce((sum, d) => sum + d.aantal, 0)}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Medewerkers</p>
                <p className="text-3xl font-bold text-green-700 mt-2">
                  {new Set(filteredData.map(d => d.employee_id)).size}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Diensten (Typen)</p>
                <p className="text-3xl font-bold text-purple-700 mt-2">
                  {Object.keys(summary).length}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Gewogen Totaal</p>
                <p className="text-3xl font-bold text-orange-700 mt-2">
                  {filteredData.reduce((sum, d) => 
                    sum + (d.aantal * (d.dienstwaarde || 1.0)), 0
                  ).toFixed(1)}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-500 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Filter */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            Alles
          </Button>
          {Object.keys(summary).map(code => (
            <Button
              key={code}
              variant={filter === code ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(code)}
              className={filter === code ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              {code} ({summary[code].totalAssigned})
            </Button>
          ))}
        </div>

        {/* Team Stats */}
        {Object.keys(teamStats).length > 0 && (
          <Card className="mb-6 p-4 bg-white border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              👥 Team Statistieken
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(teamStats).map(([team, stats]) => (
                <div key={team} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-900">{team}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {stats.count} diensten ({stats.services} toewijzingen)
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Main Table */}
        <Card className="overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
              <thead className="sticky top-0 z-10 bg-gradient-to-r from-gray-900 to-gray-800 shadow-md">
                <tr>
                  <th className="p-3 text-left font-semibold text-white">Medewerker</th>
                  <th className="p-3 text-center font-semibold text-white">Team</th>
                  <th className="p-3 text-center font-semibold text-white">Dienst</th>
                  <th className="p-3 text-center font-semibold text-white">Aantal</th>
                  <th className="p-3 text-center font-semibold text-white">Waarde</th>
                  <th className="p-3 text-center font-semibold text-white">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Geen diensten toegewezen
                    </td>
                  </tr>
                ) : (
                  filteredData.map((assignment) => {
                    const isSaving = saving === assignment.id;
                    const wasSaved = saveSuccess === assignment.id;
                    
                    return (
                      <tr 
                        key={assignment.id} 
                        className="hover:bg-purple-50 transition-colors duration-150"
                      >
                        <td className="p-3 font-medium text-gray-900">{assignment.employee_name}</td>
                        <td className="p-3 text-center">
                          <Badge 
                            variant="secondary"
                            className={`${
                              assignment.team === 'Groen' 
                                ? 'bg-green-100 text-green-800 border border-green-400' 
                                : assignment.team === 'Oranje' 
                                ? 'bg-orange-100 text-orange-800 border border-orange-400' 
                                : 'bg-blue-100 text-blue-800 border border-blue-400'
                            }`}
                          >
                            {assignment.team || 'Overig'}
                          </Badge>
                        </td>
                        <td className="p-3 text-center font-mono font-semibold text-gray-900 bg-gray-50">
                          {assignment.service_code}
                        </td>
                        <td className="p-3 text-center font-bold text-purple-600 bg-purple-50">
                          {assignment.aantal}
                        </td>
                        <td className="p-3 text-center font-semibold text-gray-900">
                          {(assignment.aantal * (assignment.dienstwaarde || 1.0)).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          {isSaving ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600 mx-auto" />
                          ) : wasSaved ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-lg">ℹ️</span>
            <span>
              <strong>HERSTELD OPTIE A:</strong> Dit scherm is nu een macro-configuratie scherm. 
              Het beheert de employee_services tabel (globale diensten-configuratie). 
              Wijzigingen hier beïnvloeden ALLE roosters die na dit moment worden aangemaakt.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}