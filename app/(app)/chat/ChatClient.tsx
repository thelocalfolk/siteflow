'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

type Reaction = { id: string; emoji: string; user_id: string }
type Sender = { id: string; full_name: string; avatar_color: string }
type RawMessage = {
  id: string
  body: string | null
  photo_url: string | null
  created_at: string
  sender: Sender | Sender[]
  reactions: Reaction[]
}
type Message = Omit<RawMessage, 'sender'> & { sender: Sender }

function normalise(raw: RawMessage): Message {
  return {
    ...raw,
    sender: Array.isArray(raw.sender) ? raw.sender[0] : raw.sender,
  }
}
type CurrentUser = { id: string; full_name: string; avatar_color: string; role: string }

const EMOJIS = ['👍', '✅', '🔥', '⚠️', '👀', '❓']

export default function ChatClient({
  initialMessages,
  currentUser,
}: {
  initialMessages: RawMessage[]
  currentUser: CurrentUser
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages.map(normalise))
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [reactionTarget, setReactionTarget] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          // Fetch full message with sender + reactions
          const { data } = await supabase
            .from('messages')
            .select(`
              id, body, photo_url, created_at,
              sender:profiles!sender_id(id, full_name, avatar_color),
              reactions(id, emoji, user_id)
            `)
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages(prev => [...prev, normalise(data as RawMessage)])
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        async () => {
          // Refresh reactions on all visible messages
          const ids = messages.map(m => m.id)
          if (!ids.length) return
          const { data } = await supabase
            .from('reactions')
            .select('id, emoji, user_id, message_id')
            .in('message_id', ids)
          if (!data) return
          setMessages(prev => prev.map(m => ({
            ...m,
            reactions: data.filter((r: any) => r.message_id === m.id),
          })))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [messages.map(m => m.id).join(',')])

  async function sendMessage() {
    if (!body.trim()) return
    setSending(true)
    const trimmed = body.trim()
    setBody('')
    const { data } = await supabase
      .from('messages')
      .insert({ sender_id: currentUser.id, body: trimmed })
      .select('id, body, photo_url, created_at')
      .single()
    if (data) {
      setMessages(prev => [...prev, {
        ...data,
        sender: { id: currentUser.id, full_name: currentUser.full_name, avatar_color: currentUser.avatar_color },
        reactions: [],
      }])
    }
    setSending(false)
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setReactionTarget(null)
    const existing = messages
      .find(m => m.id === messageId)
      ?.reactions.find(r => r.emoji === emoji && r.user_id === currentUser.id)

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('reactions').insert({
        message_id: messageId,
        user_id: currentUser.id,
        emoji,
      })
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `chat/${currentUser.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (error) { setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
    const { data } = await supabase
      .from('messages')
      .insert({ sender_id: currentUser.id, photo_url: publicUrl })
      .select('id, body, photo_url, created_at')
      .single()
    if (data) {
      setMessages(prev => [...prev, {
        ...data,
        sender: { id: currentUser.id, full_name: currentUser.full_name, avatar_color: currentUser.avatar_color },
        reactions: [],
      }])
    }
    setUploading(false)
  }

  function groupedReactions(reactions: Reaction[]) {
    const map: Record<string, { count: number; mine: boolean }> = {}
    reactions.forEach(r => {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, mine: false }
      map[r.emoji].count++
      if (r.user_id === currentUser.id) map[r.emoji].mine = true
    })
    return Object.entries(map)
  }

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <h1 className="font-semibold text-gray-900">Site Chat</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm pt-10">
            No messages yet — say something 👋
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.sender.id === currentUser.id
          const grouped = groupedReactions(msg.reactions)

          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              {!isMe && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1"
                  style={{ background: msg.sender.avatar_color }}
                >
                  {initials(msg.sender.full_name)}
                </div>
              )}

              <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {/* Sender name */}
                {!isMe && (
                  <p className="text-xs text-gray-500 px-1">{msg.sender.full_name}</p>
                )}

                {/* Bubble */}
                <div
                  className={`relative rounded-2xl px-3 py-2 text-sm cursor-pointer select-none ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-100 text-gray-900 rounded-tl-sm'
                  }`}
                  onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                >
                  {msg.photo_url && (
                    <Image
                      src={msg.photo_url}
                      alt="photo"
                      width={200}
                      height={200}
                      className="rounded-xl mb-1 max-w-full"
                    />
                  )}
                  {msg.body && <p>{msg.body}</p>}
                  <p className={`text-xs mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>

                {/* Reaction picker */}
                {reactionTarget === msg.id && (
                  <div className="flex gap-1 bg-white border border-gray-200 rounded-full px-2 py-1 shadow-lg">
                    {EMOJIS.map(e => (
                      <button
                        key={e}
                        onClick={() => toggleReaction(msg.id, e)}
                        className="text-lg hover:scale-125 transition-transform"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reaction counts */}
                {grouped.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {grouped.map(([emoji, { count, mine }]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className={`flex items-center gap-0.5 text-xs rounded-full px-2 py-0.5 border ${
                          mine
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        {emoji} {count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 bg-white px-3 py-2 flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-gray-400 hover:text-gray-600 text-xl shrink-0 disabled:opacity-40"
          title="Send photo"
        >
          {uploading ? '⏳' : '📷'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }}
        />
        <input
          type="text"
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Message…"
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !body.trim()}
          className="bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center shrink-0 disabled:opacity-40"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
