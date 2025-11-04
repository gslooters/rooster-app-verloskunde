// lib/utils/migration-test.ts
// Utilities voor migratie testing en verificatie

import { 
  getAllEmployees, 
  getMigrationStats, 
  resetMigrationFlag 
} from '../services/employees-storage';
import { 
  Employee, 
  DienstverbandType, 
  TeamType, 
  getFullName 
} from '../types/employee';

// Interface voor migratie test resultaten
export interface MigrationTestResult {
  success: boolean;
  message: string;
  stats: {
    total: number;
    maat: number;
    loondienst: number;
    zzp: number;
    groen: number;
    oranje: number;
    overig: number;
  };
  violations: string[];
}

// Test de migratie resultaten tegen verwachte verdeling
export function testMigrationResults(): MigrationTestResult {
  const stats = getMigrationStats();
  const employees = getAllEmployees();
  const violations: string[] = [];
  
  // Test 1: 60/40 verdeling voor dienstverband (alleen Maat/Loondienst)
  const nonZzpCount = stats.maat + stats.loondienst;
  const expectedMaat = Math.round(nonZzpCount * 0.6);
  const expectedLoondienst = nonZzpCount - expectedMaat;
  
  if (Math.abs(stats.maat - expectedMaat) > 1) {
    violations.push(`Maat count verwacht ~${expectedMaat}, daadwerkelijk ${stats.maat}`);
  }
  
  if (Math.abs(stats.loondienst - expectedLoondienst) > 1) {
    violations.push(`Loondienst count verwacht ~${expectedLoondienst}, daadwerkelijk ${stats.loondienst}`);
  }
  
  // Test 2: Exact 1 Overig team
  if (stats.overig !== 1) {
    violations.push(`Overig team moet exact 1 zijn, daadwerkelijk ${stats.overig}`);
  }
  
  // Test 3: Alfabetische volgorde check
  const sortedEmployees = employees.sort((a, b) => 
    a.achternaam.toLowerCase().localeCompare(b.achternaam.toLowerCase())
  );
  
  const maatCount = Math.round(employees.length * 0.6);
  const firstMaatEmployee = sortedEmployees[0];
  const lastMaatEmployee = sortedEmployees[maatCount - 1];
  const firstLoondienstEmployee = sortedEmployees[maatCount];
  
  if (firstMaatEmployee.dienstverband !== DienstverbandType.MAAT) {
    violations.push(`Eerste employee (${getFullName(firstMaatEmployee)}) zou Maat moeten zijn`);
  }
  
  if (lastMaatEmployee.dienstverband !== DienstverbandType.MAAT) {
    violations.push(`Laatste Maat employee (${getFullName(lastMaatEmployee)}) heeft verkeerd dienstverband`);
  }
  
  if (firstLoondienstEmployee && firstLoondienstEmployee.dienstverband !== DienstverbandType.LOONDIENST) {
    violations.push(`Eerste Loondienst employee (${getFullName(firstLoondienstEmployee)}) heeft verkeerd dienstverband`);
  }
  
  // Test 4: Team verdeling binnen dienstverband groepen
  const maatEmployees = employees.filter(e => e.dienstverband === DienstverbandType.MAAT);
  const loondienstEmployees = employees.filter(e => e.dienstverband === DienstverbandType.LOONDIENST);
  
  const maatGroen = maatEmployees.filter(e => e.team === TeamType.GROEN).length;
  const maatOranje = maatEmployees.filter(e => e.team === TeamType.ORANJE).length;
  const maatOverig = maatEmployees.filter(e => e.team === TeamType.OVERIG).length;
  
  const loondienstGroen = loondienstEmployees.filter(e => e.team === TeamType.GROEN).length;
  const loondienstOranje = loondienstEmployees.filter(e => e.team === TeamType.ORANJE).length;
  const loondienstOverig = loondienstEmployees.filter(e => e.team === TeamType.OVERIG).length;
  
  // Check of Maat employees redelijk verdeeld zijn (max 1 verschil)
  if (Math.abs(maatGroen - maatOranje) > 1 && maatOverig === 0) {
    violations.push(`Maat employees ongelijk verdeeld: Groen=${maatGroen}, Oranje=${maatOranje}`);
  }
  
  // Check of Loondienst employees redelijk verdeeld zijn
  if (Math.abs(loondienstGroen - loondienstOranje) > 1 && loondienstOverig === 0) {
    violations.push(`Loondienst employees ongelijk verdeeld: Groen=${loondienstGroen}, Oranje=${loondienstOranje}`);
  }
  
  // Test 5: Alle employees hebben default values
  const invalidDefaults = employees.filter(emp => 
    emp.aantalWerkdagen !== 24 || 
    !Array.isArray(emp.roostervrijDagen) ||
    emp.roostervrijDagen.length > 7 // Max 7 dagen per week
  );
  
  if (invalidDefaults.length > 0) {
    violations.push(`${invalidDefaults.length} employees hebben incorrecte default waarden`);
  }
  
  const success = violations.length === 0;
  const message = success 
    ? `Migratie succesvol! ${stats.total} employees correct gemigreerd.`
    : `Migratie heeft ${violations.length} problemen gedetecteerd.`;
  
  return {
    success,
    message,
    stats,
    violations
  };
}

// Reset migratie voor hertest
export function resetMigrationForTesting(): void {
  resetMigrationFlag();
  console.log('Migratie flag gereset - herlaad de pagina om migratie opnieuw uit te voeren');
}

// Print uitgebreide migratie statistieken
export function printMigrationReport(): void {
  const result = testMigrationResults();
  const employees = getAllEmployees();
  
  console.group('🔄 MIGRATIE RAPPORT');
  
  console.log('📊 Statistieken:');
  console.log(`  Total: ${result.stats.total}`);
  console.log(`  Maat: ${result.stats.maat} (${((result.stats.maat / result.stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Loondienst: ${result.stats.loondienst} (${((result.stats.loondienst / result.stats.total) * 100).toFixed(1)}%)`);
  console.log(`  ZZP: ${result.stats.zzp}`);
  console.log('');
  console.log(`  Groen: ${result.stats.groen}`);
  console.log(`  Oranje: ${result.stats.oranje}`);
  console.log(`  Overig: ${result.stats.overig}`);
  
  console.log('');
  console.log('👥 Employee Details (alfabetisch):');
  const sortedEmployees = employees.sort((a, b) => 
    a.achternaam.toLowerCase().localeCompare(b.achternaam.toLowerCase())
  );
  
  sortedEmployees.forEach((emp, index) => {
    console.log(`  ${index + 1}. ${getFullName(emp)} - ${emp.dienstverband} - ${emp.team} - ${emp.aantalWerkdagen}d`);
  });
  
  if (result.violations.length > 0) {
    console.log('');
    console.log('⚠️  Violations:');
    result.violations.forEach(violation => {
      console.log(`  - ${violation}`);
    });
  }
  
  console.log('');
  console.log(`✅ Status: ${result.message}`);
  
  console.groupEnd();
}

// Test scenario: simuleer migratie met test data
export function simulateMigrationWithTestData(): void {
  const testEmployees = [
    { achternaam: 'Bakker', voornaam: 'Anna' },
    { achternaam: 'de Jong', voornaam: 'Bram' },
    { achternaam: 'Jansen', voornaam: 'Carla' },
    { achternaam: 'Peters', voornaam: 'Daan' },
    { achternaam: 'van Dijk', voornaam: 'Eva' },
    { achternaam: 'van der Berg', voornaam: 'Frank' },
    { achternaam: 'Vermeer', voornaam: 'Greta' },
    { achternaam: 'de Vries', voornaam: 'Hans' },
  ];
  
  // Sorteer alfabetisch
  const sorted = testEmployees.sort((a, b) => 
    a.achternaam.toLowerCase().localeCompare(b.achternaam.toLowerCase())
  );
  
  const totalCount = sorted.length;
  const maatCount = Math.round(totalCount * 0.6);
  
  console.group('🧪 MIGRATIE SIMULATIE');
  console.log(`Test data: ${totalCount} employees`);
  console.log(`Verwachte Maat count: ${maatCount}`);
  console.log(`Verwachte Loondienst count: ${totalCount - maatCount}`);
  console.log('');
  
  sorted.forEach((emp, index) => {
    const dienstverband = index < maatCount ? 'Maat' : 'Loondienst';
    const team = index === 0 ? 'Overig' : 
      (index < maatCount ? 
        (index < Math.floor(maatCount / 2) ? 'Groen' : 'Oranje') :
        ((index - maatCount) < Math.floor((totalCount - maatCount) / 2) ? 'Groen' : 'Oranje')
      );
    
    console.log(`${index + 1}. ${emp.voornaam} ${emp.achternaam} → ${dienstverband} → ${team}`);
  });
  
  console.groupEnd();
}

// Browser console helpers
if (typeof window !== 'undefined') {
  (window as any).migrationTest = {
    test: testMigrationResults,
    report: printMigrationReport,
    reset: resetMigrationForTesting,
    simulate: simulateMigrationWithTestData
  };
  
  console.log('🔧 Migratie test tools beschikbaar in console:');
  console.log('  migrationTest.test() - Test migratie resultaten');
  console.log('  migrationTest.report() - Print uitgebreid rapport');
  console.log('  migrationTest.reset() - Reset migratie voor hertest');
  console.log('  migrationTest.simulate() - Simuleer migratie algoritme');
}