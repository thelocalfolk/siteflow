'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Worker = { id: string; full_name: string; avatar_color: string; open_tasks: number }

export default function NewTaskClient({
  workers,
  suggestedId,
  currentUserId,
  prefill,
}: {
  workers: Worker[]
  suggestedId: string | null
  currentUserId: string
  prefill: { title: string; location: string; due: string; source_message_id: string | null }
}) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(prefill.title)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState(prefill.location)
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>('medium')
  const [assigneeId, setAssigneeId] = useState<string>(suggestedId ?? '')
  const [due, setDue] = useState(prefill.due)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        priority,
        status: assigneeId ? 'assigned' : 'unassigned',
        assignee_id: assigneeId || null,
        accepted: false,
        due_at: due || null,
        source_message_id: prefill.source_message_id,
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (error) { setSaving(false); return }

    // Write system activity row
    if (assigneeId) {
      await supabase.from('task_activity').insert({
        task_id: data.id,
        type: 'system',
        body: `Task assigned to ${workers.find(w => w.id === assigneeId)?.full_name ?? 'worker'}`,
      })
      // Notify assignee
      await supabase.from('notifications').insert({
        user_id: assigneeId,
        type: 'assigned',
        body: `You've been assigned: ${title.trim()}`,
        task_id: data.id,
      })
    }

    router.push(`/tasks/${data.id}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 text-sm">← Back</button>
        <h1 className="font-semibold text-gray-900 flex-1">New task</h1>
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-xl disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {prefill.source_message_id && (
          <div className="bg-blue-50 text-blue-700 text-xs rounded-xl px-3 py-2">
            Created from chat message
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="More detail…"
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Level 2, North wall"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
          <div className="flex gap-2">
            {(['low', 'medium', 'urgent'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border capitalize ${
                  priority === p
                    ? p === 'urgent' ? 'bg-red-500 text-white border-red-500'
                      : p === 'medium' ? 'bg-orange-400 text-white border-orange-400'
                      : 'bg-gray-400 text-white border-gray-400'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
          <input
            type="datetime-local"
            value={due}
            onChange={e => setDue(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assign to
            {suggestedId && (
              <span className="ml-2 text-xs text-blue-600 font-normal">
                ✨ Suggested: {workers.find(w => w.id === suggestedId)?.full_name} (lightest load)
              </span>
            )}
          </label>
          <div className="space-y-2">
            <button
              onClick={() => setAssigneeId('')}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${
                !assigneeId ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-sm text-gray-500">Unassigned</span>
            </button>
            {workers.map(w => (
              <button
                key={w.id}
                onClick={() => setAssigneeId(w.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${
                  assigneeId === w.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: w.avatar_color }}
                >
                  {w.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">{w.full_name}</span>
                <span className="text-xs text-gray-400">{w.open_tasks} open</span>
                {w.id === suggestedId && (
                  <span className="text-xs text-blue-600">✨</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
