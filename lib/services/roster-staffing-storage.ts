// lib/services/roster-staffing-storage.ts

import { 
  RosterStaffingRule, 
  RosterStaffingRuleInput, 
  RosterStaffingStatus,
  RosterStaffingRuleWithService,
  DateStaffingOverview,
  validateRosterStaffingRule,
  getDayName,
  getDayShort
} from '@/lib/types/roster-staffing';
import { getAllServices } from './diensten-storage';
import { getAllDayTypeStaffing, getStaffingRule } from './daytype-staffing-storage';
import { isDutchHoliday } from '@/lib/planning/holidays';

const ROSTER_STAFFING_KEY = 'rooster_specific_staffing';
const ROSTER_STAFFING_STATUS_KEY = 'rooster_staffing_status';

/**
 * Generate unique ID for new rules
 */
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

/**
 * Safe localStorage operations
 */
function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key}:`, error);
    throw new Error('Kon data niet opslaan');
  }
}

/**
 * Get all roster staffing rules
 */
export function getAllRosterStaffingRules(): RosterStaffingRule[] {
  return safeRead<RosterStaffingRule[]>(ROSTER_STAFFING_KEY, []);
}

/**
 * Save all roster staffing rules
 */
export function saveAllRosterStaffingRules(rules: RosterStaffingRule[]): void {
  safeWrite(ROSTER_STAFFING_KEY, rules);
}

/**
 * Get staffing rules for specific roster
 */
export function getRosterStaffingRules(rosterId: string): RosterStaffingRule[] {
  const allRules = getAllRosterStaffingRules();
  return allRules.filter(rule => rule.rosterId === rosterId);
}

/**
 * Get specific staffing rule for roster, date, and service
 */
export function getRosterStaffingRule(rosterId: string, date: string, dienstId: string): RosterStaffingRule | null {
  const rules = getRosterStaffingRules(rosterId);
  return rules.find(rule => rule.date === date && rule.dienstId === dienstId) || null;
}

/**
 * Create or update a roster staffing rule
 */
export function upsertRosterStaffingRule(input: RosterStaffingRuleInput): RosterStaffingRule {
  // Validate input
  const validation = validateRosterStaffingRule(input);
  if (!validation.isValid) {
    throw new Error(`Validatie gefaald: ${validation.errors.join(', ')}`);
  }

  const allRules = getAllRosterStaffingRules();
  const existingIndex = allRules.findIndex(rule => 
    rule.rosterId === input.rosterId && 
    rule.date === input.date && 
    rule.dienstId === input.dienstId
  );

  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // Update existing rule
    const updatedRule: RosterStaffingRule = {
      ...allRules[existingIndex],
      minBezetting: input.minBezetting,
      maxBezetting: input.maxBezetting,
      updated_at: now
    };
    allRules[existingIndex] = updatedRule;
    saveAllRosterStaffingRules(allRules);
    return updatedRule;
  } else {
    // Create new rule
    const newRule: RosterStaffingRule = {
      id: generateId(),
      rosterId: input.rosterId,
      date: input.date,
      dienstId: input.dienstId,
      minBezetting: input.minBezetting,
      maxBezetting: input.maxBezetting,
      locked: false,
      created_at: now,
      updated_at: now
    };
    allRules.push(newRule);
    saveAllRosterStaffingRules(allRules);
    return newRule;
  }
}

/**
 * Delete a specific roster staffing rule
 */
export function deleteRosterStaffingRule(id: string): void {
  const allRules = getAllRosterStaffingRules();
  const filteredRules = allRules.filter(rule => rule.id !== id);
  saveAllRosterStaffingRules(filteredRules);
}

/**
 * Delete all staffing rules for a roster
 */
export function deleteAllRosterStaffingRules(rosterId: string): void {
  const allRules = getAllRosterStaffingRules();
  const filteredRules = allRules.filter(rule => rule.rosterId !== rosterId);
  saveAllRosterStaffingRules(filteredRules);
  
  // Also remove status
  deleteRosterStaffingStatus(rosterId);
}

/**
 * Initialize roster staffing from DayType rules
 */
export function initializeRosterStaffing(rosterId: string, startDate: string, days: string[]): void {
  // Check if already initialized
  const existingRules = getRosterStaffingRules(rosterId);
  if (existingRules.length > 0) {
    console.warn(`Roster ${rosterId} already has staffing rules`);
    return;
  }

  const services = getAllServices();
  const dayTypeRules = getAllDayTypeStaffing();
  const newRules: RosterStaffingRule[] = [];
  const now = new Date().toISOString();

  // Generate rules for each day and each service
  days.forEach(date => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0 system

    services.forEach(service => {
      // Find corresponding daytype rule
      const dayTypeRule = dayTypeRules.find(rule => 
        rule.dienstId === service.id && rule.dagSoort === dayIndex
      );

      const minBezetting = dayTypeRule?.minBezetting ?? 0;
      const maxBezetting = dayTypeRule?.maxBezetting ?? 2;

      const newRule: RosterStaffingRule = {
        id: generateId(),
        rosterId,
        date,
        dienstId: service.id,
        minBezetting,
        maxBezetting,
        locked: false,
        created_at: now,
        updated_at: now
      };

      newRules.push(newRule);
    });
  });

  // Save all new rules
  const allRules = getAllRosterStaffingRules();
  allRules.push(...newRules);
  saveAllRosterStaffingRules(allRules);

  console.log(`Initialized ${newRules.length} staffing rules for roster ${rosterId}`);
}

/**
 * Get roster staffing status
 */
export function getAllRosterStaffingStatuses(): RosterStaffingStatus[] {
  return safeRead<RosterStaffingStatus[]>(ROSTER_STAFFING_STATUS_KEY, []);
}

/**
 * Save all roster staffing statuses
 */
export function saveAllRosterStaffingStatuses(statuses: RosterStaffingStatus[]): void {
  safeWrite(ROSTER_STAFFING_STATUS_KEY, statuses);
}

/**
 * Get roster staffing status
 */
export function getRosterStaffingStatus(rosterId: string): RosterStaffingStatus | null {
  const statuses = getAllRosterStaffingStatuses();
  return statuses.find(status => status.rosterId === rosterId) || null;
}

/**
 * Check if roster staffing is locked
 */
export function isRosterStaffingLocked(rosterId: string): boolean {
  const status = getRosterStaffingStatus(rosterId);
  return status?.isLocked ?? false;
}

/**
 * Lock roster staffing (vastleggen)
 */
export function lockRosterStaffing(rosterId: string): void {
  if (isRosterStaffingLocked(rosterId)) {
    throw new Error('Bezetting is al vastgesteld');
  }

  const statuses = getAllRosterStaffingStatuses();
  const existingIndex = statuses.findIndex(status => status.rosterId === rosterId);
  const now = new Date().toISOString();

  const newStatus: RosterStaffingStatus = {
    rosterId,
    isLocked: true,
    lockedAt: now,
    lockedBy: 'current-user' // TODO: Replace with actual user when auth is implemented
  };

  if (existingIndex >= 0) {
    statuses[existingIndex] = newStatus;
  } else {
    statuses.push(newStatus);
  }

  saveAllRosterStaffingStatuses(statuses);

  // Also lock all individual rules
  const rules = getRosterStaffingRules(rosterId);
  const updatedRules = rules.map(rule => ({ ...rule, locked: true, updated_at: now }));
  
  const allRules = getAllRosterStaffingRules();
  updatedRules.forEach(updatedRule => {
    const index = allRules.findIndex(rule => rule.id === updatedRule.id);
    if (index >= 0) {
      allRules[index] = updatedRule;
    }
  });
  
  saveAllRosterStaffingRules(allRules);
}

/**
 * Unlock roster staffing (for admin/testing purposes)
 */
export function unlockRosterStaffing(rosterId: string): void {
  const statuses = getAllRosterStaffingStatuses();
  const filteredStatuses = statuses.filter(status => status.rosterId !== rosterId);
  saveAllRosterStaffingStatuses(filteredStatuses);

  // Also unlock all individual rules
  const rules = getRosterStaffingRules(rosterId);
  const updatedRules = rules.map(rule => ({ ...rule, locked: false, updated_at: new Date().toISOString() }));
  
  const allRules = getAllRosterStaffingRules();
  updatedRules.forEach(updatedRule => {
    const index = allRules.findIndex(rule => rule.id === updatedRule.id);
    if (index >= 0) {
      allRules[index] = updatedRule;
    }
  });
  
  saveAllRosterStaffingRules(allRules);
}

/**
 * Delete roster staffing status
 */
export function deleteRosterStaffingStatus(rosterId: string): void {
  const statuses = getAllRosterStaffingStatuses();
  const filteredStatuses = statuses.filter(status => status.rosterId !== rosterId);
  saveAllRosterStaffingStatuses(filteredStatuses);
}

/**
 * Get roster staffing rules with service information
 */
export function getRosterStaffingRulesWithServices(rosterId: string): RosterStaffingRuleWithService[] {
  const rules = getRosterStaffingRules(rosterId);
  const services = getAllServices();

  return rules.map(rule => {
    const service = services.find(s => s.id === rule.dienstId);
    return {
      rule,
      dienstCode: service?.code ?? 'UNKNOWN',
      dienstNaam: service?.naam ?? 'Onbekende dienst',
      dienstKleur: service?.kleur ?? '#E5E7EB'
    };
  });
}

/**
 * Get date staffing overview for roster
 */
export function getDateStaffingOverview(rosterId: string, dates: string[]): DateStaffingOverview[] {
  const rulesWithServices = getRosterStaffingRulesWithServices(rosterId);

  return dates.map(date => {
    const dateRules = rulesWithServices.filter(rws => rws.rule.date === date);
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    
    return {
      date,
      dayOfWeek: getDayName(date),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isHoliday: isDutchHoliday(date),
      rules: dateRules
    };
  });
}

/**
 * Export roster staffing rules
 */
export function exportRosterStaffingRules(rosterId?: string): string {
  const rules = rosterId ? getRosterStaffingRules(rosterId) : getAllRosterStaffingRules();
  const statuses = rosterId 
    ? getAllRosterStaffingStatuses().filter(s => s.rosterId === rosterId)
    : getAllRosterStaffingStatuses();

  return JSON.stringify({
    rosterStaffingRules: rules,
    rosterStaffingStatuses: statuses,
    exportDate: new Date().toISOString(),
    version: '1.0'
  }, null, 2);
}

/**
 * Import roster staffing rules
 */
export function importRosterStaffingRules(jsonData: string): void {
  try {
    const data = JSON.parse(jsonData);
    
    if (!data.rosterStaffingRules || !Array.isArray(data.rosterStaffingRules)) {
      throw new Error('Ongeldige data structuur');
    }

    // Validate each rule
    data.rosterStaffingRules.forEach((rule: any, index: number) => {
      if (!rule.id || !rule.rosterId || !rule.date || !rule.dienstId ||
          typeof rule.minBezetting !== 'number' || typeof rule.maxBezetting !== 'number') {
        throw new Error(`Ongeldige regel op index ${index}`);
      }
    });

    // Save rules
    saveAllRosterStaffingRules(data.rosterStaffingRules);
    
    // Save statuses if present
    if (data.rosterStaffingStatuses && Array.isArray(data.rosterStaffingStatuses)) {
      saveAllRosterStaffingStatuses(data.rosterStaffingStatuses);
    }

  } catch (error) {
    console.error('Error importing roster staffing rules:', error);
    throw new Error('Kon bezettingsregels niet importeren: ' + (error as Error).message);
  }
}