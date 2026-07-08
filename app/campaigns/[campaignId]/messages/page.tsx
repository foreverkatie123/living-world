import { getCampaign, getMessages, getUserRole } from '@/lib/db'
import { notFound } from 'next/navigation'
import MessageClient from '@/components/messages/MessageClient'

interface Props {
  params: Promise<{ campaignId: string }>
}

export default async function MessagesPage({ params }: Props) {
  const { campaignId } = await params
  const [campaign, messages, role] = await Promise.all([
    getCampaign(campaignId),
    getMessages(campaignId),
    getUserRole(campaignId),
  ])
  if (!campaign) notFound()

  return (
    <MessageClient
      campaign={campaign}
      messages={messages}
      role={role ?? 'player'}
    />
  )
}