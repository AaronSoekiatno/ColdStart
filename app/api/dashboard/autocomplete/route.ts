import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // Search candidates by name or email
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('id, name, email')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Autocomplete error:', error);
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = (candidates || []).map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      display: `${c.name} (${c.email})`,
    }));

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Autocomplete error:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
