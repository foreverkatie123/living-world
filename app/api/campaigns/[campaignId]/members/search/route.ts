import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  // Verify the caller is the DM
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('campaign_members')
    .select('role')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (membership?.role !== 'dm') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use admin client to search auth.users by email
  const admin = createAdminClient()
  const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 1000 })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lq = q.toLowerCase()
  const matched = users.filter(u =>
    u.email?.toLowerCase().includes(lq)
  )

  // Exclude users already in this campaign
  const { data: existing } = await supabase
    .from('campaign_members')
    .select('user_id')
    .eq('campaign_id', campaignId)

  const existingIds = new Set((existing ?? []).map((m: { user_id: string }) => m.user_id))

  const results = matched
    .filter(u => !existingIds.has(u.id))
    .slice(0, 10)
    .map(u => ({
      id: u.id,
      email: u.email,
      // Fall back through common metadata fields, then email
      display_name: u.user_metadata?.display_name
        ?? u.user_metadata?.full_name
        ?? u.user_metadata?.name
        ?? u.email,
    }))

  return NextResponse.json(results)
}