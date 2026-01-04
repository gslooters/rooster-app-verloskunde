/**
 * DRAAD 90: Dienst Selectie Modal - Met Filtering op Dagdeel/Datum/Status
 * HERSTEL: rosterId doorgeven aan getServicesForEmployee voor service blocking
 * DRAAD399-FASE4,5: Team variant labels + variant_id collection
 * DRAAD402: FIXES - variant_id state + radio button logic + cache-busting
 * 
 * Modal pop-up voor toewijzen/wijzigen van diensten aan cellen
 * Ondersteunt alle 4 statussen:
 * - Status 0: Leeg (geen dienst)
 * - Status 1: Dienst (met service_id)
 * - Status 2: Geblokkeerd door vorige dienst
 * - Status 3: Niet Beschikbaar (NB)
 * 
 * NIEUW in DRAAD 90:
 * - Filtering op basis van dagdeel/datum/status='MAG' in roster_period_staffing_dagdelen
 * - Admin toggle om alle diensten te tonen (inclusief niet-toegestane)
 * - Visuele indicatie voor niet-toegestane diensten in admin modus
 * - rosterId wordt doorgegeven voor filtering query
 * 
 * NIEUW in DRAAD399:
 * - Team variant labels tonen (GRO, ORA, TOT → Groen, Oranje, Praktijk)
 * - Variant ID collectie bij save
 * - Ondersteuning voor meerdere service varianten per service/datum/dagdeel
 * 
 * DRAAD402 FIXES:
 * - FIX #1: Add selectedVariantId state (roster_period_staffing_dagdelen.id)
 * - FIX #2: Update handleServiceSelect signature (variantId FIRST param)
 * - FIX #3: Fix radio button logic (use variant ID for checked + onChange)
 * - FIX #4: Add variantId for status 0/2/3 in handleSave
 * - FIX #5: Hardcode cache-busting timestamp
 * 
 * HERSTEL:
 * - rosterId nu ook doorgegeven aan getServicesForEmployee() (admin toggle)
 * - Zorgt voor service blocking rules in beide modes
 * 
 * Features:
 * - Toont medewerker info, datum en dagdeel
 * - Lijst met diensten die medewerker kan uitvoeren (alfabetisch op code)
 * - Gefilterd op dagdeel/datum/status (tenzij admin toggle actief)
 * - Radio buttons voor dienst selectie (UNIEKE variant ID als key)
 * - Opties voor Leeg, Blokkade en NB
 * - Visuele markering van huidige status
 * - Read-only mode voor status='final'
 * 
 * Cache: 2026-01-04T11:30:00Z  // ⭐ FIX #5: Hardcoded timestamp
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Check, Lock, LockOpen, AlertCircle } from 'lucide-react';
import { 
  PrePlanningAssignment, 
  Dagdeel, 
  CellStatus, 
  ServiceTypeWithTimes 
} from '@/lib/types/preplanning';
import { 
  getServicesForEmployee, 
  getServicesForEmployeeFiltered 
} from '@/lib/services/preplanning-storage';

interface ModalCellData {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  dagdeel: Dagdeel; // 'O' | 'M' | 'A'
  rosterId: string; // ⭐ NIEUW - UUID van actieve roster
  currentAssignment?: PrePlanningAssignment; // Huidige assignment indien aanwezig
}

interface DienstSelectieModalProps {
  isOpen: boolean;
  cellData: ModalCellData | null;
  onClose: () => void;
  onSave: (serviceId: string | null, status: CellStatus, variantId?: string | null) => void; // DRAAD399: Added variantId
  readOnly?: boolean; // Voor status='final'
  isSaving?: boolean; // DRAAD 80: Prop van parent voor loading state
}

export default function DienstSelectieModal({
  isOpen,
  cellData,
  onClose,
  onSave,
  readOnly = false,
  isSaving = false // DRAAD 80: Gebruik prop van parent
}: DienstSelectieModalProps) {
  const [availableServices, setAvailableServices] = useState<ServiceTypeWithTimes[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);  // ⭐ FIX #1: NEW - roster_period_staffing_dagdelen.id
  const [selectedStatus, setSelectedStatus] = useState<CellStatus>(0); // 0, 1, 2, of 3
  const [isLoading, setIsLoading] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false); // ⭐ NIEUW - Admin toggle

  // Load services when modal opens or showAllServices changes
  useEffect(() => {
    if (isOpen && cellData) {
      loadServices();
    }
  }, [isOpen, cellData, showAllServices]); // ⭐ showAllServices toegevoegd

  async function loadServices() {
    if (!cellData) return;
    
    setIsLoading(true);
    try {
      let services: ServiceTypeWithTimes[];
      
      if (showAllServices) {
        // Admin modus: toon alle diensten (ongefilterd)
        // HERSTEL: Geef rosterId door voor service blocking check
        services = await getServicesForEmployee(cellData.employeeId, cellData.rosterId);
        console.log('[DienstSelectieModal] Admin mode: loaded', services.length, 'services');
      } else {
        // Normale modus: filter op dagdeel/datum/status
        services = await getServicesForEmployeeFiltered(
          cellData.employeeId,
          cellData.rosterId,
          cellData.date,
          cellData.dagdeel
        );
        console.log('[DienstSelectieModal] Filtered mode: loaded', services.length, 'services');
      }
      
      setAvailableServices(services);
      
      // Pre-select current status and service if exists
      if (cellData.currentAssignment) {
        const assignment = cellData.currentAssignment;
        setSelectedStatus(assignment.status);
        
        if (assignment.status === 1 && assignment.service_id) {
          setSelectedServiceId(assignment.service_id);
          // ⭐ FIX #1: Also pre-select variantId from current assignment
          const currentService = services.find(s => s.service_id === assignment.service_id);
          if (currentService) {
            setSelectedVariantId(currentService.id);
          }
        } else {
          setSelectedServiceId(null);
          setSelectedVariantId(null);  // ⭐ FIX #1: Reset variantId for non-status-1
        }
      } else {
        // Geen assignment: status 0 (leeg)
        setSelectedStatus(0);
        setSelectedServiceId(null);
        setSelectedVariantId(null);  // ⭐ FIX #1: Reset variantId
      }
    } catch (error) {
      console.error('[DienstSelectieModal] Error loading services:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Handler voor dienst selectie (status 1) - ⭐ FIX #2: Updated signature
  function handleServiceSelect(variantId: string, serviceId: string) {  // ⭐ variantId FIRST param
    setSelectedVariantId(variantId);  // ⭐ Set variant (roster_period_staffing_dagdelen.id)
    setSelectedServiceId(serviceId);   // Set service (service_types.id)
    setSelectedStatus(1); // Dienst = status 1
  }

  // Handler voor status selectie (0, 2, 3)
  function handleStatusSelect(status: CellStatus) {
    if (status === 0 || status === 2 || status === 3) {
      setSelectedStatus(status);
      setSelectedServiceId(null); // Deze statussen hebben geen service_id
      setSelectedVariantId(null);  // ⭐ FIX #1: Reset variantId voor non-status-1
    }
  }

  // Check of er wijzigingen zijn
  const hasChanges = useMemo(() => {
    if (!cellData?.currentAssignment) {
      // Geen assignment: wijziging als status !== 0 of als dienst geselecteerd
      return selectedStatus !== 0 || selectedServiceId !== null;
    }
    
    const current = cellData.currentAssignment;
    
    // Check status wijziging
    if (selectedStatus !== current.status) return true;
    
    // Bij status 1: check service_id wijziging
    if (selectedStatus === 1 && selectedServiceId !== current.service_id) return true;
    
    return false;
  }, [cellData, selectedStatus, selectedServiceId]);

  // DRAAD 399-FASE5 + FIX #4: Save handler - collect variant_id + add for all statuses
  function handleSave() {
    if (selectedStatus === 1) {
      // ✅ Status 1: User selected a service
      if (!selectedServiceId || !selectedVariantId) {  // ⭐ FIX #4: Check BOTH
        alert('Selecteer een dienst');
        return;
      }
      // Get variant_id from state (already set during selection)
      const variantId = selectedVariantId;  // ⭐ FIX #4: Use stored selectedVariantId
      onSave(selectedServiceId, 1, variantId);  // ✅ HAS variantId
    } else if (selectedStatus === 0) {
      // ✅ Status 0: Delete (Leeg)
      // Pass selectedVariantId so trigger can decrement invulling
      onSave(null, 0, selectedVariantId);  // ⭐ FIX #4: Add variantId for DB trigger
    } else if (selectedStatus === 2) {
      // ✅ Status 2: Blocked (Blokkade)
      onSave(null, 2, selectedVariantId);  // ⭐ FIX #4: Add variantId
    } else if (selectedStatus === 3) {
      // ✅ Status 3: NB (Niet Beschikbaar)
      onSave(null, 3, selectedVariantId);  // ⭐ FIX #4: Add variantId
    }
    // Parent component regelt isSaving state en modal sluiten
  }

  // DRAAD 80: Backdrop click - blokkeer tijdens save
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isSaving) return; // Blokkeer sluiten tijdens save
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  // Helper: format date naar Nederlands
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const dagen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 
                     'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    return `${dagen[date.getDay()]} ${date.getDate()} ${maanden[date.getMonth()]} ${date.getFullYear()}`;
  }

  // DRAAD 83C: Helper - dagdeel naar label ZONDER tijden (compacter)
  function getDagdeelLabel(dagdeel: Dagdeel): string {
    switch(dagdeel) {
      case 'O': return 'Ochtend';
      case 'M': return 'Middag';
      case 'A': return 'Avond';
    }
  }

  // DRAAD399-FASE4: Helper - team variant label
  function getTeamLabel(teamVariant?: string): string {
    if (!teamVariant) return '';
    switch(teamVariant) {
      case 'GRO': return 'Groen';
      case 'ORA': return 'Oranje';
      case 'TOT': return 'Praktijk';
      default: return teamVariant;
    }
  }

  // Helper: current service object
  const currentService = useMemo(() => {
    if (!cellData?.currentAssignment || cellData.currentAssignment.status !== 1) return null;
    return availableServices.find(s => s.id === cellData.currentAssignment?.service_id);
  }, [cellData, availableServices]);

  if (!isOpen || !cellData) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Dienst wijzigen</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Section - Horizontale layout voor datum/dagdeel */}
        <div className="px-5 py-3 bg-gray-50 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Medewerker:</span>
            <span className="text-sm text-gray-900">{cellData.employeeName}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Datum:</span>
              <span className="text-sm text-gray-900">{formatDate(cellData.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Dagdeel:</span>
              <span className="text-sm text-gray-900">{getDagdeelLabel(cellData.dagdeel)}</span>
            </div>
          </div>
        </div>

        {/* Huidige dienst */}
        <div className="px-5 py-2.5 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-600">Huidige dienst: </span>
          {cellData.currentAssignment && cellData.currentAssignment.status === 1 && currentService ? (
            <span className="text-sm font-bold text-gray-900">
              {currentService.code}
              {currentService.team_variant && (
                <span className="text-xs text-gray-600 ml-1">[{getTeamLabel(currentService.team_variant)}]</span>
              )}
              ({currentService.naam})
            </span>
          ) : cellData.currentAssignment && cellData.currentAssignment.status === 2 ? (
            <span className="text-sm font-bold text-gray-600">
              ▓ Geblokkeerd door vorige dienst
            </span>
          ) : cellData.currentAssignment && cellData.currentAssignment.status === 3 ? (
            <span className="text-sm font-bold text-yellow-700">
              NB (Niet beschikbaar)
            </span>
          ) : (
            <span className="text-sm text-gray-500 italic">Leeg</span>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="px-5 py-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Diensten laden...</span>
          </div>
        ) : (
          <>
            {/* DRAAD 90: Diensten lijst met Admin Toggle */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Kies nieuwe dienst:
                </p>
                
                {/* ⭐ NIEUW: Admin toggle - rechts uitgelijnd, compact */}
                <button
                  onClick={() => setShowAllServices(!showAllServices)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={showAllServices ? "Verberg niet-toegestane diensten" : "Toon alle diensten (admin)"}
                >
                  {showAllServices ? (
                    <>
                      <LockOpen className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">toon alle diensten</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">toon alle diensten</span>
                    </>
                  )}
                </button>
              </div>
              
              {availableServices.length > 0 ? (
                <div className="space-y-1.5">
                  {[...availableServices]
                    .sort((a, b) => {
                      // Sort by code first, then by team variant
                      const codeCompare = a.code.localeCompare(b.code, 'nl');
                      if (codeCompare !== 0) return codeCompare;
                      // If code is the same, sort by team variant
                      return (a.team_variant || '').localeCompare(b.team_variant || '', 'nl');
                    })
                    .map(service => (
                    <label
                      key={service.id}  // ⭐ FIX #3: Key is roster_period_staffing_dagdelen.id (UNIEKE)
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="dienst"
                        value={service.id}
                        checked={selectedVariantId === service.id && selectedStatus === 1}  // ⭐ FIX #3: Check VARIANT_ID not service_id
                        onChange={() => handleServiceSelect(service.id, service.service_id)}  // ⭐ FIX #3: Pass both IDs
                        className="w-4 h-4 text-blue-600"
                        disabled={readOnly || isSaving}
                      />
                      <div className="flex-1 flex items-center gap-2">
                        <span className="font-medium text-gray-900">{service.code}</span>
                        {/* DRAAD399-FASE4: Toon team variant label */}
                        {service.team_variant && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                            [{getTeamLabel(service.team_variant)}]
                          </span>
                        )}
                        <span className="text-sm text-gray-600">({service.naam})</span>
                        {selectedVariantId === service.id && selectedStatus === 1 && (  // ⭐ FIX #3: Check variant
                          <Check className="w-4 h-4 text-blue-600 ml-auto" />
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  {showAllServices 
                    ? "Geen diensten beschikbaar voor deze medewerker" 
                    : "Geen diensten beschikbaar voor dit dagdeel"}
                </p>
              )}
            </div>

            {/* Speciale Opties */}
            <div className="px-5 py-3 border-t border-gray-200">
              <div className="space-y-1.5">
                {/* Status 0: Leeg */}
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="dienst"
                    value="empty"
                    checked={selectedStatus === 0}
                    onChange={() => handleStatusSelect(0)}
                    className="w-4 h-4 text-blue-600"
                    disabled={readOnly || isSaving}
                  />
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm text-gray-900">Leeg (verwijder dienst)</span>
                    {selectedStatus === 0 && (
                      <Check className="w-4 h-4 text-blue-600 ml-auto" />
                    )}
                  </div>
                </label>
                
                {/* Status 2: Geblokkeerd */}
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-300 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="dienst"
                    value="blocked"
                    checked={selectedStatus === 2}
                    onChange={() => handleStatusSelect(2)}
                    className="w-4 h-4 text-gray-600"
                    disabled={readOnly || isSaving}
                  />
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm text-gray-900 font-medium">
                      ▓ Blokkade door vorige dienst
                    </span>
                    {selectedStatus === 2 && (
                      <Check className="w-4 h-4 text-gray-600 ml-auto" />
                    )}
                  </div>
                </label>
                
                {/* Status 3: NB */}
                <label className="flex items-center gap-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="dienst"
                    value="nb"
                    checked={selectedStatus === 3}
                    onChange={() => handleStatusSelect(3)}
                    className="w-4 h-4 text-yellow-600"
                    disabled={readOnly || isSaving}
                  />
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm text-gray-900 font-medium">NB (Niet beschikbaar)</span>
                    {selectedStatus === 3 && (
                      <Check className="w-4 h-4 text-yellow-600 ml-auto" />
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuleren
              </button>
              {!readOnly && (
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Opslaan...' : 'Opslaan'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}