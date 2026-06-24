'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = 'email' | 'sent'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function sendLink() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: name.trim() || email.split('@')[0] },
      },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep('sent')
  }

  if (step === 'sent') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-4xl">📬</div>
          <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
          <p className="text-sm text-gray-500">
            We sent a sign-in link to <strong>{email}</strong>. Click it to get in.
          </p>
          <p className="text-xs text-gray-400">Check your spam folder if it doesn't arrive in a minute.</p>
          <button
            onClick={() => { setStep('email'); setError('') }}
            className="text-sm text-blue-600"
          >
            ← Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="text-4xl mb-3">🏗️</div>
          <h1 className="text-2xl font-bold text-gray-900">SiteFlow</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in with your email</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && sendLink()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your name <span className="text-gray-400">(new users)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Jake Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && sendLink()}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={sendLink}
            disabled={loading || !email}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send sign-in link'}
          </button>
        </div>
      </div>
    </div>
  )
}
