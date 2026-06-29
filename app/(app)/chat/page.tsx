import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatClient from './ChatClient'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_color')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Load last 50 messages with sender profile + reactions
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      id, body, photo_url, created_at,
      sender:profiles!sender_id(id, full_name, avatar_color),
      reactions(id, emoji, user_id)
    `)
    .order('created_at', { ascending: true })
    .limit(50)

  return (
    <ChatClient
      initialMessages={messages ?? []}
      currentUser={{ id: profile.id, full_name: profile.full_name, avatar_color: profile.avatar_color, role: profile.role }}
    />
  )
}
