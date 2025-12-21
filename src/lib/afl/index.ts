/**
 * AFL (Autofill) Module
 * Export all modules for easy importing
 * 
 * Phase 1: Load Engine (afl-engine.ts) ✅
 * Phase 2: Solve Engine (solve-engine.ts) ✅
 * Phase 3: DIO/DDO Chain Engine (chain-engine.ts) ✅
 * Phase 4: Database Writer (future)
 * Phase 5: Report Generator (future)
 */

export * from './types';
export { AflEngine, getAflEngine } from './afl-engine';
export { SolveEngine, runSolveEngine } from './solve-engine';
export {
  ChainEngine,
  DIOChain,
  ValidationError,
  ChainReport,
  ChainDetail,
  runChainEngine,
} from './chain-engine';
