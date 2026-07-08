import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCampaign, getUserRole, getFactions, getJobs, getConsequenceLog, getCharacters } from '@/lib/db'
import { getCampaignMembers } from '@/lib/db'
import DMDashboardClient from '@/components/dm/DMDashboardClient'

interface Props {
  params: Promise<{ campaignId: string }>
}

export default async function DMPage({ params }: Props) {
  const { campaignId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [campaign, role] = await Promise.all([
    getCampaign(campaignId),
    getUserRole(campaignId),
  ])

  if (!campaign) notFound()
  if (role !== 'dm') redirect(`/campaigns/${campaignId}/play`)

  const [factions, jobs, log, characters, members] = await Promise.all([
    getFactions(campaignId),
    getJobs(campaignId),
    getConsequenceLog(campaignId, 10),
    getCharacters(campaignId),
    getCampaignMembers(campaignId),
  ])

  return (
    <DMDashboardClient
      campaign={campaign}
      factions={factions}
      jobs={jobs}
      log={log}
      characters={characters}
      members={members}
      currentUserId={user.id}
    />
  )
}