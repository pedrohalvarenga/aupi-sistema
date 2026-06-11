'use client'

import Image from 'next/image'
import Link from 'next/link'
import { LogOut, Bell, PawPrint } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/components/EmpresaProvider'

interface TopBarProps {
  titulo?: string
  nome?: string
}

export default function TopBar({ titulo, nome }: TopBarProps) {
  const router = useRouter()
  const empresa = useEmpresa()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-50 safe-top">
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        <Link href="/dashboard" className="flex items-center gap-3">
          {empresa?.logo_url ? (
            <Image src={empresa.logo_url} alt={empresa.nome} width={36} height={36} className="rounded-xl object-cover" />
          ) : (
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'var(--brand-purple)' }}
            >
              <PawPrint size={20} />
            </span>
          )}
          <div>
            <p className="font-bold text-sm text-gray-900 leading-tight">{titulo || empresa?.nome || 'Painel'}</p>
            {nome && <p className="text-xs text-gray-400">{nome}</p>}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50">
            <Bell size={20} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  )
}
