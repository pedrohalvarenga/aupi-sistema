'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'

interface EmpresaMetrica {
  id: string
  nome: string
  slug: string
  segmento: string
  plano: string
  status: string
  trial_ate: string
  created_at: string
  total_pets: number
  total_tutores: number
  total_usuarios: number
}

const STATUS_CORES: Record<string, string> = {
  trial: 'bg-blue-50 text-blue-700',
  ativo: 'bg-green-50 text-green-700',
  inadimplente: 'bg-amber-50 text-amber-700',
  suspenso: 'bg-red-50 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [empresas, setEmpresas] = useState<EmpresaMetrica[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState('')

  async function carregar() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('vw_empresas_metricas')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setErro(error.message)
    setEmpresas(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function executar(empresaId: string, acao: string) {
    const res = await fetch('/api/superadmin/empresas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId, acao }),
    })
    if (res.ok) carregar()
    else {
      const j = await res.json()
      setErro(j.error || 'Erro ao executar ação')
    }
  }

  async function entrarNoSistema(empresaId: string) {
    if (entrando) return
    setEntrando(empresaId); setErro('')
    try {
      const res = await fetch('/api/superadmin/impersonar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId }),
      })
      if (!res.ok) {
        const j = await res.json()
        setErro(j.error || 'Não foi possível entrar no sistema do cliente')
        setEntrando('')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setErro('Falha de conexão')
      setEntrando('')
    }
  }

  const ativos = empresas.filter((e) => e.status === 'ativo').length
  const trials = empresas.filter((e) => e.status === 'trial').length

  if (loading) return <p className="text-gray-400 text-sm py-10 text-center">Carregando...</p>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">Aupipet — Clientes</h1>

      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-2xl font-bold text-gray-900">{empresas.length}</p><p className="text-xs text-gray-500">Empresas</p></Card>
        <Card><p className="text-2xl font-bold text-green-600">{ativos}</p><p className="text-xs text-gray-500">Pagantes</p></Card>
        <Card><p className="text-2xl font-bold text-blue-600">{trials}</p><p className="text-xs text-gray-500">Em trial</p></Card>
      </div>

      {erro && <p className="text-sm text-red-500">{erro}</p>}

      {empresas.map((e) => (
        <Card key={e.id}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-bold text-gray-900">{e.nome}</p>
              <p className="text-xs text-gray-400">{e.slug} · {e.segmento} · plano {e.plano}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${STATUS_CORES[e.status] ?? ''}`}>
              {e.status}{e.status === 'trial' ? ` até ${new Date(e.trial_ate + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {e.total_pets} pets · {e.total_tutores} tutores · {e.total_usuarios} usuários
          </p>
          <button
            onClick={() => entrarNoSistema(e.id)}
            disabled={!!entrando}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl bg-brand-purple text-white mb-2 disabled:opacity-60"
          >
            <LogIn size={16} />
            {entrando === e.id ? 'Entrando...' : 'Entrar no sistema'}
          </button>
          <div className="flex gap-2 flex-wrap">
            {e.status !== 'suspenso' && e.status !== 'cancelado' && (
              <button onClick={() => executar(e.id, 'suspender')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600">
                Suspender
              </button>
            )}
            {(e.status === 'suspenso' || e.status === 'inadimplente' || e.status === 'cancelado') && (
              <button onClick={() => executar(e.id, 'reativar')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700">
                Reativar
              </button>
            )}
            <button onClick={() => executar(e.id, 'estender_trial')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700">
              +14 dias de trial
            </button>
            {e.status !== 'cancelado' && (
              <button onClick={() => executar(e.id, 'cancelar')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500">
                Cancelar
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
