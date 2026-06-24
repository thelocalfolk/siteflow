import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'active') redirect('/pending')

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}>
        {children}
      </main>
      <BottomNav role={profile.role} />
    </div>
  )
}
