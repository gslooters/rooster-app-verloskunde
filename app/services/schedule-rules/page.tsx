'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, FileSpreadsheet, Save, RotateCcw, Upload, AlertTriangle } from 'lucide-react';
import { Dienst } from '@/lib/types/dienst';
import { 
  DayTypeStaffing, 
  DayTypeStaffingInput, 
  DAYS_OF_WEEK, 
  TeamScope,
  getDefaultTeamScope,
  getTeamScopeDisplayText,
  getBezettingText 
} from '@/lib/types/daytype-staffing';
import { getAllServices } from '@/lib/services/diensten-storage';
import { 
  getAllDayTypeStaffing, 
  upsertStaffingRule, 
  initializeDefaultStaffingRules,
  resetToDefaults,
  saveAllDayTypeStaffing,
  getServiceTeamScope,
  updateServiceTeamScope
} from '@/lib/services/daytype-staffing-storage';
import { downloadCSV, printToPDF } from '@/lib/export/daytype-staffing-export';
import TeamSelector from '@/app/_components/TeamSelector';

export default function ServicesByDayTypePage() {
  const [services, setServices] = useState<Dienst[]>([]);
  const [staffingRules, setStaffingRules] = useState<DayTypeStaffing[]>([]);
  const [serviceTeamScopes, setServiceTeamScopes] = useState<{[key: string]: TeamScope}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const validateRules = (rules: DayTypeStaffing[]) => {
    const errors = new Set<string>();
    rules.forEach(rule => {
      const key = `${rule.dienstId}-${rule.dagSoort}`;
      if (rule.minBezetting > rule.maxBezetting) errors.add(key);
    });
    setValidationErrors(errors);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const dienstenAlle = await getAllServices();
      const loadedServices = dienstenAlle.filter(service => service.actief);
      setServices(loadedServices);
      // Load staffing rules with migration support
      let loadedRules = getAllDayTypeStaffing();
      if (!loadedRules || loadedRules.length === 0) {
        loadedRules = await initializeDefaultStaffingRules();
      }
      setStaffingRules(loadedRules);
      // Load service team scopes
      const scopes: {[key: string]: TeamScope} = {};
      loadedServices.forEach(service => {
        scopes[service.id] = getServiceTeamScope(service.id);
      });
      setServiceTeamScopes(scopes);
      validateRules(loadedRules);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  /* ...resterende component code is ongewijzigd */
}
