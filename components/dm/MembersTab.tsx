'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, X, Shield, Swords, Loader2 } from 'lucide-react'
import type { CampaignMember } from '@/lib/db'

interface SearchResult {
  id: string
  email: string
  display_name: string
}

interface Props {
  campaignId: string
  members: CampaignMember[]
  currentUserId: string
}

export default function MembersTab({ campaignId, members, currentUserId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState<SearchResult[]>([])
  const [searching, setSearching]       = useState(false)
  const [selectedRole, setSelectedRole] = useState<Record<string, 'dm' | 'player'>>({})
  const [adding, setAdding]             = useState<string | null>(null)
  const [removing, setRemoving]         = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/members/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } finally {
      setSearching(false)
    }
  }, [campaignId])

  function handleQueryChange(val: string) {
    setQuery(val)
    search(val)
  }

  async function addMember(userId: string) {
    const role = selectedRole[userId] ?? 'player'
    setAdding(userId)
    setError(null)
    const res = await fetch(`/api/campaigns/${campaignId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to add member')
    } else {
      setResults(r => r.filter(u => u.id !== userId))
      if (results.length === 1) setQuery('')
      startTransition(() => router.refresh())
    }
    setAdding(null)
  }

  async function removeMember(userId: string) {
    setRemoving(userId)
    setError(null)
    const res = await fetch(`/api/campaigns/${campaignId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to remove member')
    } else {
      startTransition(() => router.refresh())
    }
    setRemoving(null)
  }

  const initials = (name: string) =>
    name.slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5">

      {/* Search box */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
        <h2 className="text-white text-sm font-medium mb-3">Add a player</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search by email…"
            className="w-full bg-stone-800 border border-stone-700 rounded-lg pl-8 pr-4 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
          {searching && (
            <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 animate-spin" />
          )}
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div className="mt-2 space-y-1">
            {results.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-stone-800/60 border border-stone-700/50"
              >
                <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center text-xs font-medium text-stone-300 shrink-0">
                  {initials(u.display_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-stone-200 text-sm truncate">{u.display_name}</div>
                  {u.display_name !== u.email && (
                    <div className="text-stone-600 text-xs truncate">{u.email}</div>
                  )}
                </div>

                {/* Role picker */}
                <div className="flex rounded-md overflow-hidden border border-stone-700 text-xs shrink-0">
                  {(['player', 'dm'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(s => ({ ...s, [u.id]: r }))}
                      className={`px-2.5 py-1 capitalize transition-colors ${
                        (selectedRole[u.id] ?? 'player') === r
                          ? r === 'dm'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-stone-600 text-stone-200'
                          : 'text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => addMember(u.id)}
                  disabled={adding === u.id}
                  className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-medium px-2.5 py-1 rounded-md transition-colors shrink-0"
                >
                  {adding === u.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <UserPlus size={11} />
                  }
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && !searching && results.length === 0 && (
          <p className="text-stone-600 text-xs mt-3 text-center">No users found matching "{query}"</p>
        )}

        {error && (
          <p className="text-red-400 text-xs mt-2">{error}</p>
        )}
      </div>

      {/* Current members */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
        <h2 className="text-white text-sm font-medium mb-3">
          Members
          <span className="text-stone-600 font-normal ml-2">{members.length}</span>
        </h2>

        {members.length === 0 ? (
          <p className="text-stone-600 text-sm py-4 text-center">No members yet.</p>
        ) : (
          members.map(m => {
            const isSelf = m.user_id === currentUserId
            const label = m.display_name ?? m.email ?? m.user_id
            return (
              <div
                key={m.user_id}
                className="flex items-center gap-3 py-3 border-b border-stone-800 last:border-0"
              >
                <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-xs font-medium text-stone-300 shrink-0">
                  {label.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-stone-200 text-sm truncate">{label}</div>
                  {m.email && m.display_name && m.display_name !== m.email && (
                    <div className="text-stone-600 text-xs truncate">{m.email}</div>
                  )}
                </div>

                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                  m.role === 'dm'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-800/50'
                    : 'bg-stone-800 text-stone-400 border-stone-700'
                }`}>
                  {m.role === 'dm'
                    ? <><Shield size={10} /> DM</>
                    : <><Swords size={10} /> Player</>
                  }
                </span>

                {!isSelf && (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    disabled={removing === m.user_id}
                    title="Remove from campaign"
                    className="p-1.5 rounded text-stone-600 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                  >
                    {removing === m.user_id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <X size={13} />
                    }
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}