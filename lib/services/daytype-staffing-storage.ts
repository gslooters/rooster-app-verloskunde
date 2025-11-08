// lib/services/daytype-staffing-storage.ts
import { 
  DayTypeStaffing, 
  DayTypeStaffingInput, 
  DAYS_OF_WEEK, 
  TeamScope,
  ServiceTeamScope,
  getDefaultTeamScope,
  isValidTeamScope 
} from '@/lib/types/daytype-staffing';
import { getAllServices } from './diensten-storage';

const STORAGE_KEY = 'rooster_daytype_staffing';
const SERVICE_TEAM_SCOPE_KEY = 'rooster_service_team_scope';

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Migration function for existing data
function migrateExistingData(rules: any[]): DayTypeStaffing[] {
  return rules.map(rule => ({
    ...rule,
    teamScope: rule.teamScope || getDefaultTeamScope()
  }));
}

// Service-level team scope management
export function getAllServiceTeamScopes(): ServiceTeamScope[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(SERVICE_TEAM_SCOPE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading service team scopes:', error);
    return [];
  }
}

export function saveAllServiceTeamScopes(scopes: ServiceTeamScope[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SERVICE_TEAM_SCOPE_KEY, JSON.stringify(scopes));
  } catch (error) {
    console.error('Error saving service team scopes:', error);
    throw new Error('Kon team-scope instellingen niet opslaan');
  }
}

export function getServiceTeamScope(dienstId: string): TeamScope {
  const scopes = getAllServiceTeamScopes();
  const scope = scopes.find(s => s.dienstId === dienstId);
  return scope ? scope.teamScope : getDefaultTeamScope();
}

export function updateServiceTeamScope(dienstId: string, teamScope: TeamScope): void {
  const scopes = getAllServiceTeamScopes();
  const existingIndex = scopes.findIndex(s => s.dienstId === dienstId);
  const now = new Date().toISOString();
  
  if (existingIndex >= 0) {
    scopes[existingIndex] = {
      dienstId,
      teamScope,
      updated_at: now
    };
  } else {
    scopes.push({
      dienstId,
      teamScope,
      updated_at: now
    });
  }
  
  saveAllServiceTeamScopes(scopes);
}

// Enhanced daytype staffing functions with migration
export function getAllDayTypeStaffing(): DayTypeStaffing[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const rules = JSON.parse(stored);
    // Check if migration is needed
    const needsMigration = rules.some((rule: any) => !rule.hasOwnProperty('teamScope'));
    
    if (needsMigration) {
      console.log('Migrating existing daytype staffing data...');
      const migratedRules = migrateExistingData(rules);
      saveAllDayTypeStaffing(migratedRules);
      return migratedRules;
    }
    
    return rules;
  } catch (error) {
    console.error('Error loading daytype staffing:', error);
    return [];
  }
}

export function saveAllDayTypeStaffing(staffingRules: DayTypeStaffing[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Ensure all rules have teamScope
    const validatedRules = staffingRules.map(rule => ({
      ...rule,
      teamScope: rule.teamScope || getDefaultTeamScope()
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validatedRules));
  } catch (error) {
    console.error('Error saving daytype staffing:', error);
    throw new Error('Kon bezettingsregels niet opslaan');
  }
}

export function getStaffingRule(dienstId: string, dagSoort: number): DayTypeStaffing | null {
  const allRules = getAllDayTypeStaffing();
  return allRules.find(rule => rule.dienstId === dienstId && rule.dagSoort === dagSoort) || null;
}

export function upsertStaffingRule(input: DayTypeStaffingInput): DayTypeStaffing {
  if (input.minBezetting < 0 || input.minBezetting > 8) {
    throw new Error('Minimum bezetting moet tussen 0 en 8 zijn');
  }
  if (input.maxBezetting < 0 || input.maxBezetting > 9) {
    throw new Error('Maximum bezetting moet tussen 0 en 9 zijn');
  }
  if (input.minBezetting > input.maxBezetting) {
    throw new Error('Minimum bezetting kan niet hoger zijn dan maximum bezetting');
  }
  if (input.dagSoort < 0 || input.dagSoort > 6) {
    throw new Error('Ongeldige dag van de week');
  }
  if (input.teamScope && !isValidTeamScope(input.teamScope)) {
    throw new Error('Ongeldige team scope');
  }

  const allRules = getAllDayTypeStaffing();
  const existingIndex = allRules.findIndex(rule => 
    rule.dienstId === input.dienstId && rule.dagSoort === input.dagSoort
  );

  const now = new Date().toISOString();
  
  if (existingIndex >= 0) {
    const updatedRule: DayTypeStaffing = {
      ...allRules[existingIndex],
      minBezetting: input.minBezetting,
      maxBezetting: input.maxBezetting,
      teamScope: input.teamScope || allRules[existingIndex].teamScope || getDefaultTeamScope(),
      updated_at: now
    };
    allRules[existingIndex] = updatedRule;
    saveAllDayTypeStaffing(allRules);
    return updatedRule;
  } else {
    const newRule: DayTypeStaffing = {
      id: generateId(),
      dienstId: input.dienstId,
      dagSoort: input.dagSoort,
      minBezetting: input.minBezetting,
      maxBezetting: input.maxBezetting,
      teamScope: input.teamScope || getDefaultTeamScope(),
      created_at: now,
      updated_at: now
    };
    allRules.push(newRule);
    saveAllDayTypeStaffing(allRules);
    return newRule;
  }
}

export async function initializeDefaultStaffingRules(): Promise<DayTypeStaffing[]> {
  const services = await getAllServices();
  const existingRules = getAllDayTypeStaffing();
  // Beschermende check: als er al regels zijn, niet opnieuw initialiseren
  if (existingRules.length > 0) {
    return existingRules;
  }

  const allRules: DayTypeStaffing[] = [];
  const now = new Date().toISOString();
  
  services.forEach(service => {
    DAYS_OF_WEEK.forEach(day => {
      let defaultMax = 2;
      if (service.code.toLowerCase() === 's' || service.code.toLowerCase() === 'standby') {
        defaultMax = 1;
      }
      const newRule: DayTypeStaffing = {
        id: generateId(),
        dienstId: service.id,
        dagSoort: day.index,
        minBezetting: 0,
        maxBezetting: defaultMax,
        teamScope: getDefaultTeamScope(),
        created_at: now,
        updated_at: now
      };
      allRules.push(newRule);
    });
  });
  
  saveAllDayTypeStaffing(allRules);
  return allRules;
}

export async function deleteStaffingRule(id: string): Promise<void> {
  const allRules = getAllDayTypeStaffing();
  const filteredRules = allRules.filter(rule => rule.id !== id);
  saveAllDayTypeStaffing(filteredRules);
}

export async function deleteStaffingRulesForService(dienstId: string): Promise<void> {
  const allRules = getAllDayTypeStaffing();
  const filteredRules = allRules.filter(rule => rule.dienstId !== dienstId);
  saveAllDayTypeStaffing(filteredRules);
  // Also remove service team scope
  const scopes = getAllServiceTeamScopes();
  const filteredScopes = scopes.filter(scope => scope.dienstId !== dienstId);
  saveAllServiceTeamScopes(filteredScopes);
}

export async function resetToDefaults(): Promise<DayTypeStaffing[]> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SERVICE_TEAM_SCOPE_KEY);
  }
  return await initializeDefaultStaffingRules();
}

export function exportStaffingRules(): string {
  const allRules = getAllDayTypeStaffing();
  const serviceScopes = getAllServiceTeamScopes();
  
  return JSON.stringify({
    staffingRules: allRules,
    serviceTeamScopes: serviceScopes,
    exportDate: new Date().toISOString(),
    version: '2.0' // Version with team scope support
  }, null, 2);
}

export async function importStaffingRules(jsonData: string): Promise<void> {
  try {
    const data = JSON.parse(jsonData);
    // Check if it's new format with team scopes or legacy format
    if (data.version && data.staffingRules && data.serviceTeamScopes) {
      // New format
      if (!Array.isArray(data.staffingRules)) {
        throw new Error('staffingRules moet een array zijn');
      }
      data.staffingRules.forEach((rule: any, index: number) => {
        if (!rule.id || !rule.dienstId || typeof rule.dagSoort !== 'number' || 
            typeof rule.minBezetting !== 'number' || typeof rule.maxBezetting !== 'number') {
          throw new Error(`Ongeldige regel op index ${index}`);
        }
      });
      saveAllDayTypeStaffing(data.staffingRules);
      saveAllServiceTeamScopes(data.serviceTeamScopes || []);
    } else {
      // Legacy format - assume it's just the rules array
      const rules = Array.isArray(data) ? data : [data];
      rules.forEach((rule: any, index: number) => {
        if (!rule.id || !rule.dienstId || typeof rule.dagSoort !== 'number' || 
            typeof rule.minBezetting !== 'number' || typeof rule.maxBezetting !== 'number') {
          throw new Error(`Ongeldige regel op index ${index}`);
        }
      });
      // Migrate legacy data
      const migratedRules = migrateExistingData(rules);
      saveAllDayTypeStaffing(migratedRules);
    }
  } catch (error) {
    console.error('Error importing staffing rules:', error);
    throw new Error('Kon bezettingsregels niet importeren: ' + (error as Error).message);
  }
}
