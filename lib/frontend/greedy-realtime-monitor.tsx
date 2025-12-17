/**
 * DRAAD-205 FASE 4: FRONTEND INTEGRATION – GREEDY REALTIME MONITORING
 * 
 * ============================================================================
 * PURPOSE
 * ============================================================================
 * 
 * This module provides Frontend integration with the autonomously-executing
 * Greedy service. Instead of waiting for a long-running HTTP response, the
 * Frontend immediately receives the Backend response and then subscribes to
 * realtime Supabase events.
 * 
 * As Greedy assigns shifts to employees, each UPDATE to roster_assignments
 * triggers a realtime event, which the Frontend catches and uses to update
 * the UI in real-time.
 * 
 * ============================================================================
 * ARCHITECTURE (DRAAD-204 MODEL)
 * ============================================================================
 * 
 * Frontend (NEXT.JS PAGE)
 *    ↓
 *    User clicks "Start Roostering" button
 *    POST /api/roster/solve { roster_id }
 *    ↓ (immediate response: < 1 second)
 * Backend (DRAAD-204 FASE 3)
 *    1. Validate roster
 *    2. Build minimal GreedyRequest
 *    3. Send to Greedy (async, fire-and-forget)
 *    4. Update router status to 'in_progress'
 *    5. Return immediately
 *    ↓ (returns with instructions)
 * Frontend receives response:
 *    - success: true
 *    - message: "Greedy is aan het werk..."
 *    - frontend_instructions: { table, filter, events }
 *    ↓ (subscribes to realtime)
 * Frontend sets up Supabase subscription:
 *    - Table: roster_assignments
 *    - Filter: { roster_id: 'xxx' }
 *    - Events: ['UPDATE', 'INSERT']
 *    ↓ (watches for changes)
 * Greedy Service (AUTONOMOUS)
 *    1. Load data from Supabase
 *    2. Run algorithm (day/dagdeel iteration)
 *    3. For each service:
 *       - Select employee (greedy)
 *       - UPDATE roster_assignments directly in DB
 *       - Triggers realtime event
 *    ↓ (each update is instant)
 * Frontend receives realtime event:
 *    - payload.new: { id, service_id, employee_id, status: 1, source: 'greedy' }
 *    ↓ (updates UI)
 * Frontend updates UI:
 *    - Find row by assignment ID
 *    - Update employee, service, status
 *    - Show visual feedback (animation, highlight)
 *    - Update coverage % (live)
 *    - Update employee workload (live)
 * 
 * Result: User sees shifts being assigned in REAL-TIME ✅
 * 
 * ============================================================================
 * KEY CONCEPTS
 * ============================================================================
 * 
 * 1. ASYNC FIRE-AND-FORGET
 *    - Backend doesn't wait for Greedy
 *    - Returns immediately (< 1 second)
 *    - Greedy runs in background
 *    - Frontend monitors via subscription (no polling needed)
 * 
 * 2. SUPABASE REALTIME
 *    - Websocket-based real-time updates
 *    - Triggered by DB INSERT/UPDATE/DELETE
 *    - Ultra-low latency (< 100ms typically)
 *    - Works even with large payloads
 * 
 * 3. GREEDY AUTONOMY
 *    - Has own Supabase client (from credentials in request)
 *    - Reads all data directly (employees, services, constraints)
 *    - Writes assignments directly to DB
 *    - No Backend intermediary needed
 * 
 * 4. FRONTEND RESPONSIBILITY
 *    - Display current state
 *    - Subscribe to changes
 *    - Update UI live
 *    - Handle errors gracefully
 *    - Show user feedback (progress, status)
 * 
 * ============================================================================
 * SUPABASE REALTIME CONFIGURATION
 * ============================================================================
 * 
 * Supabase must have REALTIME enabled on roster_assignments table:
 * 
 * In Supabase Dashboard:
 *   1. Go to Tables (SQL Editor)
 *   2. Find roster_assignments table
 *   3. Click "Publish" (dropdown)
 *   4. Select "Realtime"
 *   5. Check: INSERT, UPDATE columns
 * 
 * Or via SQL:
 * ```sql
 * ALTER PUBLICATION supabase_realtime ADD TABLE roster_assignments;
 * ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS roster_assignments
 *   FOR ALL;
 * ```
 * 
 * ============================================================================
 * USAGE EXAMPLE (IN NEXT.JS PAGE)
 * ============================================================================
 * 
 * import { useGreedyRealtimeMonitor } from '@/lib/frontend/greedy-realtime-monitor';
 * 
 * export default function RosterPage() {
 *   const rosterId = 'xxx-xxx-xxx';
 *   const {
 *     isMonitoring,
 *     assignments,
 *     coverage,
 *     errorMessage,
 *     startMonitoring
 *   } = useGreedyRealtimeMonitor(rosterId);
 * 
 *   const handleSolveClick = async () => {
 *     try {
 *       const response = await fetch('/api/roster/solve', {
 *         method: 'POST',
 *         body: JSON.stringify({ roster_id: rosterId })
 *       });
 * 
 *       if (!response.ok) {
 *         showError('Failed to start roostering');
 *         return;
 *       }
 * 
 *       const data = await response.json();
 * 
 *       if (!data.success) {
 *         showError(data.userMessage);
 *         return;
 *       }
 * 
 *       // Start monitoring realtime updates
 *       startMonitoring(data.frontend_instructions);
 * 
 *       // Show notification
 *       showSuccess('Greedy is aan het werk... Updates volgen live!');
 * 
 *     } catch (error) {
 *       showError('Error: ' + error.message);
 *     }
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleSolveClick}>Start Roostering</button>
 *       
 *       {isMonitoring && (
 *         <div className="live-monitor">
 *           <h3>Greedy aan het werk...</h3>
 *           <div className="coverage">Coverage: {coverage.toFixed(1)}%</div>
 *           <div className="assignments-count">{assignments.length} shifts assigned</div>
 *           <AssignmentsTable assignments={assignments} />
 *         </div>
 *       )}
 * 
 *       {errorMessage && (
 *         <div className="error">Error: {errorMessage}</div>
 *       )}
 *     </div>
 *   );
 * }
 * 
 * ============================================================================
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RosterAssignment {
  id: string;
  roster_id: string;
  employee_id: string;
  date: string;
  dagdeel: string;
  status: number; // 0=unassigned, 1=assigned, 2=blocked, 3=fixed
  service_id: string | null;
  source: string; // 'greedy', 'manual', 'suggested', 'fixed'
  created_at: string;
  updated_at: string;
}

interface FrontendInstructions {
  action: string;
  table: string;
  filter: Record<string, any>;
  events: string[];
  description: string;
}

interface GreedyRealtimeMonitorState {
  isMonitoring: boolean;
  assignments: RosterAssignment[];
  coverage: number; // 0-100 percentage
  assignmentCount: number;
  errorMessage: string | null;
  lastUpdate: Date | null;
}

// ============================================================================
// HOOK: useGreedyRealtimeMonitor
// ============================================================================

/**
 * React hook for monitoring Greedy realtime updates
 * 
 * Usage:
 * const { isMonitoring, assignments, coverage, startMonitoring, stopMonitoring } 
 *   = useGreedyRealtimeMonitor(rosterId);
 */
export function useGreedyRealtimeMonitor(rosterId: string) {
  const [state, setState] = useState<GreedyRealtimeMonitorState>({
    isMonitoring: false,
    assignments: [],
    coverage: 0,
    assignmentCount: 0,
    errorMessage: null,
    lastUpdate: null
  });

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const assignmentsRef = useRef<Map<string, RosterAssignment>>(new Map());

  // ========================================================================
  // Initialize Supabase Client
  // ========================================================================

  useEffect(() => {
    supabaseRef.current = createClient();
  }, []);

  // ========================================================================
  // START MONITORING: Subscribe to realtime updates
  // ========================================================================

  const startMonitoring = useCallback(
    async (instructions?: FrontendInstructions) => {
      if (!supabaseRef.current) {
        setState((prev) => ({
          ...prev,
          errorMessage: 'Supabase client niet geïnitialiseerd'
        }));
        return;
      }

      console.log('[DRAAD-205] === START MONITORING ===');
      console.log('[DRAAD-205] Roster ID:', rosterId);
      console.log('[DRAAD-205] Instructions:', instructions);

      try {
        // Set monitoring state
        setState((prev) => ({
          ...prev,
          isMonitoring: true,
          errorMessage: null,
          assignments: [],
          assignmentCount: 0,
          coverage: 0,
          lastUpdate: null
        }));

        // Create realtime subscription channel
        const channel = supabaseRef.current
          .channel(`roster_assignments:${rosterId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // All events: INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'roster_assignments',
              filter: `roster_id=eq.${rosterId}`
            },
            (payload) => {
              handleRealtimeEvent(payload);
            }
          )
          .subscribe((status) => {
            console.log(`[DRAAD-205] Subscription status: ${status}`);
            if (status === 'SUBSCRIBED') {
              console.log('[DRAAD-205] ✅ Realtime subscription active');
            } else if (status === 'CHANNEL_ERROR') {
              setState((prev) => ({
                ...prev,
                errorMessage:
                  'Realtime subscription error. Updates may be delayed.'
              }));
            }
          });

        subscriptionRef.current = channel;
        console.log('[DRAAD-205] Realtime subscription configured');
      } catch (error: any) {
        console.error('[DRAAD-205] Error starting monitoring:', error);
        setState((prev) => ({
          ...prev,
          errorMessage: `Monitoring error: ${error.message}`,
          isMonitoring: false
        }));
      }
    },
    [rosterId]
  );

  // ========================================================================
  // HANDLE REALTIME EVENT
  // ========================================================================

  const handleRealtimeEvent = useCallback((payload: any) => {
    console.log('[DRAAD-205] 📡 Realtime event received');
    console.log('[DRAAD-205] Event type:', payload.eventType);
    console.log('[DRAAD-205] New:', payload.new);
    console.log('[DRAAD-205] Old:', payload.old);

    const assignment = payload.new as RosterAssignment;

    if (!assignment?.id) {
      console.warn('[DRAAD-205] Invalid assignment in event');
      return;
    }

    // Update assignments map
    assignmentsRef.current.set(assignment.id, assignment);

    // Convert map to array
    const assignmentsArray = Array.from(assignmentsRef.current.values());

    // Calculate coverage (assignments with status=1)
    const assignedCount = assignmentsArray.filter(
      (a) => a.status === 1
    ).length;
    const totalCount = assignmentsArray.length;
    const coverage = totalCount > 0 ? (assignedCount / totalCount) * 100 : 0;

    // Update state
    setState((prev) => ({
      ...prev,
      assignments: assignmentsArray,
      assignmentCount: assignedCount,
      coverage,
      lastUpdate: new Date()
    }));

    console.log('[DRAAD-205] ✅ State updated');
    console.log(`[DRAAD-205] Coverage: ${coverage.toFixed(1)}%`);
    console.log(`[DRAAD-205] Assignments: ${assignedCount}/${totalCount}`);
  }, []);

  // ========================================================================
  // STOP MONITORING: Unsubscribe and cleanup
  // ========================================================================

  const stopMonitoring = useCallback(() => {
    console.log('[DRAAD-205] === STOP MONITORING ===');

    if (subscriptionRef.current) {
      supabaseRef.current?.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
      console.log('[DRAAD-205] Subscription removed');
    }

    assignmentsRef.current.clear();

    setState((prev) => ({
      ...prev,
      isMonitoring: false
    }));
  }, []);

  // ========================================================================
  // CLEANUP ON UNMOUNT
  // ========================================================================

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  return {
    // State
    isMonitoring: state.isMonitoring,
    assignments: state.assignments,
    coverage: state.coverage,
    assignmentCount: state.assignmentCount,
    errorMessage: state.errorMessage,
    lastUpdate: state.lastUpdate,

    // Controls
    startMonitoring,
    stopMonitoring,

    // Utils
    getAssignmentById: (id: string) => assignmentsRef.current.get(id),
    getAssignmentsByEmployee: (employeeId: string) =>
      state.assignments.filter((a) => a.employee_id === employeeId),
    getAssignmentsByDate: (date: string) =>
      state.assignments.filter((a) => a.date === date),
    getUnassignedCount: () =>
      state.assignments.filter((a) => a.status === 0).length
  };
}

// ============================================================================
// COMPONENT: GreedyRealtimeMonitor
// ============================================================================

/**
 * Pre-built React component for displaying monitoring status
 * 
 * Usage:
 * <GreedyRealtimeMonitor rosterId={id} onComplete={handleComplete} />
 */
export function GreedyRealtimeMonitor({
  rosterId,
  onComplete,
  pollInterval = 5000 // Optional: poll for completion every 5 seconds
}: {
  rosterId: string;
  onComplete?: (stats: any) => void;
  pollInterval?: number;
}) {
  const {
    isMonitoring,
    assignments,
    coverage,
    assignmentCount,
    errorMessage,
    lastUpdate,
    startMonitoring,
    stopMonitoring
  } = useGreedyRealtimeMonitor(rosterId);

  const unassignedCount = assignments.filter(
    (a) => a.status === 0
  ).length;

  // Optional: Poll for completion
  useEffect(() => {
    if (!isMonitoring) return;

    const timer = setInterval(async () => {
      console.log('[DRAAD-205] Polling for completion...');

      // You could check if all services are assigned
      // If unassignedCount === 0, Greedy is likely done
      if (unassignedCount === 0 && assignments.length > 0) {
        console.log('[DRAAD-205] ✅ All assignments completed!');
        stopMonitoring();
        onComplete?.({
          totalAssignments: assignments.length,
          assignedCount: assignmentCount,
          coverage: coverage,
          completedAt: new Date()
        });
      }
    }, pollInterval);

    return () => clearInterval(timer);
  }, [isMonitoring, unassignedCount, assignments, assignmentCount, coverage, stopMonitoring, onComplete, pollInterval]);

  // Render
  if (!isMonitoring) {
    return null; // Hidden when not monitoring
  }

  return (
    <div className="greedy-realtime-monitor" style={styles.container}>
      <h3 style={styles.title}>Greedy aan het werk...</h3>

      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.label}>Coverage:</span>
          <span style={styles.value}>{coverage.toFixed(1)}%</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.label}>Assigned:</span>
          <span style={styles.value}>
            {assignmentCount}/{assignments.length}
          </span>
        </div>
        <div style={styles.stat}>
          <span style={styles.label}>Unassigned:</span>
          <span style={styles.value}>{unassignedCount}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressContainer}>
        <div
          style={{
            ...styles.progressBar,
            width: `${coverage}%`
          }}
        />
      </div>

      {/* Last update timestamp */}
      {lastUpdate && (
        <div style={styles.timestamp}>
          Last update: {lastUpdate.toLocaleTimeString('nl-NL')}
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div style={styles.error}>{errorMessage}</div>
      )}
    </div>
  );
}

// ============================================================================
// STYLES (INLINE - Can be moved to CSS module)
// ============================================================================

const styles = {
  container: {
    padding: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    marginTop: '16px',
    fontFamily: 'system-ui, sans-serif'
  } as React.CSSProperties,
  title: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '500',
    color: '#333'
  } as React.CSSProperties,
  stats: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  } as React.CSSProperties,
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  } as React.CSSProperties,
  label: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px'
  } as React.CSSProperties,
  value: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2c5aa0'
  } as React.CSSProperties,
  progressContainer: {
    width: '100%',
    height: '24px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px'
  } as React.CSSProperties,
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500'
  } as React.CSSProperties,
  timestamp: {
    fontSize: '12px',
    color: '#999',
    marginBottom: '8px'
  } as React.CSSProperties,
  error: {
    padding: '8px',
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '4px',
    color: '#c62828',
    fontSize: '12px'
  } as React.CSSProperties
};
