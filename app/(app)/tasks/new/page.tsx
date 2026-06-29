import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewTaskClient from './NewTaskClient'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ message_id?: string; title?: string; location?: string; due?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Fetch active workers for assignment suggestion
  const { data: workers } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_color')
    .eq('status', 'active')
    .eq('role', 'worker')
    .order('full_name')

  // Count open tasks per worker for workload suggestion
  const { data: openTasks } = await supabase
    .from('tasks')
    .select('assignee_id')
    .in('status', ['assigned', 'in_progress'])
    .not('assignee_id', 'is', null)

  const taskCounts: Record<string, number> = {}
  openTasks?.forEach(t => {
    if (t.assignee_id) taskCounts[t.assignee_id] = (taskCounts[t.assignee_id] || 0) + 1
  })

  const workersWithLoad = (workers ?? []).map(w => ({
    ...w,
    open_tasks: taskCounts[w.id] || 0,
  }))

  // Suggested = fewest open tasks
  const suggested = workersWithLoad.length
    ? workersWithLoad.reduce((a, b) => a.open_tasks <= b.open_tasks ? a : b)
    : null

  const params = await searchParams

  return (
    <NewTaskClient
      workers={workersWithLoad}
      suggestedId={suggested?.id ?? null}
      currentUserId={user.id}
      prefill={{
        title: params.title ?? '',
        location: params.location ?? '',
        due: params.due ?? '',
        source_message_id: params.message_id ?? null,
      }}
    />
  )
}
