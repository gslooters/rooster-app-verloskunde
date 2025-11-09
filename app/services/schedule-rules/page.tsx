'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Save, Printer, AlertTriangle, Check, Info } from 'lucide-react';
import { Dienst } from '@/lib/types/dienst';
import { getAllServices, getAllServicesDayStaffing, updateServiceDayStaffingAndTeam, type ServiceDayStaffing } from '@/lib/services/diensten-storage';
import { getBezettingTag, getBezettingTagClass, validateBezetting, toggleTeam, DAY_NAMES } from '@/lib/utils/bezetting-tags';
import { printToPDFClassic } from '@/lib/export/pdf-export-classic';

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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [dienstenAlle, staffing] = await Promise.all([
        getAllServices(),
        getAllServicesDayStaffing()
      ]);
      const activeServices = sortServices(dienstenAlle.filter(s => s.actief));
      setServices(activeServices);
      setStaffingData(staffing);
    } catch (error: any) {
      setLoadError('Fout bij laden planning-data. Probeer opnieuw of neem contact op met beheer.');
      setServices([]);
      setStaffingData([]);
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

  const handlePDFClassic = () => {
    printToPDFClassic(staffingData, services);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-lg text-red-700 font-medium">{loadError}</div>
      </div>
    );
  }
  if (!services.length) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-lg text-gray-500 font-medium">Geen diensten gevonden. Controleer of er actieve diensten zijn ingesteld.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3">
      <div className="max-w-[1550px] mx-auto">
        {/* HEADER MET TERUG EN ACTIEKNOPPEN */}
        <div className="flex flex-row justify-between items-center mb-3">
          <Link href="/services" className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Diensten Beheren
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handlePDFClassic}
              className="inline-flex items-center gap-1 px-4 py-2 bg-slate-100 text-gray-600 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors text-sm font-medium shadow"
            >
              <Printer className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || validationErrors.size > 0}
              className="inline-flex items-center gap-1 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Bezig met opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>

        {/* TITEL & BESCHRIJVING BLOK */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">📋 Diensten per Dagsoort</h1>
          <p className="text-sm text-gray-600 mb-3">
            Stel per dienst en dag in hoeveel medewerkers minimaal en maximaal ingepland moeten worden. 
            Kies ook voor welke teams deze dienst beschikbaar is (Tot/Gro/Ora).
          </p>
          
          {/* INFO BLOK - INTERPRETATIE */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Bezettingsregels interpretatie:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800 ml-1">
                  <li><span className="font-medium">Geen</span> (0-0): Deze dienst wordt niet gebruikt op deze dag</li>
                  <li><span className="font-medium">Exact 1</span> (1-1): Precies 1 medewerker vereist</li>
                  <li><span className="font-medium">0-2</span>: Tussen 0 en 2 medewerkers toegestaan (flexibel)</li>
                  <li><span className="font-medium">2-4</span>: Minimaal 2, maximaal 4 medewerkers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* HOOFD CONTENT TABEL - COMPACT LAYOUT MET TAGS */}
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b-2 border-gray-300 text-xs sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left font-bold text-gray-700 w-60 border-r border-gray-200 bg-gray-50">
                  Dienst
                </th>
                <th className="px-2 py-3 text-center font-bold text-gray-700 w-44 border-r border-gray-200 bg-gray-50">
                  Team
                </th>
                {DAY_NAMES.map(day => (
                  <th 
                    key={day.short} 
                    className="px-2 py-3 text-center font-bold text-gray-700 w-24 border-r border-gray-200 bg-gray-50"
                  >
                    {day.long}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {services.map(service => {
                const staffing = getStaffingForService(service.id);
                if (!staffing) return null;
                return (
                  <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                    {/* DIENST KOLOM */}
                    <td className="px-3 py-2 border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow"
                          style={{ backgroundColor: service.kleur }}
                        >
                          {service.code}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate text-sm">{service.naam}</div>
                          {service.beschrijving && (
                            <div className="text-xs text-gray-500 truncate">{service.beschrijving}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* TEAM KOLOM */}
                    <td className="px-2 py-2 border-r border-gray-200">
                      <div className="flex flex-row items-center gap-1 justify-center">
                        <button
                          type="button"
                          onClick={() => handleTeamToggle(service.id, 'tot')}
                          className={`px-2 py-1 rounded text-xs font-semibold transition-all min-w-[38px] border ${
                            staffing.tot_enabled
                              ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                              : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
                        >Tot</button>
                        <button
                          type="button"
                          onClick={() => handleTeamToggle(service.id, 'gro')}
                          className={`px-2 py-1 rounded text-xs font-semibold transition-all min-w-[38px] border ${
                            staffing.gro_enabled
                              ? 'bg-green-600 border-green-700 text-white shadow-sm'
                              : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
                        >Gro</button>
                        <button
                          type="button"
                          onClick={() => handleTeamToggle(service.id, 'ora')}
                          className={`px-2 py-1 rounded text-xs font-semibold transition-all min-w-[38px] border ${
                            staffing.ora_enabled
                              ? 'bg-orange-500 border-orange-700 text-white shadow-sm'
                              : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
                        >Ora</button>
                      </div>
                    </td>

                    {/* DAG KOLOMMEN - COMPACT MET TAGS */}
                    {DAY_NAMES.map(day => {
                      const minKey = `${day.short}_min`;
                      const maxKey = `${day.short}_max`;
                      const minVal = (staffing as any)[minKey] as number;
                      const maxVal = (staffing as any)[maxKey] as number;
                      const errorKey = `${service.id}-${day.short}`;
                      const hasError = validationErrors.has(errorKey);
                      const tag = getBezettingTag(minVal, maxVal);
                      const tagClass = getBezettingTagClass(tag);

                      return (
                        <td key={day.short} className="px-2 py-2 border-r border-gray-200">
                          {/* INPUTS IN 1 REGEL MET | */}
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <input
                              type="number"
                              min="0"
                              max="8"
                              value={minVal}
                              onChange={e => handleMinMaxChange(service.id, day.short, 'min', e.target.value)}
                              className={`w-9 px-1 py-1 text-center text-xs border rounded focus:outline-none focus:ring-2 font-medium ${
                                hasError ? 'border-red-400 focus:ring-red-500 bg-red-50 shadow' : 'border-gray-300 focus:ring-blue-500 bg-white'
                              }`}
                            />
                            <span className="text-gray-400 text-xs font-bold">|</span>
                            <input
                              type="number"
                              min="0"
                              max="9"
                              value={maxVal}
                              onChange={e => handleMinMaxChange(service.id, day.short, 'max', e.target.value)}
                              className={`w-9 px-1 py-1 text-center text-xs border rounded focus:outline-none focus:ring-2 font-medium ${
                                hasError ? 'border-red-400 focus:ring-red-500 bg-red-50 shadow' : 'border-gray-300 focus:ring-blue-500 bg-white'
                              }`}
                            />
                          </div>
                          {/* TAG DIRECT ONDER INPUTS */}
                          <div className="flex items-center justify-center">
                            <span className={`${tagClass} px-2 py-0.5 rounded text-[10px] font-semibold shadow-sm`}>
                              {tag}
                            </span>
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

        {/* STATUS FEEDBACK - ALLEEN ONDER OPSLAAN KNOP */}
        {saveStatus === 'saved' && (
          <div className="mt-2 flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />
            <span>Wijzigingen opgeslagen</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <span>Fout bij opslaan. Controleer invoer en probeer opnieuw.</span>
          </div>
        )}
      </div>
    </div>
  );
}