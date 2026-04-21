import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDebug = searchParams.get('debug') === '1';

  // Diagnostic Flags (Safe - no secrets leaked)
  const debugInfo = {
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    serviceRoleKeyLen: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().length ?? 0,
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim()),
    vercelEnv: process.env.VERCEL_ENV || 'local',
  };

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      console.error('[Auth-OTP] Supabase Admin client is not initialized.', debugInfo);
      return NextResponse.json({ 
        error: 'Error de configuración del servidor.',
        ...(isDebug ? debugInfo : {})
      }, { status: 500 });
    }

    // 1. Verify Allowlist (Server-Side Secure)
    const { data: allowed, error: dbError } = await supabaseAdmin
      .from('allowed_emails')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (dbError || !allowed) {
      console.warn(`[Auth-OTP] Access denied for: ${email}`);
      return NextResponse.json(
        { error: 'Acceso no autorizado. Contacta al administrador.' }, 
        { status: 403 }
      );
    }

    // 2. Trigger Magic Link/OTP
    // We use the same server client or a public one, 
    // but doing it here ensures the user is already vetted.
    const { error: authError } = await supabaseAdmin.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        // Site URL must be configured in Supabase Dash
        emailRedirectTo: `${new URL(request.url).origin}/sesion`,
      },
    });

    if (authError) {
      console.error('[Auth-OTP] Supabase Auth Error:', authError);
      return NextResponse.json({ error: 'Error al enviar el link de acceso.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Magic Link enviado con éxito.' });
  } catch (err) {
    console.error('[Auth-OTP] Unexpected Error:', err);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
