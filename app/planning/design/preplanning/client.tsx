'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Home } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import toast from 'react-hot-toast';
import { 
  getPrePlanningData,
  savePrePlanningAssignment,
  getEmployeesWithServices,
  updateAssignmentStatus
} from '@/lib/services/preplanning-storage';
import { EmployeeWithServices, PrePlanningAssignment, Dagdeel, CellStatus } from '@/lib/types/preplanning';
import { getDatesForRosterPeriod, groupDatesByWeek } from '@/lib/utils/roster-date-helpers';
import { loadRosterDesignData } from '@/lib/planning/rosterDesign';
import { getRosterById } from '@/lib/services/roosters-supabase';
import StatusBadge from '@/app/planning/_components/StatusBadge';
import PlanningGridDagdelen from './components/PlanningGridDagdelen';
import DienstSelectieModal from './components/DienstSelectieModal';

/**
 * Client Component voor PrePlanning scherm (Ontwerpfase)
 * 
 * DRAAD 78: Nieuwe grid met dagdelen (O/M/A kolommen)
 * - Gebruikt PlanningGridDagdelen component
 * - Haalt service kleuren op uit database
 * 
 * DRAAD 79: DienstSelectieModal integratie
 * - Modal opent bij cel klik
 * - Ondersteunt 4 statussen: 0=leeg, 1=dienst, 2=geblokkeerd, 3=NB
 * 
 * DRAAD 80: Database save + grid refresh
 * - handleModalSave koppelt aan database via updateAssignmentStatus/deletePrePlanningAssignment
 * - Grid refresht automatisch na save
 * - isSaving prop voor loading feedback in modal
 * 
 * DRAAD 82A: Fix datumbereik - +34 dagen ipv +33
 * - getDatesForRosterPeriod genereert 35 dagen (index 0-34)
 * - Database query moet alle 35 dagen ophalen
 * - Start (ma 25-11) + 34 dagen = di 30-12 ✅ (35 dagen totaal)
 * 
 * DRAAD 83: Scherm naam wijziging
 * - headerPrefix voor draft: "ROOSTER:" ipv "Pre-planning:"
 * - Status badge toont de fase (In ontwerp)
 * - Blijvende scherm naam ongeacht fase
 * 
 * DRAAD 89: Service blocking rules integratie
 * - Toast warnings voor buiten-periode blokkeringen
 * - Geeft rosterStartDate door aan updateAssignmentStatus
 * - Gebruikt nieuwe return signature { success, warnings }
 * 
 * DRAAD 90: Dienst filtering op dagdeel/datum/status
 * - rosterId wordt doorgegeven aan DienstSelectieModal via selectedCell
 * - Modal gebruikt rosterId voor gefilterde diensten query
 * 
 * DRAAD 122C: Status-aware back button navigation
 * - draft → /planning/design/dashboard (design phase)
 * - in_progress → /dashboard (HDB - main dashboard)
 * - final → /dashboard (HDB - main dashboard)
 * 
 * DRAAD 351: Laadscherm tekst gewijzigd naar "Rooster laden..."
 * - Client component loading state aangepast voor consistentie
 * 
 * DRAAD352-FASE1: ✅ deletePrePlanningAssignment verwijderd
 * - Alle status=0 updates gaan nu via updateAssignmentStatus
 * - Database records worden NOOIT verwijderd (soft delete via status=0)
 * 
 * DRAAD399-FASE5: ✅ variantId parameter doorvoeren naar updateAssignmentStatus
 * - Modal geeft variantId mee bij onSave
 * - handleModalSave ontvangt en passert variantId door
 * 
 * DRAAD402: ✅ Cache-busting + radio button fixes
 * - variantId (roster_period_staffing_dagdelen.id) wordt correct doorgegeven
 * - Radio buttons gebruiken UNIEKE variant ID als selection key
 * - Hardcoded cache timestamp voor browser cache invalidation
 * 
 * DRAAD402-OPERATIVE: KRITIEKE FIX applied
 * - DienstSelectieModal: onChange parameter fix (service.id → service.service_id)
 * - Cache timestamp synchronized
 * 
 * Dit scherm toont:
 * - Grid met 35 dagen (5 weken) als kolommen x 3 dagdelen (O/M/A)
 * - Medewerkers als rijen
 * - Cellen op basis van status (0=leeg, 1=dienst, 2=geblokkeerd, 3=NB)
 * - Data wordt opgeslagen in Supabase roster_assignments
 * 
 * Cache: 2026-01-04T11:56:00Z  // ⭐ OPERATIVE: Synchronized timestamp
 */
export default function PrePlanningClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rosterId = searchParams.get('id');
  const supabase = createClientComponentClient();

  const [employees, setEmployees] = useState<EmployeeWithServices[]>([]);
  const [assignments, setAssignments] = useState<PrePlanningAssignment[]>([]);
  const [serviceColors, setServiceColors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [rosterStatus, setRosterStatus] = useState<'draft' | 'in_progress' | 'final'>('draft');

  // DRAAD 79 + 90: Modal state - nu met rosterId
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    employeeId: string;
    employeeName: string;
    date: string;
    dagdeel: Dagdeel;
    rosterId: string; // ⭐ NIEUW - DRAAD 90
    currentAssignment?: PrePlanningAssignment;
  } | null>(null);

  // Load data
  useEffect(() => {
    if (!rosterId) {
      alert('Geen rooster ID gevonden');
      router.push('/planning/design');
      return;
    }

    async function loadData() {
      try {
        setIsLoading(true);
        
        // Haal roster op voor status en periode info
        const roster = await getRosterById(rosterId!);
        if (!roster) {
          alert('Rooster niet gevonden');
          router.push('/planning/design');
          return;
        }

        // Sla rooster status op
        setRosterStatus(roster.status);

        // Gebruik start_date uit roster
        const start = roster.start_date;
        if (!start) {
          alert('Geen startdatum gevonden voor rooster');
          return;
        }

        // DRAAD 82A: Fix datumbereik - +34 dagen ipv +33
        // getDatesForRosterPeriod genereert 35 dagen (index 0-34)
        // Database query moet alle 35 dagen ophalen
        // Start (ma 25-11) + 34 dagen = di 30-12 ✅ (35 dagen totaal)
        const startDateObj = new Date(start);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + 34);
        const end = endDateObj.toISOString().split('T')[0];

        setStartDate(start);
        setEndDate(end);

        // Haal medewerkers met hun diensten op
        const employeesData = await getEmployeesWithServices();
        setEmployees(employeesData);

        // Haal bestaande assignments op
        const assignmentsData = await getPrePlanningData(rosterId!, start, end);
        setAssignments(assignmentsData);

      } catch (error) {
        console.error('[PrePlanning] Error loading data:', error);
        alert('Fout bij laden van preplanning data');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [rosterId, router, supabase]);

  // DRAAD 78: Haal service kleuren op
  useEffect(() => {
    async function loadServiceColors() {
      try {
        const { data, error } = await supabase
          .from('service_types')
          .select('id, kleur')
          .eq('actief', true);
        
        if (error) {
          console.error('[PrePlanning] Error loading service colors:', error);
          return;
        }

        if (data) {
          const colorMap: Record<string, string> = {};
          data.forEach(service => {
            colorMap[service.id] = service.kleur || '#3B82F6'; // Fallback blauw
          });
          setServiceColors(colorMap);
        }
      } catch (error) {
        console.error('[PrePlanning] Error loading service colors:', error);
      }
    }

    loadServiceColors();
  }, [supabase]);

  // Genereer datum-info voor headers
  const dateInfo = useMemo(() => {
    if (!startDate) return [];
    const dates = getDatesForRosterPeriod(startDate, []);
    // Voeg dayLabel toe voor de grid headers
    return dates.map(d => ({
      ...d,
      dayLabel: `${d.dayName} ${d.date.split('-')[2]}-${d.date.split('-')[1]}`
    }));
  }, [startDate]);

  const weekGroups = useMemo(() => {
    return groupDatesByWeek(dateInfo);
  }, [dateInfo]);

  // DRAAD 79 + 90: Open modal bij cel klik - nu met rosterId
  const handleCellClick = useCallback((employeeId: string, date: string, dagdeel: Dagdeel) => {
    // Vind medewerker voor naam
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    // Vind huidige assignment indien aanwezig
    const currentAssignment = assignments.find(
      a => a.employee_id === employeeId && a.date === date && a.dagdeel === dagdeel
    );
    
    // DRAAD 90: rosterId toevoegen aan cel data
    if (!rosterId) {
      console.error('[PrePlanning] No rosterId available for modal');
      return;
    }
    
    // Open modal met cel data inclusief rosterId
    setSelectedCell({
      employeeId,
      employeeName: `${employee.voornaam} ${employee.achternaam}`,
      date,
      dagdeel,
      rosterId, // ⭐ NIEUW - DRAAD 90
      currentAssignment
    });
    setModalOpen(true);
  }, [employees, assignments, rosterId]); // ⭐ rosterId toegevoegd aan dependencies

  // DRAAD 80 + 89 + DRAAD352 + DRAAD399 + DRAAD402: Modal save handler - alle statussen via updateAssignmentStatus
  const handleModalSave = useCallback(async (serviceId: string | null, status: CellStatus, variantId?: string | null) => {
    if (!selectedCell || !rosterId) return;
    
    try {
      setIsSaving(true);

      console.log(`[PrePlanning] Updating assignment (status ${status})...`);
      
      // ✅ DRAAD352-FASE1: ALLE statussen gaan via updateAssignmentStatus
      // Status 0 (leeg): service_id=null, status=0 → UPSERT (soft delete)
      // Status 1 (dienst): service_id=UUID, status=1 → UPSERT
      // Status 2 (geblokkeerd): service_id=null, status=2 → UPSERT
      // Status 3 (NB): service_id=null, status=3 → UPSERT
      // DRAAD399: Voeg variantId toe
      // DRAAD402: variantId wordt correct doorgegeven voor alle statussen
      const result = await updateAssignmentStatus(
        rosterId,
        selectedCell.employeeId,
        selectedCell.date,
        selectedCell.dagdeel,
        status,
        serviceId,
        startDate, // DRAAD 89: Roster start date voor periode check
        variantId  // DRAAD399+402: Doorvoeren variant ID (roster_period_staffing_dagdelen.id)
      );

      const success = result.success;
      const warnings = result.warnings || [];

      if (!success) {
        throw new Error('Database operatie mislukt');
      }

      console.log('[PrePlanning] Save successful, reloading grid data...');

      // Herlaad assignments data voor grid refresh
      if (startDate && endDate) {
        const updatedAssignments = await getPrePlanningData(rosterId, startDate, endDate);
        setAssignments(updatedAssignments);
        console.log(`[PrePlanning] Grid refreshed: ${updatedAssignments.length} assignments`);
      }

      // Sluit modal na succesvolle save
      setModalOpen(false);
      setSelectedCell(null);

      // DRAAD 89: Toon toast warnings voor buiten-periode blokkeringen
      if (warnings.length > 0) {
        warnings.forEach(warning => {
          toast.error(warning, {
            duration: 5000,
            icon: '⚠️',
            style: {
              background: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #F59E0B'
            }
          });
        });
      }
    } catch (error) {
      console.error('[PrePlanning] Error saving assignment:', error);
      toast.error('Fout bij opslaan dienst. Probeer opnieuw.', {
        duration: 4000,
        icon: '❌'
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedCell, rosterId, startDate, endDate]);

  // DRAAD 122C: Status-aware back button navigation
  const handleBackToDashboard = useCallback(() => {
    if (rosterStatus === 'draft') {
      // Draft → stay in design flow
      router.push(`/planning/design/dashboard?rosterId=${rosterId}`);
    } else if (rosterStatus === 'in_progress' || rosterStatus === 'final') {
      // In bewerking / Afgesloten → go to main dashboard (HDB)
      router.push('/dashboard');
    } else {
      // Default fallback
      router.push('/dashboard');
    }
  }, [rosterStatus, rosterId, router]);

  // DRAAD 83: Status-afhankelijke content - headerPrefix aangepast
  const headerPrefix = useMemo(() => {
    switch(rosterStatus) {
      case 'draft':
        return 'ROOSTER:';
      case 'in_progress':
        return 'Planrooster:';
      case 'final':
        return 'Planrooster (Afgesloten):';
    }
  }, [rosterStatus]);

  const infoBannerText = useMemo(() => {
    switch(rosterStatus) {
      case 'draft':
        return 'Pre-planning: Wijs specifieke diensten toe aan medewerkers voor deze periode. Alleen diensten die een medewerker kan uitvoeren zijn beschikbaar in een pop-up na klikken de cel in het rooster (medewerker/datum/dagdeel)';
      case 'in_progress':
        return 'Planrooster: Bewerk het rooster door op cellen te klikken. Wijzigingen worden automatisch opgeslagen.';
      case 'final':
        return 'Planrooster (Afgesloten): Dit rooster is afgesloten en kan alleen worden geraadpleegd. Exporteer naar PDF indien nodig.';
    }
  }, [rosterStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Rooster laden...</p>
        </div>
      </div>
    );
  }

  const title = weekGroups.length > 0 
    ? `${headerPrefix} Periode Week ${weekGroups[0].weekNumber} - Week ${weekGroups[weekGroups.length - 1].weekNumber} ${weekGroups[0].year}`
    : `${headerPrefix} Periode`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-xl shadow-lg">
          {/* Header met Status Badge en Terug naar Dashboard button */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
                  <span className="text-2xl mr-3">📅</span>
                  {title}
                </h1>
                <StatusBadge status={rosterStatus} />
              </div>
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 px-8 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md hover:shadow-lg font-semibold text-lg"
              >
                <Home className="w-5 h-5" />
                Terug naar Dashboard
              </button>
            </div>
            {isSaving && (
              <div className="flex justify-center mt-4">
                <span className="text-sm text-blue-600 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  Wijziging opslaan...
                </span>
              </div>
            )}
          </div>

          {/* Info tekst - status afhankelijk */}
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
            <p className="text-blue-800 text-sm">
              <strong>{infoBannerText}</strong>
            </p>
          </div>

          {/* DRAAD 78: Nieuwe Grid met Dagdelen */}
          <div className="p-6">
            <PlanningGridDagdelen
              employees={employees}
              dateInfo={dateInfo}
              assignments={assignments}
              serviceColors={serviceColors}
              onCellClick={handleCellClick}
              readOnly={rosterStatus === 'final'}
            />
          </div>

          {/* Footer status */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span className="font-medium">{employees.length}</span> medewerkers
                <span className="mx-2">·</span>
                <span className="font-medium">{dateInfo.length}</span> dagen
                <span className="mx-2">·</span>
                <span className="font-medium">{assignments.length}</span> diensten toegewezen
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DRAAD 80 + 90 + 402: Dienst Selectie Modal met isSaving prop + rosterId in cellData + variantId handling */}
      <DienstSelectieModal
        isOpen={modalOpen}
        cellData={selectedCell}
        onClose={() => {
          setModalOpen(false);
          setSelectedCell(null);
        }}
        onSave={handleModalSave}
        readOnly={rosterStatus === 'final'}
        isSaving={isSaving}
      />
    </div>
  );
}