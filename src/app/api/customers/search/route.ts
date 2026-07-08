import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    requireRole(context, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const url = new URL(request.url);
    const query = (url.searchParams.get('q') || '').trim();
    if (query.length < 2) {
      return NextResponse.json({ customers: [] });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let searchQuery = supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, phone_number, address, city, state, zip_code, region')
      .eq('role', 'customer')
      .ilike('email', `%${query}%`)
      .order('email', { ascending: true })
      .limit(8);

    if (context.profile.company_id) {
      searchQuery = searchQuery.eq('company_id', context.profile.company_id);
    }

    const { data, error } = await searchQuery;

    if (error) throw new Error(error.message);

    return NextResponse.json({ customers: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to search customers.' },
      { status: 400 },
    );
  }
}
