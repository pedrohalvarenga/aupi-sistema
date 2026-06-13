'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'

/**
 * Página de retorno após o checkout da InfinitePay. O webhook ativa a conta
 * em segundos; aqui aguardamos a confirmação e mandamos o usuário ao painel.
 */
export default function SucessoPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'aguardando' | 'ativo'>('aguardando')

  useEffect(() => {
    let tentativas = 0
    const intervalo = setInterval(async () => {
      tentativas++
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).single()
      if (!profile?.empresa_id) return
      const { data: empresa } = await supabase.from('empresas').select('status').eq('id', profile.empresa_id).single()
      if (empresa?.status === 'ativo') {
        setStatus('ativo')
        clearInterval(intervalo)
        setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1500)
      }
      if (tentativas > 20) clearInterval(intervalo) // ~1 min
    }, 3000)
    return () => clearInterval(intervalo)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FBF5EC] to-white px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--brand-purple, #2F9E6E)' }}>
          <span className="text-4xl text-white">{status === 'ativo' ? '✓' : '⏳'}</span>
        </div>
        {status === 'ativo' ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Assinatura ativa!</h1>
            <p className="text-gray-500 text-sm">Tudo certo. Estamos te levando para o sistema...</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Confirmando seu pagamento...</h1>
            <p className="text-gray-500 text-sm mb-4">Assim que a InfinitePay confirmar, sua conta é liberada automaticamente. Isso leva alguns segundos.</p>
            <Button onClick={() => { router.push('/dashboard'); router.refresh() }} variant="ghost">Ir para o sistema</Button>
          </>
        )}
      </div>
    </div>
  )
}
