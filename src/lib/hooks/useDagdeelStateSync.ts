/**
 * ============================================================================
 * DRAAD 162B+ STATE SYNC HOOK
 * Purpose: Automatically sync React state with Supabase real-time changes
 * Version: DRAAD162B-STATE-SYNC-v1
 * ============================================================================
 * 
 * USAGE: Use this hook in components that display dagdeel data
 * It automatically:
 * 1. Subscribes to Supabase real-time events
 * 2. Merges new data into React state
 * 3. Triggers re-render when DB changes
 * 4. No manual refresh needed
 */

import { useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import useRealtimeDagdeelSync from './useRealtimeDagdeelSync';

interface DagdeelData {
  id: string;
  [key: string]: any;
}

interface UseDagdeelStateSyncOptions {
  rosterId?: string;
  debug?: boolean;
}

/**
 * Hook dat React state automatically synced houdt met Supabase dagdeel updates
 * 
 * EXAMPLE:
 * ```tsx
 * const [dagdelen, setDagdelen] = useState<DagdeelData[]>([]);
 * 
 * useDagdeelStateSync({
 *   data: dagdelen,
 *   setData: setDagdelen,
 *   rosterId: 'some-roster-id',
 * });
 * 
 * // Wanneer dagdeel in DB updated, dagdelen state auto-updated!
 * ```
 */
export function useDagdeelStateSync<T extends DagdeelData>(
  data: T[],
  setData: Dispatch<SetStateAction<T[]>>,
  options: UseDagdeelStateSyncOptions = {}
) {
  const { rosterId, debug = false } = options;

  const handleDagdeelUpdate = useCallback(
    (change: { old: any; new: any }) => {
      const { new: newData } = change;

      if (debug) {
        console.log('📝 [DRAAD162B-SYNC] Updating state for dagdeel:', newData.id);
      }

      setData((prevData) => {
        // Check if item exists
        const index = prevData.findIndex((d) => d.id === newData.id);

        if (index === -1) {
          // New item, add to state
          if (debug) {
            console.log('✨ [DRAAD162B-SYNC] Adding new dagdeel to state');
          }
          return [...prevData, newData as T];
        } else {
          // Existing item, update it
          if (debug) {
            console.log('🔄 [DRAAD162B-SYNC] Merging dagdeel update into state');
          }
          const updated = [...prevData];
          updated[index] = { ...updated[index], ...newData } as T;
          return updated;
        }
      });
    },
    [setData, debug]
  );

  const handleDagdeelDelete = useCallback(
    (id: string) => {
      if (debug) {
        console.log('🗑️  [DRAAD162B-SYNC] Removing dagdeel from state:', id);
      }

      setData((prevData) => prevData.filter((d) => d.id !== id));
    },
    [setData, debug]
  );

  // Use the real-time listener
  useRealtimeDagdeelSync({
    rosterId,
    onDagdeelUpdate: handleDagdeelUpdate,
    onDagdeelDelete: handleDagdeelDelete,
    autoSubscribe: true,
    debug,
  });
}

/**
 * Alternative: Manual state updater for granular control
 */
export function updateDagdeelInState<T extends DagdeelData>(
  state: T[],
  updatedDagdeel: Partial<DagdeelData> & { id: string }
): T[] {
  return state.map((item) =>
    item.id === updatedDagdeel.id
      ? { ...item, ...updatedDagdeel }
      : item
  ) as T[];
}

/**
 * Get specific dagdeel from state
 */
export function getDagdeelFromState<T extends DagdeelData>(
  state: T[],
  id: string
): T | undefined {
  return state.find((d) => d.id === id);
}

export default useDagdeelStateSync;
