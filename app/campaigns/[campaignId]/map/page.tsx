import { getCampaign, getMapPins, getUserRole } from '@/lib/db'
import { notFound } from 'next/navigation'
import MapClient from '@/components/map/MapClient'

interface Props {
  params: Promise<{ campaignId: string }>
}

export default async function MapPage({ params }: Props) {
  const { campaignId } = await params
  const [campaign, pins, role] = await Promise.all([
    getCampaign(campaignId),
    getMapPins(campaignId),
    getUserRole(campaignId),
  ])
  if (!campaign) notFound()

  return (
    <MapClient
      campaign={campaign}
      initialPins={pins}
      role={role ?? 'player'}
    />
  )
}