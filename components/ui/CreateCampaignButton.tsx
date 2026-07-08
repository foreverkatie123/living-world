'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function CreateCampaignButton() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc }),
      })
      if (!res.ok) throw new Error(await res.text())
      const campaign = await res.json()
      setOpen(false)
      router.push(`/campaigns/${campaign.id}/dm`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium rounded-lg px-4 py-2 text-sm transition-colors"
      >
        <Plus size={16} /> New campaign
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-medium">New campaign</h2>
              <button onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-stone-400 mb-1.5">Campaign name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="The Iron Coast"
                />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1.5">World description <span className="text-stone-600">(optional)</span></label>
                <textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  placeholder="A coastal kingdom torn between merchant guilds and bandits…"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-stone-700 text-stone-400 rounded-lg py-2.5 text-sm hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  {loading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
