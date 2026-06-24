import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  return (
    <div className="flex flex-col h-full items-center justify-center text-center px-6 text-gray-400">
      <div className="text-4xl mb-3">👷</div>
      <p className="font-medium text-gray-600">Team & Approvals coming in Phase 3</p>
      <p className="text-sm mt-1">Approve sign-ups, manage crew, view workloads</p>
    </div>
  )
}
