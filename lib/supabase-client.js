/**
 * Supabase Client Configuration
 * 
 * Centralized Supabase client with connection pooling
 * for session management persistence.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: false // Server-side, no need to persist
    },
    db: {
        schema: 'public'
    }
});

/**
 * Database Tables
 */
export const TABLES = {
    SESSIONS: 'interview_sessions',
    PHASE_HISTORY: 'phase_history'
};

export default supabase;
