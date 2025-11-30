/**
 * DRAAD 83C: Dienst Selectie Modal Component - Compacte Versie
 * 
 * Modal pop-up voor toewijzen/wijzigen van diensten aan cellen
 * Ondersteunt alle 4 statussen:
 * - Status 0: Leeg (geen dienst)
 * - Status 1: Dienst (met service_id)
 * - Status 2: Geblokkeerd door vorige dienst
 * - Status 3: Niet Beschikbaar (NB)
 * 
 * Features:
 * - Toont medewerker info, datum en dagdeel
 * - Lijst met diensten die medewerker kan uitvoeren
 * - Radio buttons voor dienst selectie
 * - Opties voor Leeg, Blokkade en NB
 * - Visuele markering van huidige status
 * - Read-only mode voor status='final'
 * 
 * DRAAD 83C Optimalisaties:
 * - Compactere layout voor 100% zoom zichtbaarheid
 * - Horizontale datum/dagdeel layout
 * - Tijdsaanduidingen verwijderd
 * - Gereduceerde padding en spacing
 * 
 * Cache: 1733054719002
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import { 
  PrePlanningAssignment, 
  Dagdeel, 
  CellStatus, 
  ServiceTypeWithTimes 
} from '@/lib/types/preplanning';
import { getServicesForEmployee } from '@/lib/services/preplanning-storage';

interface ModalCellData {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  dagdeel: Dagdeel; // 'O' | 'M' | 'A'
  currentAssignment?: PrePlanningAssignment; // Huidige assignment indien aanwezig
}

interface DienstSelectieModalProps {
  isOpen: boolean;
  cellData: ModalCellData | null;
  onClose: () => void;
  onSave: (serviceId: string | null, status: CellStatus) => void;
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
  const [selectedStatus, setSelectedStatus] = useState<CellStatus>(0); // 0, 1, 2, of 3
  const [isLoading, setIsLoading] = useState(false);

  // Load services when modal opens
  useEffect(() => {
    if (isOpen && cellData) {
      loadServices();
    }
  }, [isOpen, cellData]);

  async function loadServices() {
    if (!cellData) return;
    
    setIsLoading(true);
    try {
      const services = await getServicesForEmployee(cellData.employeeId);
      setAvailableServices(services);
      
      // Pre-select current status and service if exists
      if (cellData.currentAssignment) {
        const assignment = cellData.currentAssignment;
        setSelectedStatus(assignment.status);
        
        if (assignment.status === 1 && assignment.service_id) {
          setSelectedServiceId(assignment.service_id);
        } else {
          setSelectedServiceId(null);
        }
      } else {
        // Geen assignment: status 0 (leeg)
        setSelectedStatus(0);
        setSelectedServiceId(null);
      }
    } catch (error) {
      console.error('[DienstSelectieModal] Error loading services:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Handler voor dienst selectie (status 1)
  function handleServiceSelect(serviceId: string) {
    setSelectedServiceId(serviceId);
    setSelectedStatus(1); // Dienst = status 1
  }

  // Handler voor status selectie (0, 2, 3)
  function handleStatusSelect(status: CellStatus) {
    if (status === 0 || status === 2 || status === 3) {
      setSelectedStatus(status);
      setSelectedServiceId(null); // Deze statussen hebben geen service_id
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

  // DRAAD 80: Save handler - geen interne isSaving state meer
  function handleSave() {
    if (selectedStatus === 1) {
      if (!selectedServiceId) {
        alert('Selecteer een dienst');
        return;
      }
      onSave(selectedServiceId, 1);
    } else if (selectedStatus === 0) {
      onSave(null, 0);
    } else if (selectedStatus === 2) {
      onSave(null, 2);
    } else if (selectedStatus === 3) {
      onSave(null, 3);
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
        {/* DRAAD 83C: Header compacter - px-5 py-3 + text-lg */}
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

        {/* DRAAD 83C: Info Section - Horizontale layout voor datum/dagdeel */}
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

        {/* DRAAD 83C: "Huidige dienst" ipv "Huidige status" + px-5 py-2.5 */}
        <div className="px-5 py-2.5 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-600">Huidige dienst: </span>
          {cellData.currentAssignment && cellData.currentAssignment.status === 1 && currentService ? (
            <span className="text-sm font-bold text-gray-900">
              {currentService.code} ({currentService.naam})
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

        {/* DRAAD 83C: Loading State - px-5 py-6 */}
        {isLoading ? (
          <div className="px-5 py-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Diensten laden...</span>
          </div>
        ) : (
          <>
            {/* DRAAD 83C: Diensten lijst - px-5 py-3 + space-y-1.5 + px-3 py-2 per item */}
            <div className="px-5 py-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Kies nieuwe dienst:</p>
              {availableServices.length > 0 ? (
                <div className="space-y-1.5">
                  {availableServices.map(service => (
                    <label
                      key={service.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="dienst"
                        value={service.id}
                        checked={selectedServiceId === service.id && selectedStatus === 1}
                        onChange={() => handleServiceSelect(service.id)}
                        className="w-4 h-4 text-blue-600"
                        disabled={readOnly || isSaving}
                      />
                      {/* DRAAD 83C: Tijden verwijderd, alles op 1 regel */}
                      <div className="flex-1 flex items-center gap-2">
                        <span className="font-medium text-gray-900">{service.code}</span>
                        <span className="text-sm text-gray-600">({service.naam})</span>
                        {selectedServiceId === service.id && selectedStatus === 1 && (
                          <Check className="w-4 h-4 text-blue-600 ml-auto" />
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Geen diensten beschikbaar voor deze medewerker</p>
              )}
            </div>

            {/* DRAAD 83C: Speciale Opties - px-5 py-3 + space-y-1.5 */}
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

            {/* DRAAD 83C: Footer - px-5 py-3 */}
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