import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { approveWorker, rejectWorker, removeWorker } from './actions'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager') redirect('/chat')

  // Fetch pending sign-ups
  const { data: pending } = await supabase
    .from('profiles')
    .select('id, full_name, phone, trade_tags, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // Fetch active crew with open task counts
  const { data: crew } = await supabase
    .from('profiles')
    .select('id, full_name, phone, trade_tags, on_shift, avatar_color, role')
    .eq('status', 'active')
    .order('full_name', { ascending: true })

  // Count open tasks per worker
  const { data: openTasks } = await supabase
    .from('tasks')
    .select('assignee_id')
    .in('status', ['assigned', 'in_progress'])
    .not('assignee_id', 'is', null)

  const taskCounts: Record<string, number> = {}
  openTasks?.forEach(t => {
    if (t.assignee_id) taskCounts[t.assignee_id] = (taskCounts[t.assignee_id] || 0) + 1
  })

  const maxTasks = Math.max(...Object.values(taskCounts), 1)

  return (
    <div className="px-4 py-6 space-y-8 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Team</h1>

      {/* Pending approvals */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Pending approval {pending && pending.length > 0 && (
            <span className="ml-2 bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 text-xs">{pending.length}</span>
          )}
        </h2>

        {!pending?.length ? (
          <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 p-4">No pending sign-ups</p>
        ) : (
          <div className="space-y-3">
            {pending.map(worker => (
              <div key={worker.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{worker.full_name}</p>
                    <p className="text-sm text-gray-500">{worker.phone}</p>
                    {worker.trade_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {worker.trade_tags.map((tag: string) => (
                          <span key={tag} className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <form action={approveWorker.bind(null, worker.id)}>
                      <button type="submit" className="bg-green-500 text-white text-sm font-medium px-3 py-1.5 rounded-xl">
                        Approve
                      </button>
                    </form>
                    <form action={rejectWorker.bind(null, worker.id)}>
                      <button type="submit" className="bg-red-100 text-red-600 text-sm font-medium px-3 py-1.5 rounded-xl">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active crew */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Active crew <span className="ml-2 text-gray-400 normal-case font-normal">({crew?.length || 0})</span>
        </h2>

        {!crew?.length ? (
          <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 p-4">No active crew yet</p>
        ) : (
          <div className="space-y-3">
            {crew.map(worker => {
              const count = taskCounts[worker.id] || 0
              const barWidth = maxTasks > 0 ? Math.round((count / maxTasks) * 100) : 0
              const isMe = worker.id === user.id

              return (
                <div key={worker.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: worker.avatar_color }}
                    >
                      {worker.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{worker.full_name}</p>
                        {worker.role === 'manager' && (
                          <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 shrink-0">Manager</span>
                        )}
                        {worker.on_shift && (
                          <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 shrink-0">On site</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{worker.phone}</p>
                      {/* Workload bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">{count} task{count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    {!isMe && worker.role !== 'manager' && (
                      <form action={removeWorker.bind(null, worker.id)}>
                        <button
                          type="submit"
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
                          onClick={e => {
                            if (!confirm(`Remove ${worker.full_name} from the crew?`)) e.preventDefault()
                          }}
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Sign-up link hint */}
      <section className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Share with your crew</p>
        <p className="text-blue-600 text-xs">Workers sign up via the app login page. Their request will appear here for you to approve.</p>
      </section>
    </div>
  )
}
