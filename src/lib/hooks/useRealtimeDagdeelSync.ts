/**
 * ============================================================================
 * DRAAD 162B+ WORKING SOLUTION: Real-Time Dagdeel Synchronization
 * Purpose: Listen to Supabase real-time changes and auto-update React state
 * Deploy Date: 2025-12-12
 * Version: DRAAD162B-REALTIME-v1
 * ============================================================================
 * 
 * ROOT CAUSE FIX:
 * Problem: React useState cache not updated when Supabase DB changes
 * Solution: Subscribe to dagdeel real-time events and sync state automatically
 * Result: Modal shows fresh data immediately after PUT
 * ============================================================================
 */

import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

interface DagdeelChange {
  old: Record<string, any>;
  new: Record<string, any>;
}

interface UseRealtimeDagdeelSyncOptions {
  rosterId?: string;
  onDagdeelUpdate?: (change: DagdeelChange) => void;
  onDagdeelDelete?: (id: string) => void;
  autoSubscribe?: boolean;
  debug?: boolean;
}

/**
 * 🔴 KRITIEKE HOOK: Luistert naar Supabase real-time events op dagdeel tabel
 * 
 * Wanneer:
 * - User update dagdeel via PUT request
 * - Database gewijd en row is inserted/updated
 * - Supabase sturt real-time event
 * - Hook triggert onDagdeelUpdate callback
 * - React component update state
 * - UI toont nieuwe data IMMEDIATELY
 */
export function useRealtimeDagdeelSync(options: UseRealtimeDagdeelSyncOptions = {}) {
  const {
    rosterId,
    onDagdeelUpdate,
    onDagdeelDelete,
    autoSubscribe = true,
    debug = process.env.NODE_ENV === 'development',
  } = options;

  const subscriptionRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  // Initialize Supabase client (assumes it's available globally)
  const supabase = getSupabaseClient();

  const subscribe = useCallback(() => {
    if (!supabase) {
      console.warn('🔴 [DRAAD162B] Supabase client not available');
      return;
    }

    if (debug) {
      console.log('🔄 [DRAAD162B] Subscribing to dagdeel real-time events...');
    }

    // Create unique channel name
    const channelName = rosterId 
      ? `dagdeel-${rosterId}-${Date.now()}`
      : `dagdeel-all-${Date.now()}`;

    // Create Supabase channel
    const channel = supabase.channel(channelName);

    // Listen to INSERT events
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dagdeel',
      },
      (payload: any) => {
        if (debug) {
          console.log('✨ [DRAAD162B] Dagdeel INSERT received:', payload.new);
        }
        onDagdeelUpdate?.({
          old: null,
          new: payload.new,
        });
      }
    );

    // Listen to UPDATE events (🔴 KRITIEK: Dit is waar cache update gebeurt!)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'dagdeel',
      },
      (payload: any) => {
        if (debug) {
          console.log('🔄 [DRAAD162B] Dagdeel UPDATE received:', {
            id: payload.new.id,
            changes: {
              aantal_before: payload.old?.aantal,
              aantal_after: payload.new?.aantal,
            },
          });
        }
        
        // 🟢 THIS IS THE FIX: Update React state immediately
        onDagdeelUpdate?.({
          old: payload.old,
          new: payload.new,
        });
      }
    );

    // Listen to DELETE events
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'dagdeel',
      },
      (payload: any) => {
        if (debug) {
          console.log('🗑️  [DRAAD162B] Dagdeel DELETE received:', payload.old.id);
        }
        onDagdeelDelete?.(payload.old.id);
      }
    );

    // Subscribe to channel
    const subscription = channel.subscribe(
      (status: string, err?: Error) => {
        if (debug) {
          console.log(`📡 [DRAAD162B] Channel subscription status: ${status}`, err || '');
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ [DRAAD162B] Real-time dagdeel listener ACTIVE');
        }
      }
    );

    channelRef.current = channel;
    subscriptionRef.current = subscription;
  }, [supabase, rosterId, onDagdeelUpdate, onDagdeelDelete, debug]);

  const unsubscribe = useCallback(() => {
    if (debug) {
      console.log('🛑 [DRAAD162B] Unsubscribing from dagdeel events');
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = null;
    subscriptionRef.current = null;
  }, [supabase, debug]);

  // Auto-subscribe on mount
  useEffect(() => {
    if (autoSubscribe) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe, autoSubscribe]);

  return {
    subscribe,
    unsubscribe,
    isSubscribed: subscriptionRef.current !== null,
  };
}

/**
 * Get Supabase client from global context or window
 * Adjust based on your app's Supabase setup
 */
function getSupabaseClient() {
  // Try window global
  if (typeof window !== 'undefined' && (window as any).__SUPABASE_CLIENT__) {
    return (window as any).__SUPABASE_CLIENT__;
  }

  // Try importing from your supabase config
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      return createClient(supabaseUrl, supabaseKey);
    }
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }

  return null;
}

export default useRealtimeDagdeelSync;
