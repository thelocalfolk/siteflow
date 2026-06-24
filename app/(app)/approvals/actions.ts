'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function getManagerOrThrow() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'manager') redirect('/chat')
  return supabase
}

export async function approveWorker(workerId: string) {
  const supabase = await getManagerOrThrow()
  await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', workerId)
  revalidatePath('/approvals')
}

export async function rejectWorker(workerId: string) {
  const supabase = await getManagerOrThrow()
  // Delete their auth user entirely so they can re-register cleanly
  await supabase.from('profiles').delete().eq('id', workerId)
  revalidatePath('/approvals')
}

export async function removeWorker(workerId: string) {
  const supabase = await getManagerOrThrow()
  await supabase
    .from('profiles')
    .update({ status: 'removed', on_shift: false })
    .eq('id', workerId)
  revalidatePath('/approvals')
}

export async function reinstateWorker(workerId: string) {
  const supabase = await getManagerOrThrow()
  await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', workerId)
  revalidatePath('/approvals')
}
