'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Save, Printer, AlertTriangle, Check } from 'lucide-react';
import { Dienst } from '@/lib/types/dienst';
import { 
  getAllServices,
  getAllServicesDayStaffing,
  updateServiceDayStaffingAndTeam,
  type ServiceDayStaffing
} from '@/lib/services/diensten-storage';
import { 
  getBezettingTag, 
  getBezettingTagClass,
  validateBezetting,
  toggleTeam,
  DAY_NAMES
} from '@/lib/utils/bezetting-tags';

function sortServices(services: Dienst[]): Dienst[] {
  return [...services].sort((a, b) => {
    if (a.code === 'NB') return -1;
    if (b.code === 'NB') return 1;
    if (a.code === '===') return -1;
    if (b.code === '===') return 1;
    return a.code.localeCompare(b.code);
  });
}

export default function ServicesByDayTypePage() {
  const [services, setServices] = useState<Dienst[]>([]);
  const [staffingData, setStaffingData] = useState<ServiceDayStaffing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [dienstenAlle, staffing] = await Promise.all([
        getAllServices(),
        getAllServicesDayStaffing()
      ]);
      const activeServices = sortServices(dienstenAlle.filter(s => s.actief));
      setServices(activeServices);
      setStaffingData(staffing);
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStaffingForService = (serviceId: string): ServiceDayStaffing | undefined => {
    return staffingData.find(s => s.service_id === serviceId);
  };

  const handleMinMaxChange = (
    serviceId: string,
    day: string,
    field: 'min' | 'max',
    value: string
  ) => {
    setStaffingData(prev => {
      const updated = [...prev];
      const index = updated.findIndex(s => s.service_id === serviceId);
      if (index < 0) return prev;
      const minKey = `${day}_min`;
      const maxKey = `${day}_max`;
      let minVal = Number((updated[index] as any)[minKey]) || 0;
      let maxVal = Number((updated[index] as any)[maxKey]) || 0;
      const numValue = parseInt(value) || 0;
      if (field === 'min') {
        minVal = numValue;
        if (maxVal < minVal) {
          maxVal = minVal;
          (updated[index] as any)[maxKey] = maxVal;
        }
        (updated[index] as any)[minKey] = minVal;
      } else {
        maxVal = Math.max(numValue, minVal);
        (updated[index] as any)[maxKey] = maxVal;
      }
      const errorKey = `${serviceId}-${day}`;
      const error = validateBezetting(minVal, maxVal);
      setValidationErrors(prev => {
        const newErrors = new Map(prev);
        if (error) {
          newErrors.set(errorKey, error);
        } else {
          newErrors.delete(errorKey);
        }
        return newErrors;
      });
      return updated;
    });
    setSaveStatus('idle');
  };

  const handleTeamToggle = (serviceId: string, team: 'tot' | 'gro' | 'ora') => {
    setStaffingData(prev => {
      const updated = [...prev];
      const index = updated.findIndex(s => s.service_id === serviceId);
      if (index >= 0) {
        const current = {
          tot: updated[index].tot_enabled,
          gro: updated[index].gro_enabled,
          ora: updated[index].ora_enabled
        };
        const newState = toggleTeam(team, current);
        updated[index].tot_enabled = newState.tot;
        updated[index].gro_enabled = newState.gro;
        updated[index].ora_enabled = newState.ora;
      }
      return updated;
    });
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    if (validationErrors.size > 0) {
      setSaveStatus('error');
      return;
    }
    try {
      setIsSaving(true);
      for (const staffing of staffingData) {
        await updateServiceDayStaffingAndTeam(
          staffing.service_id,
          {
            ma_min: staffing.ma_min,
            ma_max: staffing.ma_max,
            di_min: staffing.di_min,
            di_max: staffing.di_max,
            wo_min: staffing.wo_min,
            wo_max: staffing.wo_max,
            do_min: staffing.do_min,
            do_max: staffing.do_max,
            vr_min: staffing.vr_min,
            vr_max: staffing.vr_max,
            za_min: staffing.za_min,
            za_max: staffing.za_max,
            zo_min: staffing.zo_min,
            zo_max: staffing.zo_max
          },
          {
            tot_enabled: staffing.tot_enabled,
            gro_enabled: staffing.gro_enabled,
            ora_enabled: staffing.ora_enabled
          }
        );
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-lg text-gray-600">Laden...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3">
      <div className="max-w-[1550px] mx-auto">
        <div className="flex flex-row justify-between items-center mb-2">
          <Link href="/services" className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Diensten Beheren
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => alert('PDF export komt binnenkort')}
              className="inline-flex items-center gap-1 px-4 py-2 bg-slate-100 text-gray-600 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors text-xs font-medium shadow"
            >
              <Printer className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || validationErrors.size > 0}
              className="inline-flex items-center gap-1 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs font-medium shadow"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Bezig met opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
        <div className="bg-white rounded p-3 mb-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Diensten per Dagsoort</h1>
              <p className="text-gray-500 text-xs">
                Beheer minimum/maximum bezetting per dienst per dag van de week. Deze regels worden gebruikt bij roosterplanning.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5" />
            <div>
              <b className="text-blue-900">Interpretatie Bezettingsregels: </b>
              Min 0, Max 0 = Geen bezetting. Min 1, Max 1 = Exact 1. Min 1, Max 2 = 1 tot 2 personen. Min 2, Max 9 = Min 2, onbep max.
            </div>
          </div>
        </div>
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100 text-xs">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 w-52">Dienst</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600 w-44">Team</th>
                  {DAY_NAMES.map(day => (
                    <th key={day.short} className="px-1 py-2 text-center font-semibold text-gray-600 w-20">
                      <div>{day.long}</div>
                      <div className="text-[10px] text-gray-400">min | max</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {services.map(service => {
                  const staffing = getStaffingForService(service.id);
                  if (!staffing) return null;
                  return (
                    <tr key={service.id} className="hover:bg-gray-50 transition-colors h-12">
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                            style={{ backgroundColor: service.kleur }}
                          >
                            {service.code}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate text-xs">{service.naam}</div>
                            {service.beschrijving && (
                              <div className="text-[11px] text-gray-400 truncate">{service.beschrijving}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex flex-row items-center gap-1 justify-center">
                          <button
                            type="button"
                            onClick={() => handleTeamToggle(service.id, 'tot')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all min-w-[42px] border ${
                              staffing.tot_enabled
                                ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                                : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                          >Tot</button>
                          <button
                            type="button"
                            onClick={() => handleTeamToggle(service.id, 'gro')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all min-w-[42px] border ${
                              staffing.gro_enabled
                                ? 'bg-green-600 border-green-700 text-white shadow-sm'
                                : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                          >Gro</button>
                          <button
                            type="button"
                            onClick={() => handleTeamToggle(service.id, 'ora')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all min-w-[42px] border ${
                              staffing.ora_enabled
                                ? 'bg-orange-500 border-orange-700 text-white shadow-sm'
                                : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                          >Ora</button>
                        </div>
                      </td>
                      {DAY_NAMES.map(day => {
                        const minKey = `${day.short}_min`;
                        const maxKey = `${day.short}_max`;
                        const minVal = (staffing as any)[minKey] as number;
                        const maxVal = (staffing as any)[maxKey] as number;
                        const errorKey = `${service.id}-${day.short}`;
                        const hasError = validationErrors.has(errorKey);
                        return (
                          <td key={day.short} className="px-1 py-1">
                            <div className="space-y-1 flex flex-col items-center">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="8"
                                  value={minVal}
                                  onChange={(e) => handleMinMaxChange(service.id, day.short, 'min', e.target.value)}
                                  className={`w-9 px-1 py-1 text-center text-xs border rounded focus:outline-none focus:ring-2 ${
                                    hasError ? 'border-red-300 focus:ring-red-500 bg-red-50 shadow' : 'border-gray-300 focus:ring-blue-500'
                                  }`}
                                />
                                <span className="text-gray-300 text-xs">|</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="9"
                                  value={maxVal}
                                  onChange={(e) => handleMinMaxChange(service.id, day.short, 'max', e.target.value)}
                                  className={`w-9 px-1 py-1 text-center text-xs border rounded focus:outline-none focus:ring-2 ${
                                    hasError ? 'border-red-300 focus:ring-red-500 bg-red-50 shadow' : 'border-gray-300 focus:ring-blue-500'
                                  }`}
                                />
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded tag-badge ${getBezettingTagClass(minVal, maxVal)}`}>{getBezettingTag(minVal, maxVal)}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <div className="bg-white rounded shadow p-3">
            <div className="text-gray-500 mb-1">Actieve Diensten</div>
            <div className="text-2xl font-bold text-blue-600">{services.length}</div>
          </div>
          <div className="bg-white rounded shadow p-3">
            <div className="text-gray-500 mb-1">Bezettingsregels</div>
            <div className="text-2xl font-bold text-green-600">{services.length * 7}</div>
          </div>
          <div className="bg-white rounded shadow p-3">
            <div className="text-gray-500 mb-1">Validatiefouten</div>
            <div className="text-2xl font-bold text-red-600">{validationErrors.size}</div>
          </div>
          <div className="bg-white rounded shadow p-3">
            <div className="text-gray-500 mb-1">Status</div>
            <div className="flex items-center gap-1">
              {saveStatus === 'saved' && (<><Check className="w-4 h-4 text-green-600" /><span className="font-medium text-green-600">Opgeslagen</span></>)}
              {saveStatus === 'error' && (<><AlertTriangle className="w-4 h-4 text-red-600" /><span className="font-medium text-red-600">Fout</span></>)}
              {saveStatus === 'idle' && (<span className="font-medium text-orange-600">Niet opgeslagen</span>)}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .tag-badge {
          font-weight: 500;
        }
        .tag-geen {
          background-color: #f3f4f6;
          color: #6b7280;
        }
        .tag-exact-1 {
          background-color: #dbeafe;
          color: #1e40af;
        }
        .tag-exact-2 {
          background-color: #d1fae5;
          color: #065f46;
        }
        .tag-onbeperkt {
          background-color: #fef3c7;
          color: #92400e;
        }
        .tag-range {
          background-color: #fed7aa;
          color: #9a3412;
        }
      `}</style>
    </div>
  );
}
