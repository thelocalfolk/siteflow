import { createClient } from '@/lib/supabase/server'

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let name = 'there'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    if (profile?.full_name) name = profile.full_name.split(' ')[0]
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-5xl">⏳</div>
        <h1 className="text-2xl font-bold text-gray-900">Waiting for approval, {name}</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your request to join has been sent. A manager will approve you shortly — you'll be able to access the app as soon as they do.
        </p>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900 mb-1">What happens next?</p>
          <ol className="text-left space-y-1 list-decimal list-inside">
            <li>A manager reviews your sign-up</li>
            <li>They approve you in the app</li>
            <li>You'll get access instantly</li>
          </ol>
        </div>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="text-sm text-gray-400 underline">Sign out</button>
        </form>
      </div>
    </div>
  )
}
