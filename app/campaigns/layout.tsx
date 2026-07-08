import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppNav from '@/components/ui/AppNav'

interface Props {
  children: React.ReactNode
  params: Promise<{ campaignId?: string }>
}

export default async function CampaignsLayout({ children, params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // params may or may not have campaignId depending on the route
  const { campaignId } = await params
  let campaignRole: 'dm' | 'player'

  if (campaignId) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .single()
    campaignRole = (data?.role as 'dm' | 'player') ?? 'player'
  }

  return (
    <div className="flex h-screen bg-stone-950">
      {/* <AppNav user={user} campaignRole={campaignRole} /> */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}