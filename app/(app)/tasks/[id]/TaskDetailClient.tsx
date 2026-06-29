'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const STATUS_LABEL: Record<string, string> = {
  unassigned: 'Unassigned', assigned: 'Assigned',
  in_progress: 'In Progress', blocked: 'Blocked', done: 'Done',
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
const STATUSES = ['unassigned', 'assigned', 'in_progress', 'blocked', 'done']

type Photo = { id: string; url: string; kind: string; created_at: string }
type ActivityItem = {
  id: string; type: string; body: string; created_at: string
  author: { id: string; full_name: string; avatar_color: string } | null
}
type Task = {
  id: string; title: string; description: string | null; location: string | null
  priority: string; status: string; accepted: boolean; due_at: string | null
  created_at: string
  assignee: { id: string; full_name: string; avatar_color: string } | null
  creator: { id: string; full_name: string } | null
  photos: Photo[]
  activity: ActivityItem[]
}
type CurrentUser = { id: string; role: string; full_name: string }

export default function TaskDetailClient({ task: initialTask, currentUser }: { task: Task; currentUser: CurrentUser }) {
  const router = useRouter()
  const supabase = createClient()
  const [task, setTask] = useState(initialTask)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const isAssignee = task.assignee?.id === currentUser.id
  const isManager = currentUser.role === 'manager'
  const canUpdateStatus = isAssignee || isManager

  async function updateStatus(status: string) {
    setSaving(true)
    await supabase.from('tasks').update({ status }).eq('id', task.id)
    await supabase.from('task_activity').insert({
      task_id: task.id,
      author_id: currentUser.id,
      type: 'system',
      body: `Status changed to ${STATUS_LABEL[status]}`,
    })
    setTask(prev => ({ ...prev, status }))
    setSaving(false)
  }

  async function acceptTask() {
    setSaving(true)
    await supabase.from('tasks').update({ accepted: true, status: 'in_progress' }).eq('id', task.id)
    await supabase.from('task_activity').insert({
      task_id: task.id,
      author_id: currentUser.id,
      type: 'system',
      body: `${currentUser.full_name} accepted the task`,
    })
    setTask(prev => ({ ...prev, accepted: true, status: 'in_progress' }))
    setSaving(false)
  }

  async function declineTask() {
    setSaving(true)
    await supabase.from('tasks').update({
      accepted: false, status: 'unassigned', assignee_id: null,
    }).eq('id', task.id)
    await supabase.from('task_activity').insert({
      task_id: task.id,
      type: 'system',
      body: `${currentUser.full_name} declined — returned to unassigned`,
    })
    router.push('/dashboard')
  }

  async function addComment() {
    if (!comment.trim()) return
    const { data } = await supabase
      .from('task_activity')
      .insert({
        task_id: task.id,
        author_id: currentUser.id,
        type: 'comment',
        body: comment.trim(),
      })
      .select('id, type, body, created_at')
      .single()
    if (data) {
      setTask(prev => ({
        ...prev,
        activity: [...prev.activity, {
          ...data,
          author: { id: currentUser.id, full_name: currentUser.full_name, avatar_color: '#3B82F6' },
        }],
      }))
    }
    setComment('')
  }

  async function uploadPhoto(file: File, kind: 'before' | 'after' | 'issue') {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `tasks/${task.id}/${kind}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (error) { setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
    const { data } = await supabase
      .from('task_photos')
      .insert({ task_id: task.id, url: publicUrl, kind, uploaded_by: currentUser.id })
      .select('id, url, kind, created_at')
      .single()
    if (data) setTask(prev => ({ ...prev, photos: [...prev.photos, data] }))
    setUploading(false)
  }

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 text-sm">← Back</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 truncate">{task.title}</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Accept / Decline (for assignee who hasn't accepted yet) */}
        {isAssignee && !task.accepted && task.status === 'assigned' && (
          <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-blue-900 mb-3">You've been assigned this task</p>
            <div className="flex gap-2">
              <button
                onClick={acceptTask}
                disabled={saving}
                className="flex-1 bg-green-500 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={declineTask}
                disabled={saving}
                className="flex-1 bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="px-4 py-4 space-y-3">
          {task.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            {task.location && <span>📍 {task.location}</span>}
            {task.due_at && (
              <span>🗓 Due {new Date(task.due_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            )}
          </div>

          {task.assignee && (
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: task.assignee.avatar_color }}
              >
                {initials(task.assignee.full_name)}
              </div>
              <span className="text-sm text-gray-600">{task.assignee.full_name}</span>
              {task.accepted && <span className="text-xs text-green-600">✓ Accepted</span>}
            </div>
          )}
        </div>

        {/* Status controls */}
        {canUpdateStatus && (
          <div className="px-4 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Update status</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUSES.filter(s => s !== task.status).map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={saving}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${STATUS_COLOR[s]} disabled:opacity-50`}
                >
                  → {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photos</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {task.photos.map(photo => (
              <div key={photo.id} className="relative shrink-0">
                <Image
                  src={photo.url}
                  alt={photo.kind}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-xl object-cover"
                />
                <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {photo.kind}
                </span>
              </div>
            ))}
            {(['before', 'after', 'issue'] as const).map(kind => (
              <label key={kind} className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-blue-300">
                <span className="text-xl">+</span>
                <span className="text-xs mt-1">{kind}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, kind) }}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Activity</p>
          <div className="space-y-3">
            {task.activity.map(item => (
              <div key={item.id} className="flex gap-2">
                {item.author ? (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5"
                    style={{ background: item.author.avatar_color, fontSize: 9, fontWeight: 700 }}
                  >
                    {initials(item.author.full_name)}
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5 text-xs">⚙</div>
                )}
                <div className="flex-1 min-w-0">
                  {item.type === 'comment' ? (
                    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-900">
                      {item.body}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 pt-1">{item.body}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(item.created_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Comment input */}
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addComment()}
              placeholder="Add a comment…"
              className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addComment}
              disabled={!comment.trim()}
              className="bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
