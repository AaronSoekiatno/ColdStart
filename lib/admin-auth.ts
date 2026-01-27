import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const ADMIN_EMAILS = [
  'admin@hermes.com',
  'aidan@hermes.com',
  // Add more admin emails here
];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
             cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw new Error('Unauthorized: Not logged in');
  }

  if (!isAdmin(user.email)) {
    console.warn(`[AdminAuth] Blocking access for non-admin user: ${user.email}`);
    
    // In development, we can optionally allow access or just throw more descriptive error
    if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [AdminAuth] DEVELOPMENT MODE: Allowing admin access for testing.');
        return user;
    }

    throw new Error(`Unauthorized: Admin access required. Current user: ${user.email}`);
  }

  return user;
}
