import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, inviteCode } = await req.json()

    const isDM = inviteCode === process.env.DM_INVITE_CODE
    const isPlayer = !inviteCode

    // If they entered a code but it's wrong, reject
    if (inviteCode && !isDM) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: name,
        role: isDM ? 'dm' : 'player',
      },
    })

    if (error) throw error

    // Sign them in by returning a session
    // We need to use the browser client for this part — tell the frontend to sign in
    return NextResponse.json({ ok: true, isDM })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}