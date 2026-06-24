'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = { role: string }

const workerTabs = [
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/dashboard', label: 'Tasks', icon: '📋' },
]

const managerTabs = [
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/dashboard', label: 'Tasks', icon: '📋' },
  { href: '/approvals', label: 'Team', icon: '👷' },
]

export default function BottomNav({ role }: Props) {
  const pathname = usePathname()
  const tabs = role === 'manager' ? managerTabs : workerTabs

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex"
      style={{ height: 'calc(var(--nav-height) + var(--safe-bottom))', paddingBottom: 'var(--safe-bottom)' }}
    >
      {tabs.map(tab => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
              active ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
