import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const empresa_id = new URL(req.url).searchParams.get('empresa_id');
  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id' }, { status: 400 });
  }

  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from('v_scan_success_24h')
    .select('*')
    .eq('empresa_id', empresa_id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rates: data || [] });
}
