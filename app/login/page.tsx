'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = 'email' | 'otp'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function sendOtp() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep('otp')
  }

  async function verifyOtp() {
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    if (error) { setError(error.message); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, status')
      .eq('id', data.user!.id)
      .single()

    if (!profile) {
      await supabase.from('profiles').insert({
        id: data.user!.id,
        full_name: name.trim() || email.split('@')[0],
        phone: '',
        role: 'worker',
        status: 'pending',
        on_shift: false,
        avatar_color: randomColor(),
      })
      window.location.href = '/pending'
    } else if (profile.status === 'pending') {
      window.location.href = '/pending'
    } else {
      window.location.href = '/chat'
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="text-4xl mb-3">🏗️</div>
          <h1 className="text-2xl font-bold text-gray-900">SiteFlow</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in with your email</p>
        </div>

        {step === 'email' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && sendOtp()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name <span className="text-gray-400">(new users)</span></label>
              <input
                type="text"
                placeholder="e.g. Jake Smith"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={sendOtp}
              disabled={loading || !email}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <input
              type="number"
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && verifyOtp()}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={verifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              onClick={() => { setStep('email'); setOtp(''); setError('') }}
              className="w-full text-gray-500 text-sm"
            >
              ← Change email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}
