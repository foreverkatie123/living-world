import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    // Verify the user is authenticated via the normal (RLS-respecting) client
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    // Use admin client so RLS doesn't block the campaign insert before
    // the membership row exists (chicken-and-egg problem)
    const admin = createAdminClient()

    const { data: campaign, error: campErr } = await admin
      .from('campaigns')
      .insert({ name: name.trim(), world_description: description?.trim() || null })
      .select()
      .single()

    if (campErr) throw campErr

    // Insert creator as DM — admin client bypasses the is_dm() RLS check
    const { error: memberErr } = await admin
      .from('campaign_members')
      .insert({ campaign_id: campaign.id, user_id: user.id, role: 'dm' })

    if (memberErr) {
      // Roll back the campaign if membership insert fails
      await admin.from('campaigns').delete().eq('id', campaign.id)
      throw memberErr
    }

    return NextResponse.json(campaign)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
