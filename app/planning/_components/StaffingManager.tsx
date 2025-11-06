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
import { RosterStaffingRuleInput, DateStaffingOverview, getDayShort } from '@/lib/types/roster-staffing';
import { Dienst } from '@/lib/types/dienst';
import ServiceCell from './ServiceCell';
import '@/styles/staffing-management.css';

function addDaysISO(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; }
function isoWeekNumber(iso: string): number { const d = new Date(iso + 'T00:00:00'); const target = new Date(d.valueOf()); const dayNr = (d.getDay() + 6) % 7; target.setDate(target.getDate() - dayNr + 3); const firstThursday = new Date(target.getFullYear(), 0, 4); const ftDay = (firstThursday.getDay() + 6) % 7; firstThursday.setDate(firstThursday.getDate() - ftDay + 3); return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000)); }
function isWeekend(iso: string): boolean { const dayOfWeek = new Date(iso + 'T00:00:00').getDay(); return dayOfWeek === 0 || dayOfWeek === 6; }

interface StaffingManagerProps { rosterId: string; rosterPeriod: string; startDate: string; onClose: () => void; onLocked: () => void; }

type PendingChange = { date: string; dienstId: string; minBezetting: number; maxBezetting: number };

export default function StaffingManager({ rosterId, rosterPeriod, startDate, onClose, onLocked }: StaffingManagerProps) {
  const [services, setServices] = useState<Dienst[]>([]);
  const [dateOverviews, setDateOverviews] = useState<DateStaffingOverview[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingChange>>({});
  const [error, setError] = useState<string>('');

  const days = useMemo(() => Array.from({ length: 35 }, (_, i) => addDaysISO(startDate, i)), [startDate]);
  const weekGroups = useMemo(() => { const groups: { week: number; startIndex: number; span: number }[] = []; let i = 0; while (i < days.length) { const w = isoWeekNumber(days[i]); let j = i + 1; while (j < days.length && isoWeekNumber(days[j]) === w) j++; groups.push({ week: w, startIndex: i, span: j - i }); i = j; } return groups; }, [days]);

  useEffect(() => { try { const allServices = getAllServices().filter(s => s.actief && !s.system); setServices(allServices); const locked = isRosterStaffingLocked(rosterId); setIsLocked(locked); let existingRules = getRosterStaffingRules(rosterId); if (existingRules.length === 0) { initializeRosterStaffing(rosterId, startDate, days); existingRules = getRosterStaffingRules(rosterId); } const overviews = getDateStaffingOverview(rosterId, days); setDateOverviews(overviews); } catch (err) { console.error('Error loading staffing data:', err); setError('Kon bezettingsgegevens niet laden'); } }, [rosterId, startDate, days]);

  const queueChange = (date: string, dienstId: string, field: 'min'|'max', value: number) => {
    if (isLocked) { alert('Bezetting is vastgesteld en kan niet meer worden gewijzigd'); return; }
    const key = `${date}__${dienstId}`;
    const overview = dateOverviews.find(d => d.date === date);
    const currentRule = overview?.rules.find(r => r.rule.dienstId === dienstId)?.rule;
    const base = pending[key] || { date, dienstId, minBezetting: currentRule?.minBezetting ?? 0, maxBezetting: currentRule?.maxBezetting ?? 2 };
    const updated: PendingChange = { ...base, [field === 'min' ? 'minBezetting' : 'maxBezetting']: value } as PendingChange;
    setPending(prev => ({ ...prev, [key]: updated }));
    setHasUnsaved(true);
  };

  const saveAll = async () => {
    if (isLocked) return;
    const items = Object.values(pending);
    if (items.length === 0) { setHasUnsaved(false); return; }
    setIsSaving(true);
    try {
      for (const item of items) {
        const input: RosterStaffingRuleInput = {
          rosterId,
          date: item.date,
          dienstId: item.dienstId,
          minBezetting: item.minBezetting,
          maxBezetting: item.maxBezetting
        };
        await upsertRosterStaffingRule(input);
      }
      const overviews = getDateStaffingOverview(rosterId, days);
      setDateOverviews(overviews);
      setPending({});
      setHasUnsaved(false);
    } catch (err) {
      console.error('Error saving staffing rules:', err);
      setError('Kon wijzigingen niet opslaan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLockStaffing = async () => {
    if (isLocked) return;
    if (Object.keys(pending).length > 0) {
      const ok = confirm('Je hebt niet-opgeslagen wijzigingen. Nu opslaan voor vastleggen?');
      if (ok) { await saveAll(); }
    }
    if (!confirm('Weet je zeker dat je de bezetting wilt vastleggen?')) return;
    setIsSaving(true);
    try { await lockRosterStaffing(rosterId); setIsLocked(true); onLocked(); } catch (err) { console.error('Error locking staffing:', err); setError('Kon bezetting niet vastleggen'); }
    finally { setIsSaving(false); }
  };

  const handleClose = () => {
    if (hasUnsaved && !isLocked) {
      if (!confirm('Je hebt niet-opgeslagen wijzigingen. Wil je dit scherm sluiten zonder op te slaan?')) return;
    }
    onClose();
  };

  return (
    <div className="staffing-modal">
      <div className="staffing-modal-content">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Beheer bezetting voor rooster {rosterPeriod}</h2>
            {isLocked && (<div className="mt-1 status-locked">✅ Bezetting vastgesteld</div>)}
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {error && (<div className="mx-6 mt-4 error-message">{error}</div>)}

        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-auto border rounded">
            <table className="staffing-table">
              <thead>
                <tr>
                  <th className="sticky-corner w-[180px]" rowSpan={2}>Dienst</th>
                  {weekGroups.map(g => (
                    <th key={`w-${g.week}-${g.startIndex}`} className="sticky-top text-center text-sm text-gray-800" colSpan={g.span * 2}>Week {g.week}</th>
                  ))}
                </tr>
                <tr>
                  {days.map(date => {
                    const short = getDayShort(date); const weekend = isWeekend(date); const [y,m,d] = date.split('-'); const colorClass = weekend ? 'weekend-header' : 'text-gray-800';
                    return (
                      <React.Fragment key={date}>
                        <th className={`sticky-top text-xs ${colorClass} w-[64px]`}>
                          <div className="flex flex-col items-center"><span className="uppercase leading-3">{short}</span><span className="leading-3">{d}-{m}</span><span className="text-[10px] text-gray-500">min</span></div>
                        </th>
                        <th className={`sticky-top text-xs ${colorClass} w-[64px]`}>
                          <div className="flex flex-col items-center"><span className="uppercase leading-3">{short}</span><span className="leading-3">{d}-{m}</span><span className="text-[10px] text-gray-500">max</span></div>
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {services.map(service => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="sticky-left font-medium whitespace-nowrap">
                      <ServiceCell code={service.code} color={service.kleur} description={service.naam} />
                    </td>
                    {days.map(date => {
                      const overview = dateOverviews.find(d => d.date === date); const ruleWithService = overview?.rules.find(r => r.rule.dienstId === service.id); const rule = ruleWithService?.rule; const minValue = (pending[`${date}__${service.id}`]?.minBezetting) ?? (rule?.minBezetting ?? 0); const maxValue = (pending[`${date}__${service.id}`]?.maxBezetting) ?? (rule?.maxBezetting ?? 2);
                      return (
                        <React.Fragment key={`${service.id}-${date}`}>
                          <td className="border p-1 min-w-[64px]">
                            <select value={minValue} onChange={(e) => queueChange(date, service.id, 'min', parseInt(e.target.value))} disabled={isLocked || isSaving} className="w-full px-1 py-1 text-xs border rounded staffing-input-min disabled:bg-gray-100 disabled:cursor-not-allowed">
                              {Array.from({ length: 9 }, (_, i) => (<option key={i} value={i}>{i}</option>))}
                            </select>
                          </td>
                          <td className="border p-1 min-w-[64px]">
                            <select value={maxValue} onChange={(e) => queueChange(date, service.id, 'max', parseInt(e.target.value))} disabled={isLocked || isSaving} className="w-full px-1 py-1 text-xs border rounded staffing-input-max disabled:bg-gray-100 disabled:cursor-not-allowed">
                              {Array.from({ length: 10 }, (_, i) => (<option key={i} value={i}>{i === 9 ? 'Onbep' : i.toString()}</option>))}
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

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {isSaving && (<span className="inline-flex items-center gap-2"><div className="loading-spinner" />Opslaan...</span>)}
            {!isSaving && hasUnsaved && (<span className="text-yellow-700">● Wijzigingen niet opgeslagen</span>)}
            {!isSaving && !hasUnsaved && (<span className="text-green-700">✓ Alle wijzigingen opgeslagen</span>)}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" disabled={isSaving}>Terug naar rooster</button>
            {!isLocked && (
              <>
                <button onClick={saveAll} disabled={isSaving || !hasUnsaved} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50">💾 Opslaan</button>
                <button onClick={handleLockStaffing} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">🔒 Bezetting vastleggen</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
