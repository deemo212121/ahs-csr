import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireRole } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { updateErModePortalRequest, useErTicketDatabase } from '@/lib/er-ticket-database';

const updateRequestSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone_number: z.string().min(5).optional(),
  secondary_phone: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  service_address: z.string().min(3).optional(),
  service_address_2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().min(3).optional(),
  landmark: z.string().optional(),
  manual_brand: z.string().optional(),
  manual_appliance_type: z.string().optional(),
  model_number: z.string().optional(),
  serial_number: z.string().optional(),
  product_model_version: z.string().optional(),
  issue_description: z.string().optional(),
  special_request: z.string().optional(),
  preferred_date: z.string().optional(),
  preferred_time: z.string().optional(),
  purchase_date: z.string().optional(),
  warranty_type: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(request);
    requireRole(auth, ['csr', 'team_leader', 'csr_manager', 'admin']);

    const { id } = await context.params;
    const patch = updateRequestSchema.parse(await request.json());

    if (useErTicketDatabase()) {
      const updated = await updateErModePortalRequest(auth, id, patch);
      return NextResponse.json({ request: updated });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('service_requests')
      .select('id, verification_status')
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error('Request not found.');
    if (existing.verification_status !== 'pending') {
      throw new Error('Only pending requests can be edited.');
    }

    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) update[key] = value || null;
    }
    if (!Object.keys(update).length) {
      throw new Error('No changes to save.');
    }

    const { data, error } = await supabaseAdmin
      .from('service_requests')
      .update(update)
      .eq('id', id)
      .select(
        'id, request_number, full_name, phone_number, secondary_phone, customer_email, service_address, service_address_2, city, region, state, zip_code, landmark, manual_brand, manual_appliance_type, model_number, serial_number, product_model_version, issue_description, special_request, preferred_date, preferred_time, purchase_date, warranty_type, verification_status',
      )
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to update request.' },
      { status: 400 },
    );
  }
}
