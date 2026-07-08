'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Scroll, Shield, Swords, Plus, X, User } from 'lucide-react'
import type { Campaign, Message } from '@/types'
import { sendMessageAction } from '@/app/actions/messages'

interface Props {
  campaign: Campaign
  messages: Message[]
  role: 'dm' | 'player'
}

// Group messages by conversation thread (the "other" participant)
interface Thread {
  participantId: string
  participantLabel: string
  messages: Message[]
  unread: number
}

export default function MessageClient({ campaign, messages, role }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Derive current user id from context
  // The DM's id is campaign.dm_id; players are in campaign.player_ids
  const myId: string = role === 'dm' ? (campaign as any).dm_id : (campaign as any).player_id ?? ''

  // Build threads: group by the "other" participant
  const threads = buildThreads(messages, myId, role, campaign)

  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    threads.length > 0 ? threads[0].participantId : null
  )
  const [showNewConvo, setShowNewConvo] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [localMessages, setLocalMessages] = useState<Message[]>(messages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeThread = threads.find(t => t.participantId === activeThreadId) ?? null
  const activeMessages = activeThread
    ? localMessages.filter(m =>
        (m.sender_id === myId && m.recipient_id === activeThreadId) ||
        (m.recipient_id === myId && m.sender_id === activeThreadId)
      )
    : []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, activeThreadId])

  async function handleSend() {
    if (!draft.trim() || !activeThreadId || sending) return
    const content = draft.trim()
    setDraft('')
    setSending(true)

    // Optimistic update
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      campaign_id: campaign.id,
      sender_id: myId,
      recipient_id: activeThreadId,
      content,
      read: false,
      created_at: new Date().toISOString(),
    }
    setLocalMessages(prev => [...prev, optimistic])

    try {
      const saved = await sendMessageAction(campaign.id, activeThreadId, content)
      setLocalMessages(prev =>
        prev.map(m => (m.id === optimistic.id ? saved : m))
      )
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      setLocalMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setDraft(content)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="msg-root">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="msg-sidebar">
        <div className="msg-sidebar-header">
          <Scroll size={16} className="msg-scroll-icon" />
          <span className="msg-sidebar-title">{campaign.name}</span>
          <button
            className="msg-new-btn"
            onClick={() => setShowNewConvo(true)}
            aria-label="New conversation"
            title="New conversation"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="msg-sidebar-label">
          {role === 'dm' ? 'Your Players' : 'Messages'}
        </div>

        {threads.length === 0 ? (
          <div className="msg-empty-sidebar">
            <button className="msg-empty-new-btn" onClick={() => setShowNewConvo(true)}>
              <Plus size={13} /> New conversation
            </button>
          </div>
        ) : (
          <ul className="msg-thread-list">
            {threads.map(thread => (
              <li key={thread.participantId}>
                <button
                  className={`msg-thread-item ${activeThreadId === thread.participantId ? 'msg-thread-item--active' : ''}`}
                  onClick={() => setActiveThreadId(thread.participantId)}
                >
                  <span className="msg-avatar">
                    {role === 'dm' ? (
                      <Swords size={14} />
                    ) : (
                      <Shield size={14} />
                    )}
                  </span>
                  <span className="msg-thread-info">
                    <span className="msg-thread-name">{thread.participantLabel}</span>
                    {thread.messages.length > 0 && (
                      <span className="msg-thread-preview">
                        {thread.messages[thread.messages.length - 1].content.slice(0, 40)}
                        {thread.messages[thread.messages.length - 1].content.length > 40 ? '…' : ''}
                      </span>
                    )}
                  </span>
                  {thread.unread > 0 && (
                    <span className="msg-unread-badge">{thread.unread}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* ── New Conversation Modal ───────────────────────── */}
      {showNewConvo && (
        <NewConvoModal
          role={role}
          campaign={campaign}
          existingThreadIds={threads.map(t => t.participantId)}
          myId={myId}
          onSelect={(id) => {
            setActiveThreadId(id)
            setShowNewConvo(false)
          }}
          onClose={() => setShowNewConvo(false)}
        />
      )}

      {/* ── Main chat ───────────────────────────────────── */}
      <main className="msg-main">
        {activeThread ? (
          <>
            <header className="msg-header">
              <span className="msg-header-icon">
                {role === 'dm' ? <Swords size={16} /> : <Shield size={16} />}
              </span>
              <span className="msg-header-name">{activeThread.participantLabel}</span>
            </header>

            <div className="msg-feed">
              {activeMessages.length === 0 && (
                <div className="msg-feed-empty">
                  No messages yet. Send the first one.
                </div>
              )}
              {activeMessages.map((msg, i) => {
                const isMine = msg.sender_id === myId
                const isOptimistic = msg.id.startsWith('opt-')
                const showDate =
                  i === 0 ||
                  !sameDay(activeMessages[i - 1].created_at, msg.created_at)
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="msg-date-divider">
                        <span>{formatDate(msg.created_at)}</span>
                      </div>
                    )}
                    <div className={`msg-bubble-row ${isMine ? 'msg-bubble-row--mine' : ''}`}>
                      <div
                        className={`msg-bubble ${isMine ? 'msg-bubble--mine' : 'msg-bubble--theirs'} ${isOptimistic ? 'msg-bubble--optimistic' : ''}`}
                      >
                        {msg.content}
                      </div>
                      <span className="msg-timestamp">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="msg-compose">
              <textarea
                ref={textareaRef}
                className="msg-textarea"
                placeholder={`Message ${activeThread.participantLabel}…`}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                className="msg-send-btn"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="msg-no-thread">
            <Scroll size={32} className="msg-no-thread-icon" />
            <p>Select a conversation to begin.</p>
          </div>
        )}
      </main>

      <style>{css}</style>
    </div>
  )
}

// ── NewConvoModal ─────────────────────────────────────────────

interface NewConvoModalProps {
  role: 'dm' | 'player'
  campaign: Campaign
  existingThreadIds: string[]
  myId: string
  onSelect: (participantId: string) => void
  onClose: () => void
}

function NewConvoModal({ role, campaign, existingThreadIds, myId, onSelect, onClose }: NewConvoModalProps) {
  const [search, setSearch] = useState('')

  // Build candidate list depending on role
  const candidates: Array<{ id: string; label: string }> = role === 'dm'
    ? ((campaign as any).players ?? []).map((p: { id: string; name: string }) => ({ id: p.id, label: p.name }))
    : [{ id: (campaign as any).dm_id, label: 'Dungeon Master' }]

  const filtered = candidates.filter(c =>
    c.id !== myId &&
    c.label.toLowerCase().includes(search.toLowerCase())
  )

  // Separate into existing vs new
  const existing = filtered.filter(c => existingThreadIds.includes(c.id))
  const newOnes  = filtered.filter(c => !existingThreadIds.includes(c.id))

  return (
    <div className="ncm-backdrop" onClick={onClose}>
      <div className="ncm-panel" onClick={e => e.stopPropagation()}>
        <div className="ncm-header">
          <span className="ncm-title">New Conversation</span>
          <button className="ncm-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="ncm-search-wrap">
          <input
            className="ncm-search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="ncm-list">
          {filtered.length === 0 && (
            <div className="ncm-empty">No participants found.</div>
          )}

          {newOnes.length > 0 && (
            <>
              {newOnes.length < filtered.length && <div className="ncm-group-label">Start new</div>}
              {newOnes.map(c => (
                <button key={c.id} className="ncm-item" onClick={() => onSelect(c.id)}>
                  <span className="ncm-item-avatar"><User size={13} /></span>
                  <span className="ncm-item-name">{c.label}</span>
                </button>
              ))}
            </>
          )}

          {existing.length > 0 && (
            <>
              <div className="ncm-group-label">Existing</div>
              {existing.map(c => (
                <button key={c.id} className="ncm-item ncm-item--existing" onClick={() => onSelect(c.id)}>
                  <span className="ncm-item-avatar"><User size={13} /></span>
                  <span className="ncm-item-name">{c.label}</span>
                  <span className="ncm-item-badge">Open</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function buildThreads(
  messages: Message[],
  myId: string,
  role: 'dm' | 'player',
  campaign: Campaign
): Thread[] {
  const map = new Map<string, Message[]>()

  for (const msg of messages) {
    const otherId =
      msg.sender_id === myId ? msg.recipient_id : msg.sender_id
    if (!map.has(otherId)) map.set(otherId, [])
    map.get(otherId)!.push(msg)
  }

  // If DM, also seed threads for players even if no messages yet
  if (role === 'dm') {
    const playerIds: string[] = (campaign as any).player_ids ?? []
    for (const pid of playerIds) {
      if (!map.has(pid)) map.set(pid, [])
    }
  }

  return Array.from(map.entries()).map(([participantId, msgs]) => {
    const unread = msgs.filter(m => !m.read && m.sender_id !== myId).length
    const label = getLabel(participantId, role, campaign)
    return {
      participantId,
      participantLabel: label,
      messages: msgs,
      unread,
    }
  })
}

function getLabel(id: string, role: 'dm' | 'player', campaign: Campaign): string {
  // If the campaign has player name data, use it; otherwise fall back to short ID
  const players: Array<{ id: string; name: string }> = (campaign as any).players ?? []
  const found = players.find(p => p.id === id)
  if (found) return found.name
  if (id === (campaign as any).dm_id) return 'Dungeon Master'
  return `Player ${id.slice(0, 6)}`
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ── Styles ───────────────────────────────────────────────────

const css = `
  .msg-root {
    display: flex;
    height: 100%;
    min-height: 0;
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg, #0f0e13);
    color: var(--fg, #e8e3d8);
  }

  /* Sidebar */
  .msg-sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
  }

  .msg-sidebar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .msg-scroll-icon {
    color: #c9a84c;
    flex-shrink: 0;
  }

  .msg-sidebar-title {
    font-size: 13px;
    font-weight: 600;
    color: #c9a84c;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .msg-sidebar-label {
    padding: 12px 16px 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(232,227,216,0.35);
  }

  .msg-empty-sidebar {
    padding: 16px;
    font-size: 13px;
    color: rgba(232,227,216,0.35);
  }

  .msg-thread-list {
    list-style: none;
    margin: 0;
    padding: 4px 8px;
    flex: 1;
    overflow-y: auto;
  }

  .msg-thread-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--fg, #e8e3d8);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .msg-thread-item:hover {
    background: rgba(255,255,255,0.05);
  }

  .msg-thread-item--active {
    background: rgba(201,168,76,0.12);
  }

  .msg-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(201,168,76,0.15);
    border: 1px solid rgba(201,168,76,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c9a84c;
    flex-shrink: 0;
  }

  .msg-thread-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .msg-thread-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .msg-thread-preview {
    font-size: 11px;
    color: rgba(232,227,216,0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .msg-unread-badge {
    background: #c9a84c;
    color: #0f0e13;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    flex-shrink: 0;
  }

  /* Main */
  .msg-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .msg-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .msg-header-icon {
    color: #c9a84c;
  }

  .msg-header-name {
    font-size: 14px;
    font-weight: 600;
  }

  /* Feed */
  .msg-feed {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 0;
  }

  .msg-feed-empty {
    margin: auto;
    font-size: 13px;
    color: rgba(232,227,216,0.3);
  }

  .msg-date-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 16px 0 8px;
    color: rgba(232,227,216,0.3);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
  }

  .msg-date-divider::before,
  .msg-date-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.07);
  }

  .msg-bubble-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 4px;
  }

  .msg-bubble-row--mine {
    align-items: flex-end;
  }

  .msg-bubble {
    max-width: 68%;
    padding: 9px 13px;
    border-radius: 14px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
  }

  .msg-bubble--theirs {
    background: rgba(255,255,255,0.07);
    border-bottom-left-radius: 4px;
    color: #e8e3d8;
  }

  .msg-bubble--mine {
    background: rgba(201,168,76,0.2);
    border: 1px solid rgba(201,168,76,0.3);
    border-bottom-right-radius: 4px;
    color: #e8e3d8;
  }

  .msg-bubble--optimistic {
    opacity: 0.65;
  }

  .msg-timestamp {
    font-size: 10px;
    color: rgba(232,227,216,0.3);
    margin-top: 2px;
    padding: 0 3px;
  }

  /* Compose */
  .msg-compose {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  .msg-textarea {
    flex: 1;
    resize: none;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 10px 14px;
    font-family: inherit;
    font-size: 14px;
    color: #e8e3d8;
    line-height: 1.5;
    outline: none;
    transition: border-color 0.15s;
    field-sizing: content;
    max-height: 140px;
    overflow-y: auto;
  }

  .msg-textarea::placeholder {
    color: rgba(232,227,216,0.25);
  }

  .msg-textarea:focus {
    border-color: rgba(201,168,76,0.4);
  }

  .msg-send-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: #c9a84c;
    color: #0f0e13;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s, transform 0.1s;
  }

  .msg-send-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .msg-send-btn:not(:disabled):hover {
    opacity: 0.85;
    transform: scale(1.05);
  }

  /* No thread selected */
  .msg-no-thread {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: rgba(232,227,216,0.2);
    font-size: 14px;
  }

  .msg-no-thread-icon {
    color: rgba(201,168,76,0.2);
  }

  /* Scrollbar */
  .msg-feed::-webkit-scrollbar,
  .msg-thread-list::-webkit-scrollbar {
    width: 4px;
  }

  .msg-feed::-webkit-scrollbar-track,
  .msg-thread-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .msg-feed::-webkit-scrollbar-thumb,
  .msg-thread-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 99px;
  }

  /* New conversation button */
  .msg-sidebar-header {
    position: relative;
  }

  .msg-new-btn {
    margin-left: auto;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(201,168,76,0.35);
    background: rgba(201,168,76,0.1);
    color: #c9a84c;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .msg-new-btn:hover {
    background: rgba(201,168,76,0.2);
    border-color: rgba(201,168,76,0.6);
  }

  .msg-empty-new-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px dashed rgba(201,168,76,0.3);
    background: transparent;
    color: rgba(201,168,76,0.7);
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    width: 100%;
  }

  .msg-empty-new-btn:hover {
    border-color: rgba(201,168,76,0.6);
    color: #c9a84c;
  }

  /* Modal */
  .ncm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 80px;
    z-index: 100;
  }

  .ncm-panel {
    width: 320px;
    background: #1a1820;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  }

  .ncm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .ncm-title {
    font-size: 13px;
    font-weight: 600;
    color: #e8e3d8;
  }

  .ncm-close {
    background: transparent;
    border: none;
    color: rgba(232,227,216,0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .ncm-close:hover {
    color: #e8e3d8;
  }

  .ncm-search-wrap {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .ncm-search {
    width: 100%;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 8px;
    padding: 7px 11px;
    font-size: 13px;
    color: #e8e3d8;
    outline: none;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }

  .ncm-search::placeholder {
    color: rgba(232,227,216,0.25);
  }

  .ncm-search:focus {
    border-color: rgba(201,168,76,0.4);
  }

  .ncm-list {
    max-height: 260px;
    overflow-y: auto;
    padding: 6px;
  }

  .ncm-group-label {
    padding: 6px 10px 3px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(232,227,216,0.3);
  }

  .ncm-empty {
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: rgba(232,227,216,0.3);
  }

  .ncm-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #e8e3d8;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
  }

  .ncm-item:hover {
    background: rgba(201,168,76,0.1);
  }

  .ncm-item--existing {
    opacity: 0.65;
  }

  .ncm-item-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(201,168,76,0.12);
    border: 1px solid rgba(201,168,76,0.25);
    color: #c9a84c;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ncm-item-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
  }

  .ncm-item-badge {
    font-size: 10px;
    font-weight: 600;
    color: rgba(201,168,76,0.6);
    border: 1px solid rgba(201,168,76,0.25);
    border-radius: 4px;
    padding: 1px 5px;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .msg-sidebar {
      width: 64px;
    }
    .msg-sidebar-title,
    .msg-sidebar-label,
    .msg-thread-info,
    .msg-unread-badge {
      display: none;
    }
    .msg-thread-item {
      justify-content: center;
      padding: 10px;
    }
    .msg-avatar {
      width: 36px;
      height: 36px;
    }
  }
`