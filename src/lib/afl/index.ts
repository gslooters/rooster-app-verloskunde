/**
 * AFL (Autofill) Module
 * Export all modules and orchestrator for easy importing
 * 
 * Phase 1: Load Engine (afl-engine.ts) ✅
 * Phase 2: Solve Engine (solve-engine.ts) ✅
 * Phase 3: DIO/DDO Chain Engine (chain-engine.ts) ✅
 * Phase 4: Database Writer (write-engine.ts) ✅
 * Phase 5: Report Generator (integrated in orchestrator) ✅
 * 
 * MAIN ENTRY: runAflPipeline(rosterId) - Complete AFL pipeline
 */

export * from './types';
export { AflEngine, getAflEngine, runAflPipeline } from './afl-engine';
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

// Write Engine: Database Writer
export type { WriteEngineResult } from './write-engine';
export { WriteEngine, getWriteEngine, writeAflResultToDatabase } from './write-engine';
