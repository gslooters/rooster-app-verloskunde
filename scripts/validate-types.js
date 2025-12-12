#!/usr/bin/env node

/**
 * ============================================================================
 * TypeScript Type Validation Script
 * Purpose: Catch type errors before Railway deployment
 * Usage: npm run validate-types
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 [DRAAD162B] Validating TypeScript interfaces...');

const checks = [
  {
    name: 'DagdeelChange Interface',
    file: 'src/lib/hooks/useRealtimeDagdeelSync.ts',
    patterns: [
      { name: 'old field is nullable', regex: /old:\s*Record<string,\s*any>\s*\|\s*null/ },
      { name: 'new field required', regex: /new:\s*Record<string,\s*any>/ },
    ],
  },
];

let errors = 0;

checks.forEach((check) => {
  const filePath = path.join(__dirname, '..', check.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ [NOT FOUND] ${check.file}`);
    errors++;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(`  ✅ [FOUND] ${check.file}`);

  check.patterns.forEach((pattern) => {
    if (!pattern.regex.test(content)) {
      console.log(`    ❌ MISSING: ${pattern.name}`);
      errors++;
    } else {
      console.log(`    ✅ VALID: ${pattern.name}`);
    }
  });
});

if (errors > 0) {
  console.log(`\n🔴 ${errors} validation error(s) found!`);
  process.exit(1);
} else {
  console.log('\n🟢 All TypeScript interfaces are valid!');
  process.exit(0);
}
