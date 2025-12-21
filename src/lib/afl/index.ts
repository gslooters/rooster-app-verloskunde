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

// Chain Engine: Separate type and runtime exports
// Types must use 'export type' when isolatedModules is enabled
export type {
  DIOChain,
  ValidationError,
  ChainReport,
  ChainDetail,
} from './chain-engine';

// Runtime values (class and function)
export { ChainEngine, runChainEngine } from './chain-engine';
