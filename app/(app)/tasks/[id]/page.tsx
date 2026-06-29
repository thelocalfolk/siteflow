import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import TaskDetailClient from './TaskDetailClient'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  const { data: task } = await supabase
    .from('tasks')
    .select(`
      id, title, description, location, priority, status, accepted, due_at, created_at,
      assignee:profiles!assignee_id(id, full_name, avatar_color),
      creator:profiles!created_by(id, full_name),
      photos:task_photos(id, url, kind, created_at),
      activity:task_activity(id, type, body, created_at, author:profiles!author_id(id, full_name, avatar_color))
    `)
    .eq('id', id)
    .single()

  if (!task) notFound()

  return (
    <TaskDetailClient
      task={task as any}
      currentUser={{ id: profile!.id, role: profile!.role, full_name: profile!.full_name }}
    />
  )
}
