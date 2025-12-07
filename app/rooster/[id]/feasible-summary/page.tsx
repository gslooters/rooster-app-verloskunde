/**
 * DRAAD118A Phase 3: FeasibleSummaryScreen
 * 
 * Displayed when solver returns FEASIBLE status.
 * Shows brief summary and allows user to:
 * - Proceed to Planrooster (status now 'in_progress')
 * 
 * ROUTING:
 * /rooster/[id]/feasible-summary
 * 
 * ACCESSED FROM:
 * - design page (planRooster handler) when solver_status === 'feasible'
 * - Backend has already set rooster.status to 'in_progress' at this point
 * 
 * NAVIGATION OUT:
 * - Continue to Plan: /planning/[id] (rooster grid)
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { FeasibleSummary } from '@/lib/types/solver';

interface PageProps {
  searchParams?: Record<string, string>;
}

export default function FeasibleSummaryPage({ searchParams }: PageProps) {
  const params = useParams();
  const router = useRouter();
  const roster_id = params.id as string;
  
  const [summary, setSummary] = useState<FeasibleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterName, setRosterName] = useState<string>('');
  
  // DRAAD118A: Parse summary from sessionStorage or URL
  useEffect(() => {
    try {
      // Try sessionStorage first (set by design page)
      const stored = sessionStorage.getItem(`feasible-summary-${roster_id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSummary(parsed);
        setLoading(false);
        return;
      }
      
      // Try URL searchParams
      if (searchParams?.summary) {
        const parsed = JSON.parse(decodeURIComponent(searchParams.summary));
        setSummary(parsed);
        setLoading(false);
        return;
      }
      
      // If no summary found, show error
      setError('Samenvatting niet gevonden.');
      setLoading(false);
    } catch (e) {
      console.error('[FeasibleSummary] Error parsing summary:', e);
      setError('Fout bij laden van samenvatting.');
      setLoading(false);
    }
    
    // Fetch roster name for display
    const fetchRosterName = async () => {
      try {
        const response = await fetch(`/api/roster/${roster_id}`);
        if (response.ok) {
          const data = await response.json();
          setRosterName(data.naam || `Rooster ${roster_id}`);
        }
      } catch (e) {
        console.warn('[FeasibleSummary] Could not fetch roster name:', e);
        setRosterName(`Rooster ${roster_id}`);
      }
    };
    
    fetchRosterName();
  }, [roster_id, searchParams]);
  
  const getCoverageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-orange-600';
  };
  
  const getCoverageProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-700">Samenvatting laden...</div>
        </div>
      </div>
    );
  }
  
  if (error || !summary) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-2xl mb-4">😱</div>
          <div className="text-lg font-medium text-red-700">{error || 'Samenvatting niet beschikbaar'}</div>
          <div className="mt-4">
            <Link
              href={`/rooster/${roster_id}/design`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Terug naar ontwerp
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  const progressPercentage = Math.round(summary.coverage_percentage);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Rooster Ingepland!</h1>
          <p className="text-lg text-gray-600">Het automatische roostering is gelukt.</p>
        </div>
        
        {/* Summary Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-6 text-white">
            <h2 className="text-2xl font-bold">{rosterName}</h2>
            <p className="text-blue-100 mt-1">Periode: Week 48 - Week 52 2025</p>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-gray-100">
            {/* Services Scheduled */}
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-gray-600 mb-1">Ingeplande diensten</div>
              <div className="text-3xl font-bold text-blue-600">{summary.total_services_scheduled}</div>
              <div className="text-xs text-gray-500 mt-1">diensten ingevuld</div>
            </div>
            
            {/* Coverage Percentage */}
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-sm font-medium text-gray-600 mb-1">Dekkingsgraad</div>
              <div className={`text-3xl font-bold ${getCoverageColor(progressPercentage)}`}>
                {progressPercentage}%
              </div>
              <div className="text-xs text-gray-500 mt-1">van benodigde capaciteit</div>
            </div>
            
            {/* Unfilled Slots */}
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-sm font-medium text-gray-600 mb-1">Niet ingevuld</div>
              <div className="text-3xl font-bold text-orange-600">{summary.unfilled_slots}</div>
              <div className="text-xs text-gray-500 mt-1">lege slots</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Dekkingsgraad</label>
              <span className="text-sm font-semibold text-gray-700">{progressPercentage}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getCoverageProgressColor(progressPercentage)} transition-all duration-500`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {progressPercentage >= 90
                ? '✨ Uitstekende dekking! Het rooster is goed gevuld.'
                : progressPercentage >= 75
                ? '✓ Goede dekking. De meeste slots zijn ingevuld.'
                : progressPercentage >= 50
                ? '⚠ Matige dekking. Veel slots zijn nog leeg.'
                : '❌ Geringe dekking. Veel slots zijn nog leeg.'}
            </p>
          </div>
          
          {/* Message Box */}
          <div className="bg-blue-50 border-t border-blue-100 px-6 py-4">
            <p className="text-sm text-blue-900">
              💡 <strong>Volgende stap:</strong> U kunt nu naar de planningstool gaan om het rooster in te zien en verder aan te passen.
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-4">
          {/* Continue to Plan */}
          <Link
            href={`/planning/${roster_id}`}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-center"
          >
            📋 Ga naar Planrooster
          </Link>
        </div>
        
        {/* Info Box */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-700">
            <strong>Roosterstatus:</strong> Het rooster is nu in status <em>"In bewerking"</em> (in_progress).
            U kunt het nu gebruiken in de planningstool.
          </div>
        </div>
      </div>
    </div>
  );
}
