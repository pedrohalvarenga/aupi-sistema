'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Phone, Mail, MapPin, Calendar, Clock, Users, Dog, Activity, ChevronDown, ChevronUp } from 'lucide-react'
import Card from '@/components/ui/Card'

interface Cliente {
  id: string
  nome: string
  slug: string
  segmento: string
  plano: string
  status: string
  trial_ate: string
  telefone: string | null
  whatsapp: string | null
  email_contato: string | null
  cidade: string | null
  logo_url: string | null
  created_at: string
  owner_nome: string | null
  owner_email: string | null
  ultimo_login: string | null
  nunca_voltou: boolean
  dias_desde_cadastro: number
  dias_desde_login: number | null
  total_tutores: number
  total_pets: number
  total_presencas: number
  total_hospedagens: number
  total_banhos: number
  total_receitas: number
  total_atividade: number
  health: 'inativo' | 'risco' | 'ativo'
}

const STATUS_COR: Record<string, string> = {
  trial: 'bg-blue-50 text-blue-700',
  ativo: 'bg-green-50 text-green-700',
  inadimplente: 'bg-amber-50 text-amber-700',
  suspenso: 'bg-red-50 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
}

const HEALTH_CONFIG = {
  inativo: { cor: 'bg-red-100 text-red-700', label: 'Nunca ativou', dot: 'bg-red-500' },
  risco: { cor: 'bg-amber-100 text-amber-700', label: 'Ativação baixa', dot: 'bg-amber-400' },
  ativo: { cor: 'bg-green-100 text-green-700', label: 'Ativo', dot: 'bg-green-500' },
}

const SEGMENTO_LABEL: Record<string, string> = {
  creche: 'Creche',
  hotel: 'Hotel',
  banho_tosa: 'Banho & Tosa',
  completo: 'Completo',
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function Metrica({ label, valor, cor = 'text-gray-900' }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${valor > 0 ? cor : 'text-gray-300'}`}>{valor}</p>
      <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
    </div>
  )
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'inativo' | 'risco' | 'ativo'>('todos')

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/superadmin/clientes')
    if (!res.ok) { setErro('Erro ao carregar clientes'); setLoading(false); return }
    setClientes(await res.json())
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
    else { const j = await res.json(); setErro(j.error || 'Erro') }
  }

  async function entrarNoSistema(empresaId: string) {
    if (entrando) return
    setEntrando(empresaId); setErro('')
    const res = await fetch('/api/superadmin/impersonar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId }),
    })
    if (res.ok) { router.push('/dashboard'); router.refresh() }
    else { const j = await res.json(); setErro(j.error || 'Erro'); setEntrando('') }
  }

  const visíveis = filtro === 'todos' ? clientes : clientes.filter(c => c.health === filtro)
  // Exclui o tenant interno (Aupi/Playdog) da contagem de métricas
  const externos = clientes.filter(c => c.id !== '00000000-0000-0000-0000-000000000001')
  const totalAtivos = externos.filter(c => c.status === 'ativo').length
  const totalTrials = externos.filter(c => c.status === 'trial').length
  const totalInativos = externos.filter(c => c.health === 'inativo').length
  const totalRisco = externos.filter(c => c.health === 'risco').length

  if (loading) return <p className="text-gray-400 text-sm py-10 text-center">Carregando...</p>

  return (
    <div className="flex flex-col gap-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Clientes Aupipet</h1>
        <p className="text-xs text-gray-400">{externos.length} empresa{externos.length !== 1 ? 's' : ''} cadastrada{externos.length !== 1 ? 's' : ''}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="!p-3 text-center">
          <p className="text-xl font-bold text-green-600">{totalAtivos}</p>
          <p className="text-[10px] text-gray-400">Pagantes</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{totalTrials}</p>
          <p className="text-[10px] text-gray-400">Em trial</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-xl font-bold text-amber-500">{totalRisco}</p>
          <p className="text-[10px] text-gray-400">Em risco</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-xl font-bold text-red-500">{totalInativos}</p>
          <p className="text-[10px] text-gray-400">Nunca ativou</p>
        </Card>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {(['todos', 'ativo', 'risco', 'inativo'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filtro === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'ativo' ? 'Ativos' : f === 'risco' ? 'Em risco' : 'Nunca ativaram'}
          </button>
        ))}
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

      {/* Lista */}
      {visíveis.map(c => {
        const health = HEALTH_CONFIG[c.health]
        const aberto = expandido === c.id
        const contato = c.whatsapp || c.telefone
        const emailContato = c.owner_email || c.email_contato

        return (
          <Card key={c.id} className="!p-0 overflow-hidden">
            {/* Cabeçalho do card */}
            <button
              className="w-full text-left p-4 flex items-start gap-3"
              onClick={() => setExpandido(aberto ? null : c.id)}
            >
              {/* Avatar */}
              <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                {c.logo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-lg">🐾</span>}
              </div>

              {/* Info principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900 text-sm leading-tight">{c.nome}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${STATUS_COR[c.status] ?? ''}`}>
                    {c.status === 'trial' ? `trial até ${fmt(c.trial_ate)}` : c.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {c.owner_nome || '—'} · {SEGMENTO_LABEL[c.segmento] || c.segmento}
                  {c.cidade ? ` · ${c.cidade}` : ''}
                </p>
                {/* Health + último acesso */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${health.cor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                    {health.label}
                  </span>
                  {c.nunca_voltou ? (
                    <span className="text-[10px] text-red-500 font-medium">Nunca voltou após cadastro</span>
                  ) : c.dias_desde_login !== null ? (
                    <span className="text-[10px] text-gray-400">
                      {c.dias_desde_login === 0 ? 'Acesso hoje' : `Último acesso há ${c.dias_desde_login}d`}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Expand icon */}
              <div className="shrink-0 text-gray-300 mt-1">
                {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {/* Métricas de atividade (sempre visíveis) */}
            <div className="px-4 pb-3 grid grid-cols-5 gap-1 border-t border-gray-50 pt-3">
              <Metrica label="Tutores" valor={c.total_tutores} cor="text-brand-purple" />
              <Metrica label="Pets" valor={c.total_pets} cor="text-brand-orange" />
              <Metrica label="Presenças" valor={c.total_presencas} cor="text-green-600" />
              <Metrica label="Banhos" valor={c.total_banhos} cor="text-teal-600" />
              <Metrica label="Hotel" valor={c.total_hospedagens} cor="text-indigo-600" />
            </div>

            {/* Detalhe expandido */}
            {aberto && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 flex flex-col gap-4">

                {/* Dados de contato */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Contato</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {emailContato && (
                      <a href={`mailto:${emailContato}`} className="flex items-center gap-2 text-sm text-gray-700">
                        <Mail size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate">{emailContato}</span>
                      </a>
                    )}
                    {contato && (
                      <a
                        href={`https://wa.me/55${contato.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <Phone size={13} className="text-gray-400 shrink-0" />
                        <span>{contato}</span>
                      </a>
                    )}
                    {c.cidade && (
                      <p className="flex items-center gap-2 text-sm text-gray-700">
                        <MapPin size={13} className="text-gray-400 shrink-0" />
                        {c.cidade}
                      </p>
                    )}
                  </div>
                </div>

                {/* Datas */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Histórico</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-xl px-3 py-2">
                      <p className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                        <Calendar size={10} /> Cadastro
                      </p>
                      <p className="text-sm font-semibold text-gray-900">{fmt(c.created_at)}</p>
                      <p className="text-[10px] text-gray-400">há {c.dias_desde_cadastro}d</p>
                    </div>
                    <div className="bg-white rounded-xl px-3 py-2">
                      <p className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                        <Clock size={10} /> Último acesso
                      </p>
                      {c.nunca_voltou ? (
                        <p className="text-sm font-semibold text-red-500">Nunca voltou</p>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-gray-900">{fmt(c.ultimo_login)}</p>
                          <p className="text-[10px] text-gray-400">
                            {c.dias_desde_login === 0 ? 'hoje' : `há ${c.dias_desde_login}d`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info técnica */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Conta</p>
                  <div className="bg-white rounded-xl px-3 py-2 flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Slug</span>
                      <span className="font-mono text-gray-700">{c.slug}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Plano</span>
                      <span className="text-gray-700 font-medium capitalize">{c.plano}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Segmento</span>
                      <span className="text-gray-700">{SEGMENTO_LABEL[c.segmento] || c.segmento}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Receitas lançadas</span>
                      <span className="text-gray-700 font-semibold">{c.total_receitas}</span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => entrarNoSistema(c.id)}
                    disabled={!!entrando}
                    className="w-full flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl bg-brand-purple text-white disabled:opacity-60"
                  >
                    <LogIn size={15} />
                    {entrando === c.id ? 'Entrando...' : 'Entrar no sistema'}
                  </button>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => executar(c.id, 'estender_trial')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700"
                    >
                      +14 dias trial
                    </button>
                    {c.status !== 'suspenso' && c.status !== 'cancelado' && (
                      <button onClick={() => executar(c.id, 'suspender')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600">
                        Suspender
                      </button>
                    )}
                    {(c.status === 'suspenso' || c.status === 'inadimplente' || c.status === 'cancelado') && (
                      <button onClick={() => executar(c.id, 'reativar')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700">
                        Reativar
                      </button>
                    )}
                    {c.status !== 'cancelado' && (
                      <button onClick={() => executar(c.id, 'cancelar')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500">
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )
      })}

      {visíveis.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">Nenhum cliente neste filtro.</p>
      )}

      {/* Ícones legenda */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-400 justify-center pt-2">
        <span className="flex items-center gap-1"><Users size={10} /> tutores</span>
        <span className="flex items-center gap-1"><Dog size={10} /> pets</span>
        <span className="flex items-center gap-1"><Activity size={10} /> movimentação</span>
      </div>
    </div>
  )
}
