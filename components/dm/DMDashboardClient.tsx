'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar, AlertTriangle, Zap, ChevronRight,
  Briefcase, Shield, ScrollText, Users, SkipForward
} from 'lucide-react'
import type { Campaign, Faction, Job, ConsequenceLog, Character } from '@/types'
import type { CampaignMember } from '@/lib/db'
import MembersTab from '@/components/dm/MembersTab'

interface Props {
  campaign: Campaign
  factions: Faction[]
  jobs: Job[]
  log: ConsequenceLog[]
  characters: Character[]
  members: CampaignMember[]       // ← new
  currentUserId: string           // ← new
}

type Tab = 'overview' | 'jobs' | 'factions' | 'party' | 'members'

export default function DMDashboardClient({
  campaign, factions, jobs, log, characters, members, currentUserId
}: Props) {
  const router = useRouter()
  const [tab, setTab]         = useState<Tab>('overview')
  const [isPending, startTransition] = useTransition()
  const [lastResult, setLastResult]  = useState<string | null>(null)

  const openJobs    = jobs.filter(j => j.status === 'open')
  const urgentJobs  = openJobs.filter(j => j.deadline_day - campaign.current_day <= 2)

  async function handleAdvanceDay() {
    const res = await fetch(`/api/campaigns/${campaign.id}/advance-day`, { method: 'POST' })
    const data = await res.json()
    if (data.jobs_resolved > 0) {
      setLastResult(`Day advanced to ${data.new_day}. ${data.jobs_resolved} job(s) auto-resolved.`)
    } else {
      setLastResult(`Day advanced to ${data.new_day}. No jobs expired.`)
    }
    startTransition(() => router.refresh())
  }

  async function handleResolveJob(jobId: string, completed: boolean) {
    await fetch(`/api/campaigns/${campaign.id}/jobs/${jobId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    startTransition(() => router.refresh())
  }

  const deadlineClass = (daysLeft: number) => {
    if (daysLeft <= 0)  return 'bg-red-950/50 text-red-400 border border-red-900/50'
    if (daysLeft <= 2)  return 'bg-amber-950/50 text-amber-400 border border-amber-900/50'
    return 'bg-green-950/50 text-green-400 border border-green-900/50'
  }

  return (
    <div className="h-screen overflow-auto padding-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-stone-950/95 backdrop-blur border-b border-stone-800 px-6 py-3 flex items-center justify-between padding-10">
        <div>
          <h1 className="text-white font-semibold">{campaign.name}</h1>
          <p className="text-stone-500 text-xs mt-0.5">DM view</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-amber-400 text-sm font-medium bg-amber-500/10 px-3 py-1.5 rounded-full">
            <Calendar size={13} />
            Day {campaign.current_day}
          </span>
          <button
            onClick={handleAdvanceDay}
            disabled={isPending}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            <SkipForward size={14} />
            Advance day
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="mx-6 mt-4 bg-blue-950/40 border border-blue-900/50 text-blue-300 text-sm rounded-lg px-4 py-2.5 flex items-center justify-between">
          <span>{lastResult}</span>
          <button onClick={() => setLastResult(null)} className="text-blue-500 hover:text-blue-300 text-xs">dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-stone-800">
        {(['overview', 'jobs', 'factions', 'party', 'members'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors capitalize ${
              tab === t
                ? 'bg-stone-900 text-white border border-b-0 border-stone-800'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard icon={<Briefcase size={16} />} label="Open jobs" value={openJobs.length} />
              <StatCard icon={<AlertTriangle size={16} />} label="Expiring soon" value={urgentJobs.length} danger={urgentJobs.length > 0} />
              <StatCard icon={<Zap size={16} />} label="Active factions" value={factions.length} />
            </div>
            <br/>
            <Section title="Consequence log" subtitle={`last ${log.length} events`}>
              {log.length === 0
                ? <Empty>No consequences yet — advance the day to see the world respond.</Empty>
                : log.map(entry => (
                  <div key={entry.id} className="py-3 border-b border-stone-800 last:border-0">
                    <div className="text-xs text-stone-600 mb-1">Day {entry.game_day}</div>
                    <div className="text-sm text-stone-300 leading-relaxed">{entry.description}</div>
                  </div>
                ))
              }
            </Section>

            <br/>
            <div className="grid grid-cols-2 gap-4">
              <Section title="Factions">
                {factions.map(f => (
                  <div key={f.id} className="flex items-center gap-3 py-2 border-b border-stone-800 last:border-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                    <span className="text-sm text-stone-300 flex-1">{f.name}</span>
                    <div className="w-20 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${f.power}%`, background: f.color }} />
                    </div>
                    <span className="text-xs text-stone-600 w-6 text-right">{f.power}</span>
                  </div>
                ))}
              </Section>

              <Section title="Party HP">
                {characters.map(c => {
                  const pct = c.hp_max > 0 ? (c.hp_current / c.hp_max) * 100 : 0
                  const barColor = pct > 50 ? '#639922' : pct > 25 ? '#BA7517' : '#E24B4A'
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-2 border-b border-stone-800 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-xs font-medium text-stone-400">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-stone-300 truncate">{c.name}</div>
                        <div className="w-full h-1 bg-stone-800 rounded-full mt-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                      </div>
                      <span className="text-xs text-stone-600">{c.hp_current}/{c.hp_max}</span>
                    </div>
                  )
                })}
              </Section>
            </div>
          </>
        )}

        {/* ── JOBS ── */}
        {tab === 'jobs' && (
          <Section title="Active jobs">
            {openJobs.length === 0
              ? <Empty>No open jobs. Add some to get the world moving.</Empty>
              : openJobs.map(job => {
                const daysLeft = job.deadline_day - campaign.current_day
                return (
                  <div key={job.id} className="py-4 border-b border-stone-800 last:border-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-white font-medium text-sm">{job.title}</div>
                        <div className="text-stone-500 text-xs mt-0.5">{job.employer} · {job.reward_gold}g</div>
                        {job.description && (
                          <div className="text-stone-400 text-xs mt-1.5 leading-relaxed">{job.description}</div>
                        )}
                        <div className="flex gap-3 mt-2 text-xs">
                          <span className="text-green-500">✓ {job.consequence_completed ?? 'Completed'}</span>
                          <span className="text-red-500">✗ {job.consequence_ignored ?? 'Ignored'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${deadlineClass(daysLeft)}`}>
                          {daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleResolveJob(job.id, true)}
                            className="text-xs border border-green-900 text-green-500 hover:bg-green-950/50 px-2 py-1 rounded transition-colors"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleResolveJob(job.id, false)}
                            className="text-xs border border-red-900 text-red-500 hover:bg-red-950/50 px-2 py-1 rounded transition-colors"
                          >
                            Fail
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            }
          </Section>
        )}

        {/* ── FACTIONS ── */}
        {tab === 'factions' && (
          <Section title="Faction power">
            {factions.map(f => (
              <div key={f.id} className="py-4 border-b border-stone-800 last:border-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: f.color }} />
                  <span className="text-white font-medium text-sm flex-1">{f.name}</span>
                  <span className="text-stone-400 text-sm">{f.power} / 100</span>
                </div>
                <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${f.power}%`, background: f.color }} />
                </div>
                {f.description && (
                  <p className="text-stone-500 text-xs mt-2">{f.description}</p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* ── PARTY ── */}
        {tab === 'party' && (
          <Section title="Party members">
            {characters.length === 0
              ? <Empty>No characters yet.</Empty>
              : characters.map(c => (
                <div key={c.id} className="py-4 border-b border-stone-800 last:border-0 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-sm font-medium text-stone-300">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">{c.name}</div>
                    <div className="text-stone-500 text-xs">{c.race} {c.class} · Level {c.level}</div>
                    <div className="text-stone-500 text-xs mt-0.5">{c.hp_current}/{c.hp_max} HP · {c.gold}g</div>
                  </div>
                </div>
              ))
            }
          </Section>
        )}

        {/* ── MEMBERS ── */}
        {tab === 'members' && (
          <MembersTab
            campaignId={campaign.id}
            members={members}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, danger }: {
  icon: React.ReactNode; label: string; value: number; danger?: boolean
}) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-stone-500 text-xs mb-2">
        {icon} {label}
      </div>
      <div className={`text-3xl font-semibold ${danger ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white text-sm font-medium">{title}</h2>
        {subtitle && <span className="text-stone-600 text-xs">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-stone-600 text-sm py-4 text-center">{children}</p>
}