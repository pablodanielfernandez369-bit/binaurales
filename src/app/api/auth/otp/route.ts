import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs'; // Ensure Node.js runtime for Service Role compatibility
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDebug = searchParams.get('debug') === '1';

  // Diagnostic Flags (Safe - no secrets leaked)
  const debugInfo = {
    vercelEnv: process.env.VERCEL_ENV || 'local',
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    serviceRoleKeyLen: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().length ?? 0,
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim()),
  };

  try {
    const { email } = await request.json();
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      console.error('[otp] misconfig: Supabase Admin client is not initialized.', debugInfo);
      return NextResponse.json({ 
        error: 'Error de configuración del servidor.',
        ...(isDebug ? debugInfo : {})
      }, { status: 500 });
    }

    // 1. Verify Allowlist (Server-Side Secure)
    // We use maybeSingle to handle 'not found' gracefully.
    const { data: allowed, error: dbError } = await supabaseAdmin
      .from('allowed_emails')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (dbError || !allowed) {
      console.warn(`[otp] access denied for: ${normalizedEmail}`);
      return NextResponse.json(
        { error: 'Acceso no autorizado. Contacta al administrador.' }, 
        { status: 403 }
      );
    }

    // 2. Trigger Magic Link/OTP
    const { error: authError } = await supabaseAdmin.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        // Redirect directly to session. 
        // Supabase client-side handles the token automatically on the target page.
        emailRedirectTo: `${new URL(request.url).origin}/sesion`,
      },
    });

    if (authError) {
      console.error('[otp] auth error:', authError);
      return NextResponse.json({ error: 'Error al enviar el link de acceso.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Magic Link enviado con éxito.' });
  } catch (err) {
    console.error('[otp] unexpected error:', err);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
