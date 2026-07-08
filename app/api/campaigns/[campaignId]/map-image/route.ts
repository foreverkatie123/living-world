import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ext   = file.name.split('.').pop() ?? 'jpg'
    const path  = `${campaignId}/map.${ext}`

    // Upload to Supabase storage
    const { error: uploadErr } = await admin.storage
      .from('campaign-maps')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadErr) throw uploadErr

    // Get public URL
    const { data: { publicUrl } } = admin.storage
      .from('campaign-maps')
      .getPublicUrl(path)

    // Save URL to campaign row
    const { error: updateErr } = await admin
      .from('campaigns')
      .update({ map_image_url: publicUrl })
      .eq('id', campaignId)

    if (updateErr) throw updateErr

    return NextResponse.json({ url: publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Try both jpg and png
    await admin.storage.from('campaign-maps').remove([
      `${campaignId}/map.jpg`,
      `${campaignId}/map.png`,
      `${campaignId}/map.webp`,
    ])

    await admin.from('campaigns').update({ map_image_url: null }).eq('id', campaignId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}