'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, LogOut } from 'lucide-react'

export default function BannerImpersonacao({ nome }: { nome: string }) {
  const router = useRouter()
  const [saindo, setSaindo] = useState(false)

  async function sair() {
    if (saindo) return
    setSaindo(true)
    try {
      await fetch('/api/superadmin/impersonar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: null }),
      })
      router.push('/superadmin')
      router.refresh()
    } finally {
      setSaindo(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white">
      <div className="max-w-lg mx-auto px-4 h-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Eye size={15} className="flex-shrink-0" />
          <span className="text-xs font-semibold truncate">
            Modo suporte · vendo <b>{nome}</b>
          </span>
        </div>
        <button
          onClick={sair}
          disabled={saindo}
          className="flex items-center gap-1 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1 flex-shrink-0 disabled:opacity-60"
        >
          <LogOut size={13} />
          {saindo ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </div>
  )
}
