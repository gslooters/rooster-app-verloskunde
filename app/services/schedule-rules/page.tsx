'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Save, Printer, AlertTriangle, Check } from 'lucide-react';
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
        <div className="flex flex-row justify-between items-center mb-2">
          <Link href="/services" className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Diensten Beheren
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handlePDFClassic}
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
        {/* ...rest van de tabel interface volgt zoals vorige code ... */}
      </div>
    </div>
  );
}
