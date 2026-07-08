'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { Sword, Map, Briefcase, Users, BookOpen, MessageSquare, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User
  campaignRole: 'dm' | 'player' | null
}

export default function AppNav({ user, campaignRole }: Props) {
  const pathname   = usePathname()
  const params     = useParams()
  const router     = useRouter()
  const campaignId = params?.campaignId as string | undefined
  const isDM       = campaignRole === 'dm'

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = campaignId ? [
    // DM board only visible to DMs
    ...(isDM ? [{ href: `/campaigns/${campaignId}/dm`,   icon: Users,     label: 'DM board'  }] : []),
    { href: `/campaigns/${campaignId}/map`,  icon: Map,       label: 'World map' },
    { href: `/campaigns/${campaignId}/jobs`, icon: Briefcase, label: 'Job board' },
    { href: `/campaigns/${campaignId}/play`, icon: BookOpen,  label: 'Character' },
  ] : []

  return (
    <nav className="w-14 h-screen sticky top-0 shrink-0 bg-stone-900 border-r border-stone-800 flex flex-col items-center py-4 gap-1">
      <Link href="/campaigns" className="mb-4 p-2 rounded-lg hover:bg-stone-800 transition-colors">
        <Sword size={20} color="#f59e0b" strokeWidth={2} />
      </Link>

      {navItems.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`p-2.5 rounded-lg transition-colors ${
              active ? 'bg-amber-500/15' : 'hover:bg-stone-800'
            }`}
            style={{ color: active ? '#fbbf24' : '#78716c' }}
          >
            <Icon size={18} />
          </Link>
        )
      })}

      {campaignId && (
        <Link
          href={`/campaigns/${campaignId}/messages`}
          title="Messages"
          className="p-2.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors"
        >
          <MessageSquare size={18} />
        </Link>
      )}

      <div className="mt-auto">
        <button
          onClick={signOut}
          title="Sign out"
          className="p-2.5 rounded-lg text-stone-600 hover:text-stone-400 hover:bg-stone-800 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  )
}