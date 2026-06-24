'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// One-time setup route to promote a signed-in user to manager.
// Delete or protect this route after first use.

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function makeManager() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) { setMessage('Not signed in — go to /login first.'); setLoading(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ role: 'manager', status: 'active' })
      .eq('id', user.id)

    if (error) { setMessage(`Error: ${error.message}`); setLoading(false); return }
    setMessage('Done! You are now a manager. Go to /approvals.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-4xl">🔑</div>
        <h1 className="text-xl font-bold text-gray-900">First-time setup</h1>
        <p className="text-sm text-gray-500">
          This promotes your signed-in account to manager. Use once, then delete this route.
        </p>
        <button
          onClick={makeManager}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Make me a manager'}
        </button>
        {message && <p className="text-sm font-medium text-gray-700">{message}</p>}
      </div>
    </div>
  )
}
