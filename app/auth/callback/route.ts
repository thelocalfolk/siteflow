import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/chat'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Check if profile exists — create one for new users
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, status')
        .eq('id', data.user.id)
        .single()

      if (!profile) {
        const email = data.user.email ?? ''
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: email.split('@')[0],
          phone: '',
          role: 'worker',
          status: 'pending',
          on_shift: false,
          avatar_color: randomColor(),
        })
        return NextResponse.redirect(new URL('/pending', request.url))
      }

      if (profile.status === 'pending') {
        return NextResponse.redirect(new URL('/pending', request.url))
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}
