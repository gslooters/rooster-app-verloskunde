'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  getRosterStaffingRules, 
  initializeRosterStaffing, 
  upsertRosterStaffingRule,
  isRosterStaffingLocked,
  lockRosterStaffing,
  getDateStaffingOverview
} from '@/lib/services/roster-staffing-storage';
import { getAllServices } from '@/lib/services/diensten-storage';
import { RosterStaffingRuleInput, DateStaffingOverview, getStaffingDisplayText, getDayShort } from '@/lib/types/roster-staffing';
import { Dienst } from '@/lib/types/dienst';

// Utility functions
function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoWeekNumber(iso: string): number {
  const d = new Date(iso + 'T00:00:00');
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const ftDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - ftDay + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

function isWeekend(iso: string): boolean {
  const dayOfWeek = new Date(iso + 'T00:00:00').getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

interface StaffingManagerProps {
  rosterId: string;
  rosterPeriod: string;
  startDate: string;
  onClose: () => void;
  onLocked: () => void;
}

export default function StaffingManager({ rosterId, rosterPeriod, startDate, onClose, onLocked }: StaffingManagerProps) {
  const [services, setServices] = useState<Dienst[]>([]);
  const [dateOverviews, setDateOverviews] = useState<DateStaffingOverview[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string>('');

  // Generate 35 days from start date
  const days = useMemo(() => 
    Array.from({ length: 35 }, (_, i) => addDaysISO(startDate, i)), 
    [startDate]
  );

  // Group days by week
  const weekGroups = useMemo(() => {
    const groups: { week: number; startIndex: number; span: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const w = isoWeekNumber(days[i]);
      let j = i + 1;
      while (j < days.length && isoWeekNumber(days[j]) === w) j++;
      groups.push({ week: w, startIndex: i, span: j - i });
      i = j;
    }
    return groups;
  }, [days]);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Load services
        const allServices = getAllServices().filter(s => s.actief && !s.system);
        setServices(allServices);

        // Check if roster staffing is locked
        const locked = isRosterStaffingLocked(rosterId);
        setIsLocked(locked);

        // Check if roster has staffing rules, if not initialize
        let existingRules = getRosterStaffingRules(rosterId);
        if (existingRules.length === 0) {
          console.log('Initializing roster staffing rules...');
          initializeRosterStaffing(rosterId, startDate, days);
          existingRules = getRosterStaffingRules(rosterId);
        }

        // Load date overviews
        const overviews = getDateStaffingOverview(rosterId, days);
        setDateOverviews(overviews);

      } catch (err) {
        console.error('Error loading staffing data:', err);
        setError('Kon bezettingsgegevens niet laden');
      }
    }

    loadData();
  }, [rosterId, startDate, days]);

  // Handle staffing rule change
  const handleStaffingChange = async (date: string, dienstId: string, field: 'min' | 'max', value: number) => {
    if (isLocked) {
      alert('Bezetting is vastgesteld en kan niet meer worden gewijzigd');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Find current rule
      const currentOverview = dateOverviews.find(d => d.date === date);
      const currentRule = currentOverview?.rules.find(r => r.rule.dienstId === dienstId);
      
      if (!currentRule) {
        throw new Error('Bezettingsregel niet gevonden');
      }

      // Create updated rule input
      const ruleInput: RosterStaffingRuleInput = {
        rosterId,
        date,
        dienstId,
        minBezetting: field === 'min' ? value : currentRule.rule.minBezetting,
        maxBezetting: field === 'max' ? value : currentRule.rule.maxBezetting
      };

      // Save rule
      await upsertRosterStaffingRule(ruleInput);

      // Reload data
      const overviews = getDateStaffingOverview(rosterId, days);
      setDateOverviews(overviews);
      setHasChanges(true);

    } catch (err) {
      console.error('Error updating staffing rule:', err);
      setError(err instanceof Error ? err.message : 'Kon bezettingsregel niet opslaan');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle lock staffing
  const handleLockStaffing = async () => {
    if (isLocked) return;

    const confirmed = confirm(
      'Weet je zeker dat je de bezetting wilt vastleggen?\n\n' +
      'Na vastleggen kunnen bezettingsregels niet meer worden gewijzigd. ' +
      'De knop "Bezetting beheren" wordt dan "Bezetting vastgesteld" en is niet meer klikbaar.'
    );

    if (!confirmed) return;

    setIsSaving(true);
    setError('');

    try {
      await lockRosterStaffing(rosterId);
      setIsLocked(true);
      setHasChanges(false);
      alert('Bezetting is succesvol vastgesteld!');
      onLocked();
    } catch (err) {
      console.error('Error locking staffing:', err);
      setError(err instanceof Error ? err.message : 'Kon bezetting niet vastleggen');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasChanges && !isLocked) {
      const confirmed = confirm(
        'Je hebt wijzigingen gemaakt die nog niet zijn vastgelegd.\n\n' +
        'Weet je zeker dat je wilt sluiten?'
      );
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Beheer bezetting voor rooster {rosterPeriod}
            </h2>
            {isLocked && (
              <div className="mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ Bezetting vastgesteld
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-auto border rounded">
            <table className="min-w-[1400px] border-separate border-spacing-0 text-sm">
              <thead>
                {/* Week headers */}
                <tr>
                  <th className="sticky left-0 top-0 z-30 bg-gray-50 border px-3 py-2 text-left w-[200px]" rowSpan={2}>
                    Dienst
                  </th>
                  {weekGroups.map(g => (
                    <th key={`w-${g.week}-${g.startIndex}`} 
                        className="sticky top-0 z-20 bg-gray-100 border px-2 py-2 text-center text-sm text-gray-800" 
                        colSpan={g.span * 2}>
                      Week {g.week}
                    </th>
                  ))}
                </tr>
                
                {/* Date headers */}
                <tr>
                  {days.map(date => {
                    const short = getDayShort(date);
                    const weekend = isWeekend(date);
                    const day = date.split('-')[2];
                    const month = date.split('-')[1];
                    const colorClass = weekend ? 'text-red-600' : 'text-gray-800';
                    
                    return (
                      <React.Fragment key={date}>
                        <th className={`sticky top-8 z-20 bg-gray-50 border px-1 py-2 text-xs ${colorClass} w-[50px]`}>
                          <div className="flex flex-col items-center">
                            <span className="uppercase leading-3">{short}</span>
                            <span className="leading-3">{day}-{month}</span>
                            <span className="text-[10px] text-gray-500">min</span>
                          </div>
                        </th>
                        <th className={`sticky top-8 z-20 bg-gray-50 border px-1 py-2 text-xs ${colorClass} w-[50px]`}>
                          <div className="flex flex-col items-center">
                            <span className="uppercase leading-3">{short}</span>
                            <span className="leading-3">{day}-{month}</span>
                            <span className="text-[10px] text-gray-500">max</span>
                          </div>
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {services.map(service => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    {/* Service name */}
                    <td className="sticky left-0 z-10 bg-white border px-3 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: service.kleur }}
                        />
                        <div>
                          <div className="font-medium">{service.code} - {service.naam}</div>
                          <div className="text-xs text-gray-500">{service.beschrijving}</div>
                        </div>
                      </div>
                    </td>

                    {/* Min/Max cells for each date */}
                    {days.map(date => {
                      const overview = dateOverviews.find(d => d.date === date);
                      const ruleWithService = overview?.rules.find(r => r.rule.dienstId === service.id);
                      const rule = ruleWithService?.rule;
                      
                      const minValue = rule?.minBezetting ?? 0;
                      const maxValue = rule?.maxBezetting ?? 2;

                      return (
                        <React.Fragment key={`${service.id}-${date}`}>
                          {/* Min cell */}
                          <td className="border p-1">
                            <select
                              value={minValue}
                              onChange={(e) => handleStaffingChange(date, service.id, 'min', parseInt(e.target.value))}
                              disabled={isLocked || isSaving}
                              className="w-full px-1 py-1 text-xs border rounded bg-blue-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              {Array.from({ length: 9 }, (_, i) => (
                                <option key={i} value={i}>{i}</option>
                              ))}
                            </select>
                          </td>
                          
                          {/* Max cell */}
                          <td className="border p-1">
                            <select
                              value={maxValue}
                              onChange={(e) => handleStaffingChange(date, service.id, 'max', parseInt(e.target.value))}
                              disabled={isLocked || isSaving}
                              className="w-full px-1 py-1 text-xs border rounded bg-green-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              {Array.from({ length: 10 }, (_, i) => (
                                <option key={i} value={i}>
                                  {i === 9 ? 'Onbep' : i.toString()}
                                </option>
                              ))}
                            </select>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {isSaving && (
                <span className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Opslaan...
                </span>
              )}
              {hasChanges && !isSaving && (
                <span className="text-yellow-600">● Wijzigingen automatisch opgeslagen</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              disabled={isSaving}
            >
              Terug naar rooster
            </button>
            
            {!isLocked && (
              <button
                onClick={handleLockStaffing}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Bezig...' : '🔒 Bezetting vastleggen'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}