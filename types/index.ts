// ============================================================
// Database types — mirrors the Supabase schema exactly.
// Run `npx supabase gen types typescript` to regenerate from
// a live project and replace this file.
// ============================================================

export type CampaignRole = 'dm' | 'player'
export type PinType = 'city' | 'town' | 'dungeon' | 'landmark' | 'hidden' | 'party'
export type JobStatus = 'open' | 'accepted' | 'completed' | 'auto_resolved' | 'failed'

export interface Campaign {
  id: string
  name: string
  world_description: string | null
  current_day: number
  map_image_url: string | null
  map_cal_point_a: { lat: number; lng: number; label: string } | null
  map_cal_point_b: { lat: number; lng: number; label: string } | null
  map_cal_days: number | null
  created_at: string
  updated_at: string
}

export interface CampaignMember {
  id: string
  campaign_id: string
  user_id: string
  role: CampaignRole
  joined_at: string
  // Joined from auth.users
  display_name?: string
  email?: string
}

export interface Character {
  id: string
  campaign_id: string
  user_id: string
  name: string
  class: string | null
  subclass: string | null
  background: string | null
  proficiencies: string | null
  features: string | null
  race: string | null
  skill_profs: string | null
  level: number
  hp_current: number
  hp_max: number
  gold: number
  stats: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
    [key: string]: number // homebrew stats
  }
  spells: Spell[]
  inventory: InventoryItem[]
  notes: string | null
  created_at: string
  updated_at: string
  resource_state: string | null
}

export interface Spell {
  name: string
  level: number
  prepared: boolean
  used: boolean
  description?: string
}

export interface InventoryItem {
  name: string
  quantity: number
  weight?: number
  description?: string
  equipped?: boolean
}

export interface SessionStats {
  id: string
  character_id: string
  campaign_id: string
  session_number: number
  game_day_start: number
  kills: number
  healing_done: number
  damage_dealt: number
  kill_types: Record<string, number>
  notes: string | null
  created_at: string
}

export interface Faction {
  id: string
  campaign_id: string
  name: string
  description: string | null
  power: number
  stability: number
  color: string
  created_at: string
  updated_at: string
}

export interface MapPin {
  id: string
  campaign_id: string
  lat: number
  lng: number
  label: string
  pin_type: PinType
  dm_notes: string | null
  player_notes: string | null
  visible_to_players: boolean
  reputation: Record<string, number>
  wealth_level: number
  stability: number
  trade_modifier: number
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  campaign_id: string
  faction_id: string | null
  location_pin_id: string | null
  title: string
  description: string | null
  employer: string
  reward_gold: number
  deadline_day: number
  status: JobStatus
  consequence_completed: string | null
  consequence_ignored: string | null
  faction_delta: Record<string, { completed?: number; ignored?: number }>
  economy_delta: Record<string, { wealth?: number; stability?: number; wealth_completed?: number; stability_completed?: number }>
  created_at: string
  updated_at: string
  // Joined
  faction?: Faction
  location?: MapPin
}

export interface ConsequenceLog {
  id: string
  campaign_id: string
  job_id: string | null
  game_day: number
  description: string
  deltas: Record<string, unknown>
  dm_only: boolean
  created_at: string
  // Joined
  job?: Pick<Job, 'id' | 'title'>
}

export interface PlayerNote {
  id: string
  campaign_id: string
  character_id: string | null
  user_id: string
  title: string
  content: string
  pin_id: string | null
  npc_name: string | null
  session_day: number | null
  created_at: string
  updated_at: string
  // Joined
  pin?: Pick<MapPin, 'id' | 'label'>
}

export interface Message {
  id: string
  campaign_id: string
  sender_id: string
  recipient_id: string
  content: string
  read: boolean
  created_at: string
}

// ── RPC return types ──────────────────────────────────────────

export interface AdvanceDayResult {
  new_day: number
  jobs_resolved: number
  log_entries: Array<{
    job_id: string
    title: string
    consequence: string | null
  }>
}

export interface TravelEstimateResult {
  true_days: number
  roll: number
  fuzz_pct: number
  estimate: number | { min: number; max: number }
  revealed: boolean
}

// ── UI / view helpers ─────────────────────────────────────────

export interface CampaignWithRole extends Campaign {
  role: CampaignRole
  member_count: number
}

export interface CharacterWithOwner extends Character {
  owner_name?: string
  owner_email?: string
}
