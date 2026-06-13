'use client'

import { useState } from 'react'
import { PLANOS } from '@/lib/planos'
import Button from '@/components/ui/Button'

function reais(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0 })
}

export default function AssinarPage() {
  const [carregando, setCarregando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  async function assinar(plano: string) {
    setCarregando(plano); setErro('')
    try {
      const res = await fetch('/api/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) { setErro(json.error || 'Não foi possível gerar o pagamento.'); return }
      window.location.href = json.url // redireciona para o checkout InfinitePay
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setCarregando(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FBF5EC] to-white px-6 py-10">
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Escolha seu plano</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Pague com PIX (na hora) ou cartão em até 12x.</p>

        <div className="flex flex-col gap-3">
          {PLANOS.map((p) => {
            const preco = p.precoCentavos
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border p-5 ${p.destaque ? 'border-2' : 'border-gray-100'}`}
                style={p.destaque ? { borderColor: 'var(--brand-purple)' } : undefined}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <p className="font-bold text-lg text-gray-900">{p.nome}</p>
                  <p className="font-bold text-xl" style={{ color: 'var(--brand-purple)' }}>
                    R$ {reais(preco)}<span className="text-sm text-gray-400 font-normal">/mês</span>
                  </p>
                </div>
                <p className="text-sm text-gray-500 mb-4">{p.descricao}</p>
                <Button onClick={() => assinar(p.id)} disabled={carregando !== null} className="w-full">
                  {carregando === p.id ? 'Gerando pagamento...' : 'Assinar'}
                </Button>
              </div>
            )
          })}
        </div>

        {erro && <p className="text-sm text-red-500 text-center mt-4">{erro}</p>}
        <p className="text-xs text-gray-400 text-center mt-6">Pagamento processado com segurança pela InfinitePay.</p>
      </div>
    </div>
  )
}
