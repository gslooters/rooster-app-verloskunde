'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, FileSpreadsheet, Save, RotateCcw, Upload, AlertTriangle } from 'lucide-react';
import { Dienst } from '@/lib/types/dienst';
import { DayTypeStaffing, DayTypeStaffingInput, DAYS_OF_WEEK } from '@/lib/types/daytype-staffing';
import { getAllServices } from '@/lib/services/diensten-storage';
import { 
  getAllDayTypeStaffing, 
  upsertStaffingRule, 
  initializeDefaultStaffingRules,
  resetToDefaults
} from '@/lib/services/daytype-staffing-storage';
import { downloadCSV, printToPDF } from '@/lib/export/daytype-staffing-export';

export default function ServicesByDayTypePage() {
  const [services, setServices] = useState<Dienst[]>([]);
  const [staffingRules, setStaffingRules] = useState<DayTypeStaffing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load services
      const loadedServices = getAllServices().filter(service => service.actief);
      setServices(loadedServices);
      
      // Load or initialize staffing rules
      let loadedRules = getAllDayTypeStaffing();
      
      // If no rules exist, initialize defaults
      if (loadedRules.length === 0 && loadedServices.length > 0) {
        loadedRules = initializeDefaultStaffingRules();
      }
      
      setStaffingRules(loadedRules);
      validateRules(loadedRules);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStaffingRule = (dienstId: string, dagSoort: number): DayTypeStaffing => {
    return staffingRules.find(rule => 
      rule.dienstId === dienstId && rule.dagSoort === dagSoort
    ) || {
      id: '',
      dienstId,
      dagSoort,
      minBezetting: 0,
      maxBezetting: 0,
      created_at: '',
      updated_at: ''
    };
  };

  const updateStaffingRule = (dienstId: string, dagSoort: number, field: 'minBezetting' | 'maxBezetting', value: number) => {
    const currentRule = getStaffingRule(dienstId, dagSoort);
    let newMin = currentRule.minBezetting;
    let newMax = currentRule.maxBezetting;
    
    if (field === 'minBezetting') {
      newMin = value;
      // Auto-adjust max if it becomes less than min
      if (newMax < newMin) {
        newMax = newMin;
      }
    } else {
      newMax = value;
      // Auto-adjust min if it becomes greater than max
      if (newMin > newMax) {
        newMin = newMax;
      }
    }

    // Update the rule in state immediately for UI responsiveness
    const updatedRules = staffingRules.map(rule => {
      if (rule.dienstId === dienstId && rule.dagSoort === dagSoort) {
        return { ...rule, minBezetting: newMin, maxBezetting: newMax };
      }
      return rule;
    });
    
    // If rule doesn't exist in state yet, add it
    const ruleExists = staffingRules.some(rule => 
      rule.dienstId === dienstId && rule.dagSoort === dagSoort
    );
    
    if (!ruleExists) {
      const newRule: DayTypeStaffing = {
        id: `temp_${Date.now()}`,
        dienstId,
        dagSoort,
        minBezetting: newMin,
        maxBezetting: newMax,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      updatedRules.push(newRule);
    }
    
    setStaffingRules(updatedRules);
    setHasChanges(true);
    validateRules(updatedRules);
  };

  const validateRules = (rules: DayTypeStaffing[]) => {
    const errors = new Set<string>();
    
    rules.forEach(rule => {
      const key = `${rule.dienstId}-${rule.dagSoort}`;
      if (rule.minBezetting > rule.maxBezetting) {
        errors.add(key);
      }
    });
    
    setValidationErrors(errors);
  };

  const saveAllRules = async () => {
    if (validationErrors.size > 0) {
      alert('Er zijn nog validatiefouten. Los deze eerst op voordat je opslaat.');
      return;
    }

    setSaveStatus('saving');
    
    try {
      // Save all rules to localStorage
      const savePromises = staffingRules.map(rule => {
        if (rule.id.startsWith('temp_')) {
          // New rule, use upsert
          const input: DayTypeStaffingInput = {
            dienstId: rule.dienstId,
            dagSoort: rule.dagSoort,
            minBezetting: rule.minBezetting,
            maxBezetting: rule.maxBezetting
          };
          return upsertStaffingRule(input);
        }
        return rule;
      });
      
      await Promise.all(savePromises);
      
      // Reload from storage to get updated IDs
      const updatedRules = getAllDayTypeStaffing();
      setStaffingRules(updatedRules);
      
      setHasChanges(false);
      setSaveStatus('saved');
      
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving rules:', error);
      setSaveStatus('error');
      alert('Fout bij opslaan: ' + (error as Error).message);
    }
  };

  const handleResetToDefaults = () => {
    if (confirm('Weet je zeker dat je alle regels wilt resetten naar standaardwaarden?')) {
      const defaultRules = resetToDefaults();
      setStaffingRules(defaultRules);
      setHasChanges(false);
      validateRules(defaultRules);
    }
  };

  const getBezettingColor = (min: number, max: number): string => {
    if (min === 0 && max === 0) return 'bg-gray-100 text-gray-500';
    if (min === max && min === 1) return 'bg-blue-100 text-blue-800';
    if (min >= 1 && max <= 3) return 'bg-green-100 text-green-800';
    if (max >= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  const getBezettingText = (min: number, max: number): string => {
    if (min === 0 && max === 0) return 'Geen';
    if (min === max) return `Exact ${min}`;
    if (max === 9) return `Min ${min}, Onbeperkt`;
    return `${min}-${max}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Bezettingsregels laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg">
          
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Link href="/services" className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Diensten Beheren
                </Link>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleResetToDefaults}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Reset naar standaardwaarden"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={() => downloadCSV(staffingRules, services)}
                  className="flex items-center gap-2 px-4 py-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  title="Exporteer naar Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={() => printToPDF(staffingRules, services)}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  title="Exporteer naar PDF"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={saveAllRules}
                  disabled={!hasChanges || saveStatus === 'saving'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    hasChanges && saveStatus !== 'saving'
                      ? 'text-white bg-blue-600 hover:bg-blue-700' 
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {saveStatus === 'saving' ? 'Opslaan...' : saveStatus === 'saved' ? 'Opgeslagen!' : 'Opslaan'}
                </button>
              </div>
            </div>
            
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center">
                <span className="text-2xl mr-3">📅</span>
                Diensten per Dagsoort
              </h1>
              <p className="text-gray-600">
                Beheer minimum/maximum bezetting per dienst per dag van de week. Deze regels worden gebruikt bij roosterplanning.
              </p>
            </div>
          </div>

          {/* Information Panel */}
          <div className="p-6 bg-blue-50 border-b border-gray-200">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Interpretatie Bezettingsregels
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-blue-800">
              <div><strong>Min 0, Max 0:</strong> Geen bezetting</div>
              <div><strong>Min 1, Max 1:</strong> Exact 1 persoon</div>
              <div><strong>Min 1, Max 2:</strong> 1 tot 2 personen</div>
              <div><strong>Min 2, Max 9:</strong> Min 2, onbeperkt max</div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6">
            {services.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📋</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Geen actieve diensten gevonden</h3>
                <p className="text-gray-600 mb-4">Voeg eerst diensten toe via "Diensten beheren" om bezettingsregels in te stellen.</p>
                <Link 
                  href="/services/types" 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Diensten beheren
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-semibold text-gray-900 border-r border-gray-200 min-w-[180px]">
                        Dienst
                      </th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.code} className="text-center p-3 font-semibold text-gray-900 border-r border-gray-200 min-w-[100px]">
                          <div className="text-sm">{day.name}</div>
                          <div className="text-xs text-gray-500 font-normal mt-1">min | max</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service, serviceIndex) => (
                      <tr key={service.id} className={serviceIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-4 border-r border-gray-200">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-5 h-5 rounded-sm flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: service.kleur }}
                            >
                              {service.code.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{service.naam}</div>
                              <div className="text-sm text-gray-500">{service.beschrijving}</div>
                            </div>
                          </div>
                        </td>
                        {DAYS_OF_WEEK.map(day => {
                          const rule = getStaffingRule(service.id, day.index);
                          const errorKey = `${service.id}-${day.index}`;
                          const hasError = validationErrors.has(errorKey);
                          
                          return (
                            <td key={day.code} className="p-2 border-r border-gray-200 text-center">
                              <div className="flex items-center justify-center gap-1 mb-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="8"
                                  value={rule.minBezetting}
                                  onChange={(e) => updateStaffingRule(service.id, day.index, 'minBezetting', parseInt(e.target.value) || 0)}
                                  className={`w-12 h-8 text-center text-sm border rounded focus:ring-2 focus:ring-blue-500 ${
                                    hasError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                  }`}
                                />
                                <span className="text-gray-400 text-sm">|</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="9"
                                  value={rule.maxBezetting}
                                  onChange={(e) => updateStaffingRule(service.id, day.index, 'maxBezetting', parseInt(e.target.value) || 0)}
                                  className={`w-12 h-8 text-center text-sm border rounded focus:ring-2 focus:ring-blue-500 ${
                                    hasError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                  }`}
                                />
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-medium ${getBezettingColor(rule.minBezetting, rule.maxBezetting)}`}>
                                {getBezettingText(rule.minBezetting, rule.maxBezetting)}
                              </div>
                              {hasError && (
                                <div className="text-xs text-red-600 mt-1 font-medium">Min {'>'} Max</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary Statistics */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-2">Actieve Diensten</h3>
                <div className="text-2xl font-bold text-blue-600">{services.length}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-2">Bezettingsregels</h3>
                <div className="text-2xl font-bold text-green-600">{staffingRules.length}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-2">Validatiefouten</h3>
                <div className={`text-2xl font-bold ${validationErrors.size > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {validationErrors.size}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-2">Status</h3>
                <div className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${
                  hasChanges 
                    ? 'bg-orange-100 text-orange-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {hasChanges ? 'Niet opgeslagen' : 'Opgeslagen'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating save reminder */}
        {hasChanges && (
          <div className="fixed bottom-4 right-4 bg-orange-100 border border-orange-300 rounded-lg p-3 shadow-lg animate-pulse">
            <div className="flex items-center gap-2 text-orange-800">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-sm font-medium">Niet-opgeslagen wijzigingen</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
