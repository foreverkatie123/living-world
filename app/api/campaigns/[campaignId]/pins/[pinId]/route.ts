import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; pinId: string }> }
) {
  try {
    const { pinId } = await params
    const body = await req.json()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('map_pins')
      .update(body)
      .eq('id', pinId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; pinId: string }> }
) {
  try {
    const { pinId } = await params
    const admin = createAdminClient()
    const { error } = await admin.from('map_pins').delete().eq('id', pinId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}