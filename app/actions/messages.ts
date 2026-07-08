'use server'

import { sendMessage as dbSendMessage } from '@/lib/db'
import type { Message } from '@/types'

export async function sendMessageAction(
  campaignId: string,
  recipientId: string,
  content: string
): Promise<Message> {
  return dbSendMessage(campaignId, recipientId, content)
}