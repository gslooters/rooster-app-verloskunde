/**
 * SUPABASE MIGRATIE TEST
 * Run: npx tsx scripts/test-migration.ts
 */

import { getRosters, upsertRoster, deleteRosterById, generateFiveWeekPeriods } from '@/lib/planning/storage';
import { loadRosterDesignData, initializeRosterDesign } from '@/lib/planning/rosterDesign';

const log = (msg: string) => console.log(`[TEST] ${msg}`);

async function testBasicRosterOperations() {
  log('Testing getRosters()...');
  const rosters = await getRosters();
  if (!Array.isArray(rosters)) throw new Error('getRosters failed');
  log(`✅ Found ${rosters.length} roosters`);

  log('Testing generateFiveWeekPeriods()...');
  const periods = generateFiveWeekPeriods(3);
  if (periods.length !== 3) throw new Error('generateFiveWeekPeriods failed');
  log('✅ Generated 3 periods');
}

async function testRosterLifecycle() {
  const testId = 'test-' + Date.now();
  const periods = generateFiveWeekPeriods(1);
  const period = periods[0];

  log(`Testing roster lifecycle with ID: ${testId}`);

  // Create
  log('1. Creating roster...');
  await upsertRoster({
    id: testId,
    start_date: period.start,
    end_date: period.end,
    status: 'draft',
    created_at: new Date().toISOString()
  });
  log('✅ Roster created');

  // Verify
  log('2. Verifying roster exists...');
  const rosters = await getRosters();
  if (!rosters.find(r => r.id === testId)) throw new Error('Roster not found');
  log('✅ Roster found');

  // Initialize design
  log('3. Initializing design data...');
  await initializeRosterDesign(testId, period.start);
  log('✅ Design initialized');

  // Load design
  log('4. Loading design data...');
  const design = await loadRosterDesignData(testId);
  if (!design || design.rosterId !== testId) throw new Error('Design data invalid');
  log('✅ Design loaded');

  // Cleanup
  log('5. Cleaning up...');
  await deleteRosterById(testId);
  log('✅ Roster deleted');
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 SUPABASE MIGRATIE VALIDATIE');
  console.log('='.repeat(60) + '\n');

  try {
    await testBasicRosterOperations();
    await testRosterLifecycle();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALLE TESTS GESLAAGD');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ TEST GEFAALD');
    console.log('='.repeat(60));
    console.error(error);
    process.exit(1);
  }
}

runTests();
