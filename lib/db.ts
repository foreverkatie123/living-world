// ============================================================
// Data access layer
// All Supabase queries live here — components just call these.
// ============================================================

import type {
  Campaign, CampaignWithRole, Character, Faction,
  MapPin, Job, ConsequenceLog, SessionStats,
  PlayerNote, Message, AdvanceDayResult, TravelEstimateResult
} from '@/types'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type CampaignMember = {
  user_id: string
  role: 'dm' | 'player'
  email: string | null
  display_name: string | null
}

// ── CAMPAIGNS ────────────────────────────────────────────────

export async function getCampaigns(): Promise<CampaignWithRole[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('campaign_members')
    .select(`
      role,
      campaigns (
        id, name, world_description, current_day,
        map_image_url, created_at, updated_at
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row.campaigns,
    role: row.role,
    member_count: 0, // populated separately if needed
  }))
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createCampaign(name: string, description?: string): Promise<Campaign> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({ name, world_description: description ?? null })
    .select()
    .single()
  if (error) throw error

  // Creator becomes DM
  await supabase
    .from('campaign_members')
    .insert({ campaign_id: campaign.id, user_id: user.id, role: 'dm' })

  return campaign
}

export async function getUserRole(campaignId: string): Promise<'dm' | 'player' | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('campaign_members')
    .select('role')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .single()
  return (data?.role as 'dm' | 'player') ?? null
}

// ── CHARACTERS ───────────────────────────────────────────────

export async function getCharacters(campaignId: string): Promise<Character[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getMyCharacter(campaignId: string): Promise<Character | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('characters')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .single()
  return data ?? null
}

export async function upsertCharacter(
  campaignId: string,
  character: Partial<Character> & { name: string }
): Promise<Character> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('characters')
    .upsert({
      ...character,
      campaign_id: campaignId,
      user_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCharacterHP(
  characterId: string,
  hpCurrent: number
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('characters')
    .update({ hp_current: hpCurrent })
    .eq('id', characterId)
  if (error) throw error
}

// ── FACTIONS ─────────────────────────────────────────────────

export async function getFactions(campaignId: string): Promise<Faction[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('factions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('power', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertFaction(
  campaignId: string,
  faction: Partial<Faction> & { name: string }
): Promise<Faction> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('factions')
    .upsert({ ...faction, campaign_id: campaignId })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── MAP PINS ─────────────────────────────────────────────────

export async function getMapPins(campaignId: string): Promise<MapPin[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('map_pins')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('label')
  if (error) {
    console.error('getMapPins error:', error)
    throw error
  }
  return data ?? []
}

export async function upsertMapPin(
  campaignId: string,
  pin: Partial<MapPin> & { lat: number; lng: number; label: string }
): Promise<MapPin> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('map_pins')
    .upsert({ ...pin, campaign_id: campaignId })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── JOBS ─────────────────────────────────────────────────────

export async function getJobs(campaignId: string, status?: Job['status']): Promise<Job[]> {
  const supabase = await createClient()
  let query = supabase
    .from('jobs')
    .select(`*, faction:factions(id,name,color), location:map_pins(id,label)`)
    .eq('campaign_id', campaignId)
    .order('deadline_day')

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createJob(
  campaignId: string,
  job: Omit<Job, 'id' | 'campaign_id' | 'created_at' | 'updated_at' | 'status'>
): Promise<Job> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...job, campaign_id: campaignId })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── CONSEQUENCE LOG ──────────────────────────────────────────

export async function getConsequenceLog(
  campaignId: string,
  limit = 20
): Promise<ConsequenceLog[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consequence_log')
    .select('*, job:jobs(id,title)')
    .eq('campaign_id', campaignId)
    .order('game_day', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ── SESSION STATS ────────────────────────────────────────────

export async function getSessionStats(characterId: string): Promise<SessionStats[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('session_stats')
    .select('*')
    .eq('character_id', characterId)
    .order('session_number')
  if (error) throw error
  return data ?? []
}

export async function getCampaignRecap(campaignId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('session_stats')
    .select('*, character:characters(name)')
    .eq('campaign_id', campaignId)
  if (error) throw error

  // Aggregate totals per character
  const totals: Record<string, {
    name: string
    kills: number
    healing: number
    damage: number
    kill_types: Record<string, number>
  }> = {}

  for (const s of (data ?? [])) {
    const cid = s.character_id
    if (!totals[cid]) totals[cid] = {
      name: s.character?.name ?? 'Unknown',
      kills: 0, healing: 0, damage: 0, kill_types: {}
    }
    totals[cid].kills   += s.kills
    totals[cid].healing += s.healing_done
    totals[cid].damage  += s.damage_dealt
    for (const [k, v] of Object.entries(s.kill_types as Record<string, number>)) {
      totals[cid].kill_types[k] = (totals[cid].kill_types[k] ?? 0) + v
    }
  }
  return Object.values(totals)
}

// ── WORLD ENGINE (RPC) ───────────────────────────────────────

export async function advanceDay(campaignId: string): Promise<AdvanceDayResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase.rpc('advance_day', {
    p_campaign_id: campaignId,
    p_user_id: user.id,
  })
  if (error) throw error
  return data as AdvanceDayResult
}

export async function resolveJob(
  jobId: string,
  completed = true
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.rpc('resolve_job', {
    p_job_id: jobId,
    p_user_id: user.id,
    p_completed: completed,
  })
  if (error) throw error
}

export async function estimateTravel(
  campaignId: string,
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
  roll: number
): Promise<TravelEstimateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase.rpc('estimate_travel', {
    p_campaign_id: campaignId,
    p_user_id: user.id,
    p_from_lat: fromLat, p_from_lng: fromLng,
    p_to_lat: toLat,     p_to_lng: toLng,
    p_roll: roll,
  })
  if (error) throw error
  return data as TravelEstimateResult
}

// ── MESSAGES ─────────────────────────────────────────────────

export async function getMessages(campaignId: string): Promise<Message[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function sendMessage(
  campaignId: string,
  recipientId: string,
  content: string
): Promise<Message> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log('sendMessage user:', user)
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('messages')
    .insert({ campaign_id: campaignId, sender_id: user.id, recipient_id: recipientId, content })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── PLAYER NOTES ─────────────────────────────────────────────

export async function getNotes(campaignId: string): Promise<PlayerNote[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('player_notes')
    .select('*, pin:map_pins(id,label)')
    .eq('campaign_id', campaignId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertNote(
  campaignId: string,
  note: Partial<PlayerNote> & { title: string; content: string }
): Promise<PlayerNote> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('player_notes')
    .upsert({ ...note, campaign_id: campaignId, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getCampaignMembers(campaignId: string): Promise<CampaignMember[]> {
  const supabase = await createClient()
 
  const { data, error } = await supabase
    .from('campaign_members')
    .select('user_id, role')
    .eq('campaign_id', campaignId)
 
  if (error || !data || data.length === 0) return []
 
  // Fetch auth user details for each member via admin client
  const admin = createAdminClient()
  const members = await Promise.all(
    data.map(async (row: { user_id: string; role: 'dm' | 'player' }) => {
      const { data: { user } } = await admin.auth.admin.getUserById(row.user_id)
      return {
        user_id: row.user_id,
        role: row.role,
        email: user?.email ?? null,
        display_name:
          user?.user_metadata?.display_name
          ?? user?.user_metadata?.full_name
          ?? user?.user_metadata?.name
          ?? user?.email
          ?? null,
      }
    })
  )
 
  return members
}