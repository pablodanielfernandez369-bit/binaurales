import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TARGET_EMAILS = [
  'pablo.daniel.fernandez369@gmail.com',
  'pablo._fernandez@outlook.com'
];

const SECRET_TOKEN = 'reset_binaural_9988'; // Temporary token for this execution

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (token !== SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin not configured' }, { status: 500 });
  }

  const reports = [];

  try {
    for (const email of TARGET_EMAILS) {
      const emailReport: any = { email, steps: [] };
      
      // 1. Find user UID
      const { data: users, error: findError } = await supabaseAdmin.auth.admin.listUsers();
      if (findError) throw findError;

      const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!user) {
        emailReport.steps.push('User not found in Auth, skipping data cleanup for this email.');
        reports.push(emailReport);
        continue;
      }

      const uid = user.id;
      emailReport.uid = uid;

      // 2. Delete Public Data
      const tables = [
        'sessions',
        'daily_checkins',
        'treatment_plans',
        'user_profile',
        'sound_adjustments',
        'weekly_reviews'
      ];

      for (const table of tables) {
        const { error: delErr } = await supabaseAdmin
          .from(table)
          .delete()
          .eq(table === 'user_profile' ? 'id' : 'user_id', uid);
        
        emailReport.steps.push(`Cleanup ${table}: ${delErr ? 'Error ' + delErr.message : 'Success'}`);
      }

      // 3. Delete Auth User
      const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
      emailReport.steps.push(`Delete Auth User: ${authDelErr ? 'Error ' + authDelErr.message : 'Success'}`);

      reports.push(emailReport);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Cleanup process completed.',
      reports 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
