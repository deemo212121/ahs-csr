import { NextRequest, NextResponse } from 'next/server';
import { getCompanyBySlug } from '@/lib/firebase/firestore-admin';

// Public, unauthenticated — has to run before anyone's logged in, to
// validate /login/[companyId] and /customer/register/[companyId]. Only
// ever returns whether the slug is real/active and its display name —
// never the underlying ER company UUID, which stays server-side only and
// gets resolved again (not trusted from the client) at registration time.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const company = await getCompanyBySlug(slug);

    if (!company || !company.isActive) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true, companyName: company.companyName });
  } catch (error) {
    return NextResponse.json(
      { valid: false, message: error instanceof Error ? error.message : 'Unable to validate company.' },
      { status: 400 },
    );
  }
}
