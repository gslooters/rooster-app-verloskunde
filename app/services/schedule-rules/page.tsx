'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Save, AlertTriangle, Check } from 'lucide-react';
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
      
      const activeServices = dienstenAlle.filter(s => s.actief);
      setServices(activeServices);
      setStaffingData(staffing);
    } catch (error) {
      console.error('Error loading data:', error);
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
    const numValue = parseInt(value) || 0;
    
    setStaffingData(prev => {
      const updated = [...prev];
      const index = updated.findIndex(s => s.service_id === serviceId);
      
      if (index >= 0) {
        const minKey = `${day}_min` as keyof ServiceDayStaffing;
        const maxKey = `${day}_max` as keyof ServiceDayStaffing;
        
        if (field === 'min') {
          (updated[index] as any)[minKey] = numValue;
        } else {
          (updated[index] as any)[maxKey] = numValue;
        }
        
        // Valideer
        const minVal = (updated[index] as any)[minKey];
        const maxVal = (updated[index] as any)[maxKey];
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
      }
      
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
      
      // Update alle diensten
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
      
      // Reset status na 3 seconden
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving:', error);
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Dashboard
          </Link>
          
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Diensten per Dagsoort</h1>
                <p className="text-gray-600">
                  Beheer minimum/maximum bezetting per dienst per dag van de week. Deze regels worden gebruikt bij roosterplanning.
                </p>
              </div>
            </div>
          </div>

          {/* Interpretatie Bezettingsregels */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Interpretatie Bezettingsregels</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-900">Min 0, Max 0:</span>
                    <span className="text-blue-700"> Geen bezetting</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900">Min 1, Max 1:</span>
                    <span className="text-blue-700"> Exact 1 persoon</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900">Min 1, Max 2:</span>
                    <span className="text-blue-700"> 1 tot 2 personen</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900">Min 2, Max 9:</span>
                    <span className="text-blue-700"> Min 2, onbep max</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-64">
                    Dienst
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-32">
                    Team
                  </th>
                  {DAY_NAMES.map(day => (
                    <th key={day.short} className="px-3 py-3 text-center text-sm font-semibold text-gray-700 w-32">
                      <div>{day.long}</div>
                      <div className="text-xs text-gray-500 font-normal">min | max</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {services.map(service => {
                  const staffing = getStaffingForService(service.id);
                  if (!staffing) return null;
                  
                  return (
                    <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                      {/* Dienst Info */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                            style={{ backgroundColor: service.kleur }}
                          >
                            {service.code}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">{service.naam}</div>
                            <div className="text-xs text-gray-500 truncate">{service.beschrijving}</div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Team Selector */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTeamToggle(service.id, 'tot')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                              staffing.tot_enabled
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            Tot
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTeamToggle(service.id, 'gro')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                              staffing.gro_enabled
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            Gro
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTeamToggle(service.id, 'ora')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                              staffing.ora_enabled
                                ? 'bg-orange-600 text-white shadow-sm'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            Ora
                          </button>
                          <div className="text-[10px] text-gray-500 text-center mt-0.5">Alle</div>
                        </div>
                      </td>
                      
                      {/* Day Columns */}
                      {DAY_NAMES.map(day => {
                        const minKey = `${day.short}_min` as keyof ServiceDayStaffing;
                        const maxKey = `${day.short}_max` as keyof ServiceDayStaffing;
                        const minVal = staffing[minKey] as number;
                        const maxVal = staffing[maxKey] as number;
                        const errorKey = `${service.id}-${day.short}`;
                        const hasError = validationErrors.has(errorKey);
                        
                        return (
                          <td key={day.short} className="px-3 py-4">
                            <div className="space-y-2">
                              {/* Input Fields */}
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="8"
                                  value={minVal}
                                  onChange={(e) => handleMinMaxChange(service.id, day.short, 'min', e.target.value)}
                                  className={`w-12 px-2 py-1 text-center text-sm border rounded focus:outline-none focus:ring-2 ${
                                    hasError 
                                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                                      : 'border-gray-300 focus:ring-blue-500'
                                  }`}
                                />
                                <span className="text-gray-400 text-sm">|</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="9"
                                  value={maxVal}
                                  onChange={(e) => handleMinMaxChange(service.id, day.short, 'max', e.target.value)}
                                  className={`w-12 px-2 py-1 text-center text-sm border rounded focus:outline-none focus:ring-2 ${
                                    hasError
                                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                                      : 'border-gray-300 focus:ring-blue-500'
                                  }`}
                                />
                              </div>
                              
                              {/* Tag */}
                              <div className="flex justify-center">
                                <span className={`text-xs px-2 py-0.5 rounded tag-badge ${getBezettingTagClass(minVal, maxVal)}`}>
                                  {getBezettingTag(minVal, maxVal)}
                                </span>
                              </div>
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

        {/* Footer Stats & Actions */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Actieve Diensten</div>
            <div className="text-3xl font-bold text-blue-600">{services.length}</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Bezettingsregels</div>
            <div className="text-3xl font-bold text-green-600">{services.length * 7}</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Validatiefouten</div>
            <div className="text-3xl font-bold text-red-600">{validationErrors.size}</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <div className="flex items-center gap-2">
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Opgeslagen</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-600">Fout</span>
                </>
              )}
              {saveStatus === 'idle' && (
                <span className="text-sm font-medium text-orange-600">Niet opgeslagen</span>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || validationErrors.size > 0}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Bezig met opslaan...' : 'Opslaan'}
          </button>
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