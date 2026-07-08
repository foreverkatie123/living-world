import { getCampaigns } from '@/lib/db'
import Link from 'next/link'
import { Plus, Sword, Shield, Calendar } from 'lucide-react'
import CreateCampaignButton from '@/components/ui/CreateCampaignButton'

export default async function CampaignsPage() {
  const campaigns = await getCampaigns()

  return (
    <div className="p-8 pl-12 max-w-4xl" style={{ padding: '0 0 10px 0' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-semibold">Campaigns</h1>
          <p className="text-stone-500 text-sm mt-1">Your active worlds</p>
        </div>
        <CreateCampaignButton />
      </div>

      {campaigns.length === 0 ? (
        <div className="border border-dashed border-stone-700 rounded-xl p-12 text-center">
          <Sword className="mx-auto text-stone-600 mb-3" size={32} />
          <p className="text-stone-400 font-medium">No campaigns yet</p>
          <p className="text-stone-600 text-sm mt-1">Create one to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {campaigns.map(c => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}/${c.role === 'dm' ? 'dm' : 'player'}`}
              className="block bg-stone-900 border border-stone-800 rounded-xl p-5 hover:border-stone-700 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-white font-medium group-hover:text-amber-400 transition-colors">
                  {c.name}
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.role === 'dm'
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-blue-500/15 text-blue-400'
                }`}>
                  {c.role === 'dm' ? 'DM' : 'Player'}
                </span>
              </div>
              {c.world_description && (
                <p className="text-stone-500 text-sm mb-3 line-clamp-2">{c.world_description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-stone-600">
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  Day {c.current_day}
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield size={12} />
                  {c.role === 'dm' ? 'Dungeon Master' : 'Adventurer'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}