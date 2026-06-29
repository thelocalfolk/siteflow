import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_ORDER = ['unassigned', 'assigned', 'in_progress', 'blocked', 'done'] as const
const STATUS_LABEL: Record<string, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}
const STATUS_COLOR: Record<string, string> = {
  unassigned: 'bg-gray-100 text-gray-600',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  blocked: 'bg-red-100 text-red-700',
  done: 'bg-green-100 text-green-700',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  const { status: filterStatus } = await searchParams

  let query = supabase
    .from('tasks')
    .select(`
      id, title, location, priority, status, accepted, due_at, created_at,
      assignee:profiles!assignee_id(id, full_name, avatar_color),
      photos:task_photos(url, kind)
    `)
    .order('created_at', { ascending: false })

  if (filterStatus) query = query.eq('status', filterStatus)

  const { data: tasks } = await query

  // Stats
  const allTasks = tasks ?? []
  const stats = {
    unassigned: allTasks.filter(t => t.status === 'unassigned').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
    done: allTasks.filter(t => t.status === 'done').length,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
        <h1 className="font-semibold text-gray-900">Tasks</h1>
        {profile?.role === 'manager' && (
          <Link
            href="/tasks/new"
            className="bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-xl"
          >
            + New task
          </Link>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 bg-white border-b border-gray-100">
        {[
          { key: 'unassigned', label: 'Unassigned', color: 'text-gray-600' },
          { key: 'in_progress', label: 'In progress', color: 'text-yellow-600' },
          { key: 'done', label: 'Done', color: 'text-green-600' },
        ].map(s => (
          <Link
            key={s.key}
            href={filterStatus === s.key ? '/dashboard' : `/dashboard?status=${s.key}`}
            className={`rounded-xl p-3 text-center border ${filterStatus === s.key ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}
          >
            <p className={`text-2xl font-bold ${s.color}`}>{stats[s.key as keyof typeof stats]}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-white border-b border-gray-100">
        <Link
          href="/dashboard"
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${!filterStatus ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          All
        </Link>
        {STATUS_ORDER.map(s => (
          <Link
            key={s}
            href={filterStatus === s ? '/dashboard' : `/dashboard?status=${s}`}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${filterStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {allTasks.length === 0 && (
          <div className="text-center text-gray-400 text-sm pt-10">
            {filterStatus ? `No ${STATUS_LABEL[filterStatus]?.toLowerCase()} tasks` : 'No tasks yet'}
          </div>
        )}

        {allTasks.map(task => {
          const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee
          const photo = (task.photos as any[])?.[0]

          return (
            <Link key={task.id} href={`/tasks/${task.id}`}>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 active:bg-gray-50">
                {/* Photo thumb */}
                {photo && (
                  <img
                    src={photo.url}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900 leading-snug">{task.title}</p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>

                  {task.location && (
                    <p className="text-xs text-gray-500 mt-0.5">📍 {task.location}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[task.status]}`}>
                      {STATUS_LABEL[task.status]}
                    </span>
                    {assignee && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: assignee.avatar_color, fontSize: 8 }}
                        >
                          {assignee.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-500">{assignee.full_name}</span>
                      </div>
                    )}
                    {task.due_at && (
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(task.due_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
