'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Check } from 'lucide-react'

interface Props {
  temPet: boolean
  temCheckin: boolean
  temReceita: boolean
}

// Checklist de ativação persistente: fica no topo do dashboard até a empresa
// completar os 3 passos que provam valor (1º pet → 1ª chamada → 1º pagamento).
// Some sozinho quando ativado === true (não renderizado pelo pai).
export default function PrimeirosPassos({ temPet, temCheckin, temReceita }: Props) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)
  const [msg, setMsg] = useState('')

  async function carregarExemplo() {
    setCarregando(true); setMsg('')
    try {
      const res = await fetch('/api/onboarding/dados-exemplo', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(json.error || 'Não foi possível carregar.'); return }
      router.refresh()
    } catch {
      setMsg('Falha de conexão. Tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  const passos = [
    { done: temPet, href: '/pets/novo', titulo: 'Cadastre seu primeiro pet', sub: 'O tutor entra no mesmo cadastro — e a IA lê o cartão de vacina' },
    { done: temCheckin, href: '/creche', titulo: 'Faça a primeira chamada', sub: 'Check-in dos pets presentes hoje' },
    { done: temReceita, href: '/financeiro', titulo: 'Registre o primeiro pagamento', sub: 'Comece a controlar o caixa do negócio' },
  ]
  const feitos = passos.filter(p => p.done).length
  // O primeiro passo ainda não feito é o "próximo" — fica em destaque.
  const idxProximo = passos.findIndex(p => !p.done)

  return (
    <div className="rounded-3xl bg-brand-purple p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-base">Primeiros passos</p>
          <p className="text-white/70 text-sm">Faça o sistema funcionar hoje — {feitos} de 3 prontos.</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">{feitos}/3</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {passos.map((p, i) => {
          if (p.done) {
            return (
              <div key={p.href} className="flex items-center gap-3 bg-white/10 rounded-2xl p-3">
                <div className="w-8 h-8 rounded-xl bg-brand-green flex items-center justify-center shrink-0">
                  <Check size={16} className="text-white" />
                </div>
                <p className="text-sm font-semibold text-white/80 line-through">{p.titulo}</p>
              </div>
            )
          }
          const destaque = i === idxProximo
          return (
            <Link
              key={p.href}
              href={p.href}
              className={`flex items-center gap-3 rounded-2xl p-3 active:opacity-90 ${destaque ? 'bg-white' : 'bg-white/15'}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${destaque ? 'bg-brand-purple' : 'bg-white/25'}`}>
                <span className="text-white text-xs font-bold">{i + 1}</span>
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${destaque ? 'text-gray-900' : 'text-white'}`}>{p.titulo}</p>
                <p className={`text-xs ${destaque ? 'text-gray-500' : 'text-white/70'}`}>{p.sub}</p>
              </div>
              <ChevronRight size={16} className={destaque ? 'text-gray-400 shrink-0' : 'text-white/60 shrink-0'} />
            </Link>
          )
        })}
      </div>

      {/* Só oferece dados de exemplo enquanto a empresa está totalmente vazia */}
      {feitos === 0 && (
        <button
          onClick={carregarExemplo}
          disabled={carregando}
          className="self-start text-xs font-semibold text-white/80 underline underline-offset-2 disabled:opacity-50"
        >
          {carregando ? 'Carregando...' : 'Ou veja com dados de exemplo primeiro'}
        </button>
      )}
      {msg && <p className="text-xs text-white/80">{msg}</p>}
    </div>
  )
}
