/**
 * DRAAD118A Phase 3: BottleneckAnalysisScreen
 * DRAAD125C: TypeScript Field Names Fix
 * 
 * Displayed when solver returns INFEASIBLE status.
 * Shows detailed capacity gap analysis with suggestions.
 * 
 * ROUTING:
 * /rooster/[id]/bottleneck-analysis
 * 
 * ACCESSED FROM:
 * - design page (planRooster handler) when solver_status === 'infeasible'
 * 
 * NAVIGATION OUT:
 * - Back button: /rooster/[id]/design (resets toggles first)
 * - No automatic progression (manual review required)
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { BottleneckReport, BottleneckItem, BottleneckSuggestion } from '@/lib/types/solver';

interface PageProps {
  searchParams?: Record<string, string>;
}

export default function BottleneckAnalysisPage({ searchParams }: PageProps) {
  const params = useParams();
  const router = useRouter();
  const roster_id = params.id as string;
  
  const [report, setReport] = useState<BottleneckReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resettingToggles, setResettingToggles] = useState(false);
  
  // DRAAD118A: Parse report from URL search params or sessionStorage
  useEffect(() => {
    try {
      // Try sessionStorage first (set by design page)
      const stored = sessionStorage.getItem(`bottleneck-report-${roster_id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setReport(parsed);
        setLoading(false);
        return;
      }
      
      // Try URL searchParams
      if (searchParams?.report) {
        const parsed = JSON.parse(decodeURIComponent(searchParams.report));
        setReport(parsed);
        setLoading(false);
        return;
      }
      
      // If no report found, show error
      setError('Bottleneck rapport niet gevonden. Teruggaan naar ontwerp.');
      setLoading(false);
    } catch (e) {
      console.error('[BottleneckAnalysis] Error parsing report:', e);
      setError('Fout bij laden van bottleneck analyse.');
      setLoading(false);
    }
  }, [roster_id, searchParams]);
  
  // DRAAD118A: Reset toggles and go back to design
  const handleBackToDashboard = async () => {
    try {
      setResettingToggles(true);
      console.log(`[BottleneckAnalysis] Resetting toggles for roster ${roster_id}...`);
      
      // Call backend endpoint to reset toggles
      const response = await fetch(`/api/roster/${roster_id}/reset-design-toggles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roster_id })
      });
      
      if (!response.ok) {
        console.warn('[BottleneckAnalysis] Toggle reset failed, proceeding anyway');
      }
      
      // Clear sessionStorage
      sessionStorage.removeItem(`bottleneck-report-${roster_id}`);
      
      // Navigate back to design dashboard
      console.log(`[BottleneckAnalysis] Navigating back to /rooster/${roster_id}/design`);
      router.push(`/rooster/${roster_id}/design`);
    } catch (e) {
      console.error('[BottleneckAnalysis] Error in handleBackToDashboard:', e);
      // Navigate anyway even if toggle reset failed
      router.push(`/rooster/${roster_id}/design`);
    } finally {
      setResettingToggles(false);
    }
  };
  
  // Severity color mapping
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-red-300';
      case 'high':
        return 'bg-orange-100 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 border-yellow-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };
  
  const getSeverityBadgeColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };
  
  const getShortagePercentage = (item: BottleneckItem): number => {
    return item.required > 0 ? Math.round((item.shortage / item.required) * 100) : 0;
  };
  
  const getCoveragePercentage = (item: BottleneckItem): number => {
    return item.required > 0 ? Math.round((item.available / item.required) * 100) : 0;
  };
  
  const getBarColor = (shortagePct: number): string => {
    if (shortagePct >= 50) return 'bg-red-500';
    if (shortagePct >= 30) return 'bg-orange-500';
    return 'bg-yellow-500';
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-700">Bottleneck analyse laden...</div>
        </div>
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium text-red-700">{error || 'Rapport niet beschikbaar'}</div>
          <button
            onClick={handleBackToDashboard}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Terug naar ontwerp
          </button>
        </div>
      </div>
    );
  }
  
  // DRAAD125C: Calculate summary stats
  const bottlenecks = report.bottlenecks || [];
  const totalRequired = bottlenecks.reduce((sum, item) => sum + item.required, 0);
  const totalAvailable = bottlenecks.reduce((sum, item) => sum + item.available, 0);
  const totalShortage = report.total_shortage || (totalRequired - totalAvailable);
  const shortagePercentage = report.shortage_percentage || (totalRequired > 0 ? Math.round((totalShortage / totalRequired) * 100) : 0);
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Bottleneck Analyse
        </h1>
        <p className="text-gray-600 mb-8">
          Het rooster kon niet automatisch worden ingepland vanwege capaciteitstekorten.
          Hieronder ziet u per dienst waar het probleem zit en suggesties om dit op te lossen.
        </p>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Totaal nodig</div>
            <div className="text-2xl font-bold text-gray-900">{totalRequired}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Beschikbaar</div>
            <div className="text-2xl font-bold text-gray-900">{totalAvailable}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Tekort</div>
            <div className="text-2xl font-bold text-red-600">{totalShortage}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Percentage</div>
            <div className="text-2xl font-bold text-red-600">{shortagePercentage.toFixed(1)}%</div>
          </div>
        </div>
        
        {/* Critical Count Alert */}
        {(report.critical_count || 0) > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="text-red-600 font-bold text-xl">⚠️</div>
              <div>
                <div className="font-medium text-red-900">
                  {report.critical_count} kritieke knelpunt{(report.critical_count || 0) !== 1 ? 'en' : ''}
                </div>
                <div className="text-sm text-red-800 mt-1">
                  Dit zijn meestal systeemdiensten of diensten met volledige capaciteitstekort.
                  Deze kunnen niet zomaar worden genegeerd; het rooster kan niet worden ingepland zonder aanpassing.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Bottleneck Table & Charts */}
      <div className="max-w-5xl mx-auto bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Dienst</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Nodig</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Beschikbaar</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Tekort</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Ernst</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Dekking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bottlenecks.map((item: BottleneckItem, idx: number) => {
                const coveragePct = getCoveragePercentage(item);
                const shortagePct = getShortagePercentage(item);
                const isCritical = item.severity === 'critical';
                
                return (
                  <tr key={idx} className={isCritical ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.service_code || 'N/A'}</div>
                      <div className="text-xs text-gray-600">{item.reason || 'Capaciteitstekort'}</div>
                    </td>
                    <td className="text-right px-4 py-3 font-medium">{item.required}</td>
                    <td className="text-right px-4 py-3 font-medium">{item.available}</td>
                    <td className="text-right px-4 py-3 font-medium text-red-600">{item.shortage}</td>
                    <td className="text-center px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getSeverityBadgeColor(item.severity)}`}>
                        {item.severity === 'critical' ? 'KRITIEK' : item.severity === 'high' ? 'HOOG' : 'GEMIDDELD'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getBarColor(shortagePct)}`}
                            style={{ width: `${Math.max(coveragePct, 0)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 w-8 text-right">{coveragePct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Suggestions Section */}
      {report.suggestions && report.suggestions.length > 0 && (
        <div className="max-w-5xl mx-auto mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Suggesties voor aanpassing</h2>
          <div className="space-y-3">
            {report.suggestions.map((suggestion: BottleneckSuggestion, idx: number) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="text-lg">
                    {suggestion.type === 'increase_staffing' && '📈'}
                    {suggestion.type === 'relax_constraint' && '📉'}
                    {suggestion.type === 'swap_assignment' && '🔄'}
                    {suggestion.type === 'add_capacity' && '👥'}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {suggestion.message}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {suggestion.type === 'increase_staffing' && 'Meer medewerkers beschikbaar maken voor deze dienst'}
                      {suggestion.type === 'relax_constraint' && 'Restricties voor deze dienst versoepelen'}
                      {suggestion.type === 'swap_assignment' && 'Medewerkers uisselen tussen diensten'}
                      {suggestion.type === 'add_capacity' && 'Extra capaciteit toevoegen'}
                    </div>
                    {suggestion.priority && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        <span className="text-xs font-semibold text-gray-500">Prioriteit: {suggestion.priority}/10</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="max-w-5xl mx-auto flex gap-4">
        <button
          onClick={handleBackToDashboard}
          disabled={resettingToggles}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {resettingToggles ? 'Bezig met herstellen...' : 'Terug naar Dashboard Rooster Ontwerp'}
        </button>
      </div>
      
      {/* Info Box */}
      <div className="max-w-5xl mx-auto mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          💡 <strong>Volgende stap:</strong> Controleer de bovenstaande analyse en pas de ontwerp-instellingen aan.
          U kunt bijvoorbeeld bevoegdheden toevoegen, normen aanpassen, of medewerkers beschikbaar maken.
          Klik vervolgens opnieuw op 'Roosterbewerking starten' om het opnieuw te proberen.
        </p>
      </div>
    </div>
  );
}