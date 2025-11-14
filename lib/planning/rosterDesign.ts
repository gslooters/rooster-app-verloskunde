import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType } from '@/lib/types/employee';
import { getRosterDesignByRosterId, createRosterDesign, updateRosterDesign, bulkUpdateUnavailability } from '@/lib/services/roster-design-supabase';
import { getWeekdayCode } from '@/lib/utils/date-helpers';
import { 
  isEmployeeUnavailableOnDate,
  deleteAssignmentByDate
} from '@/lib/services/roster-assignments-supabase';
// Verwijderd: upsertNBAssignment + toggleNBAssignment + toggleUnavailability (API is nu readonly)

// ...De rest van de helpers en functies blijven ongewijzigd...

// ✅ EXPLICIETE EXPORT STATEMENTS
export {
  initializeRosterDesign,
  autofillUnavailability,
  updateEmployeeMaxShifts,
  loadRosterDesignData,
  saveRosterDesignData,
  syncRosterDesignWithEmployeeData,
  isEmployeeUnavailable,
  updateRosterDesignStatus,
  validateDesignComplete,
  exportRosterDesignData,
  createEmployeeSnapshot
};
