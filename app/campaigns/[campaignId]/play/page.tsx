import { getCampaign, getMyCharacter, getUserRole } from '@/lib/db'
import { notFound } from 'next/navigation'
import CharacterSheetClient from '@/components/player/CharacterSheetClient'

interface Props {
  params: Promise<{ campaignId: string }>
}

export default async function PlayPage({ params }: Props) {
  const { campaignId } = await params
  const [campaign, character, role] = await Promise.all([
    getCampaign(campaignId),
    getMyCharacter(campaignId),
    getUserRole(campaignId),
  ])
  if (!campaign) notFound()

  return (
    <CharacterSheetClient
      campaign={campaign}
      character={character}
      role={role ?? 'player'}
    />
  )
}