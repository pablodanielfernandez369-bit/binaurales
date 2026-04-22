import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs'; // Ensure Node.js runtime for Service Role compatibility
export const dynamic = 'force-dynamic';

// Shared Diagnostic Flags (Safe - no secrets leaked)
const getDebugInfo = () => ({
  vercelEnv: process.env.VERCEL_ENV || 'local',
  hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  serviceRoleKeyLen: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().length ?? 0,
  hasSupabaseUrl: Boolean(process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
  hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim()),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDebug = searchParams.get('debug') === '1';
  
  // Security: Block GET in production unless a valid DEBUG_TOKEN is provided or it's local dev
  const isLocal = process.env.VERCEL_ENV === 'development' || !process.env.VERCEL_ENV;
  const hasValidToken = searchParams.get('token') === process.env.DEBUG_TOKEN && Boolean(process.env.DEBUG_TOKEN);

  if (!isDebug || (!isLocal && !hasValidToken)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 404 });
  }

  return NextResponse.json({ diagnostics: getDebugInfo() });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDebug = searchParams.get('debug') === '1';
  const debugInfo = getDebugInfo();

  try {
    const body = await request.json();
    const email = body.email;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      console.error('[otp] misconfig: Supabase Admin client is null', debugInfo);
      return NextResponse.json({ 
        error: 'Error de configuración del servidor.',
        ...(isDebug ? debugInfo : {})
      }, { status: 500 });
    }

    // 1. Verify Allowlist (Server-Side Secure)
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
        emailRedirectTo: `${new URL(request.url).origin}/sesion`,
      },
    });

    if (authError) {
      console.error('[otp] auth error:', authError);
      return NextResponse.json({ 
        error: 'Error al enviar el link de acceso.',
        ...(isDebug ? { 
          authError: {
            message: authError.message,
            status: (authError as any).status,
            name: authError.name
          } 
        } : {})
      }, { status: (authError as any).status === 429 ? 429 : 500 });
    }

    return NextResponse.json({ success: true, message: 'Magic Link enviado con éxito.' });
  } catch (err) {
    console.error('[otp] unexpected error:', err);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
