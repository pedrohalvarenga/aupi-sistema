'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Phone, Mail, MapPin, Calendar, Clock, ChevronDown, ChevronUp, TrendingUp, AlertTriangle, BarChart2, Users2, Download } from 'lucide-react'
import Card from '@/components/ui/Card'

interface Cliente {
  id: string
  nome: string
  slug: string
  segmento: string
  plano: string
  status: string
  trial_ate: string | null
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

type Aba = 'geral' | 'clientes' | 'relatorio'
type Filtro = 'todos' | 'inativo' | 'risco' | 'ativo'

function fmt(date: string | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function diasAteExpira(trial_ate: string | null): number | null {
  if (!trial_ate) return null
  const diff = new Date(trial_ate).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function MiniBarChart({ dados }: { dados: { semana: string; count: number }[] }) {
  const max = Math.max(...dados.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-12">
      {dados.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-sm bg-brand-purple opacity-70"
            style={{ height: `${Math.max(2, (d.count / max) * 40)}px` }}
          />
          <span className="text-[8px] text-gray-400 leading-none">{d.semana}</span>
        </div>
      ))}
    </div>
  )
}

function Metrica({ label, valor, cor = 'text-gray-900' }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${valor > 0 ? cor : 'text-gray-300'}`}>{valor}</p>
      <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
    </div>
  )
}

function exportarCSV(clientes: Cliente[]) {
  const header = 'Nome,Slug,Status,Segmento,Plano,Dono,Email,WhatsApp,Cidade,Cadastro,Último Acesso,Tutores,Pets,Presenças,Banhos,Hotel,Health'
  const rows = clientes.map(c => [
    c.nome, c.slug, c.status, c.segmento, c.plano,
    c.owner_nome ?? '', c.owner_email ?? '', c.whatsapp ?? '', c.cidade ?? '',
    fmt(c.created_at), c.nunca_voltou ? 'Nunca voltou' : fmt(c.ultimo_login),
    c.total_tutores, c.total_pets, c.total_presencas, c.total_banhos, c.total_hospedagens, c.health,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `clientes-aupipet-${new Date().toISOString().slice(0,10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [aba, setAba] = useState<Aba>('geral')
  const [ordenar, setOrdenar] = useState<'recentes' | 'atividade' | 'trial'>('recentes')

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

  const externos = useMemo(
    () => clientes.filter(c => c.id !== '00000000-0000-0000-0000-000000000001'),
    [clientes]
  )

  // ── Métricas gerais ──
  const totalAtivos = externos.filter(c => c.status === 'ativo').length
  const totalTrials = externos.filter(c => c.status === 'trial').length
  const totalInativos = externos.filter(c => c.health === 'inativo').length
  const totalRisco = externos.filter(c => c.health === 'risco').length
  const totalSaudaveis = externos.filter(c => c.health === 'ativo').length
  const taxaAtivacao = externos.length > 0 ? Math.round(((externos.length - totalInativos) / externos.length) * 100) : 0
  const taxaConversao = (totalTrials + totalAtivos) > 0 ? Math.round((totalAtivos / (totalTrials + totalAtivos)) * 100) : 0

  // ── Trials expirando ──
  const trialsExpirando = externos
    .filter(c => c.status === 'trial' && diasAteExpira(c.trial_ate) !== null && (diasAteExpira(c.trial_ate) ?? 99) <= 7)
    .sort((a, b) => (diasAteExpira(a.trial_ate) ?? 0) - (diasAteExpira(b.trial_ate) ?? 0))

  // ── Cadastros por semana (últimas 8 semanas) ──
  const semanas = useMemo(() => {
    const agora = Date.now()
    const buckets: Record<string, number> = {}
    for (let i = 7; i >= 0; i--) {
      const d = new Date(agora - i * 7 * 86400000)
      const label = `${d.getDate()}/${d.getMonth() + 1}`
      buckets[label] = 0
    }
    externos.forEach(c => {
      const d = new Date(c.created_at)
      // Atribui ao início da semana mais próxima
      const diffMs = agora - d.getTime()
      const diffWeeks = Math.floor(diffMs / (7 * 86400000))
      if (diffWeeks < 8) {
        const ref = new Date(agora - diffWeeks * 7 * 86400000)
        const label = `${ref.getDate()}/${ref.getMonth() + 1}`
        if (label in buckets) buckets[label]++
      }
    })
    return Object.entries(buckets).map(([semana, count]) => ({ semana, count }))
  }, [externos])

  // ── Lista filtrada e ordenada ──
  const visiveis = useMemo(() => {
    let lista = filtro === 'todos' ? externos : externos.filter(c => c.health === filtro)
    if (ordenar === 'atividade') lista = [...lista].sort((a, b) => b.total_atividade - a.total_atividade)
    else if (ordenar === 'trial') lista = [...lista].sort((a, b) => (diasAteExpira(a.trial_ate) ?? 999) - (diasAteExpira(b.trial_ate) ?? 999))
    else lista = [...lista].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return lista
  }, [externos, filtro, ordenar])

  if (loading) return <p className="text-gray-400 text-sm py-10 text-center">Carregando...</p>

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes Aupipet</h1>
          <p className="text-xs text-gray-400">{externos.length} empresa{externos.length !== 1 ? 's' : ''} cadastrada{externos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => exportarCSV(externos)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600"
        >
          <Download size={12} /> CSV
        </button>
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([['geral', 'Visão Geral'], ['clientes', 'Clientes'], ['relatorio', 'Relatório']] as [Aba, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
              aba === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══ ABA: VISÃO GERAL ══ */}
      {aba === 'geral' && (
        <div className="flex flex-col gap-4">
          {/* KPIs principais */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="!p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-green-500" />
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Pagantes</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{totalAtivos}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Conversão: {taxaConversao}%</p>
            </Card>
            <Card className="!p-3">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={14} className="text-blue-500" />
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Em trial</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{totalTrials}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Ativação: {taxaAtivacao}%</p>
            </Card>
            <Card className="!p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Em risco</span>
              </div>
              <p className="text-2xl font-bold text-amber-500">{totalRisco}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Usaram pouco</p>
            </Card>
            <Card className="!p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users2 size={14} className="text-red-500" />
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Nunca ativou</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{totalInativos}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Cadastraram e saíram</p>
            </Card>
          </div>

          {/* Funil de conversão */}
          <Card className="!p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Funil de Conversão</p>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Cadastros', valor: externos.length, cor: 'bg-gray-200', pct: 100 },
                { label: 'Ativaram', valor: externos.length - totalInativos, cor: 'bg-blue-400', pct: externos.length > 0 ? Math.round(((externos.length - totalInativos) / externos.length) * 100) : 0 },
                { label: 'Saudáveis', valor: totalSaudaveis, cor: 'bg-green-400', pct: externos.length > 0 ? Math.round((totalSaudaveis / externos.length) * 100) : 0 },
                { label: 'Pagantes', valor: totalAtivos, cor: 'bg-green-600', pct: externos.length > 0 ? Math.round((totalAtivos / externos.length) * 100) : 0 },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.valor} <span className="text-gray-400 font-normal">({item.pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.cor}`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Cadastros por semana */}
          <Card className="!p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cadastros por Semana</p>
            <MiniBarChart dados={semanas} />
          </Card>

          {/* Trials expirando */}
          {trialsExpirando.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5 mb-2">
                <AlertTriangle size={12} /> Trials expirando em 7 dias
              </p>
              <div className="flex flex-col gap-2">
                {trialsExpirando.map(c => {
                  const dias = diasAteExpira(c.trial_ate)
                  return (
                    <div key={c.id} className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.nome}</p>
                        <p className="text-xs text-gray-500">
                          {c.nunca_voltou ? 'Nunca ativou' : `Atividade: ${c.total_atividade}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${dias !== null && dias <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                          {dias === 0 ? 'Hoje!' : dias !== null && dias < 0 ? 'Expirado' : `${dias}d`}
                        </p>
                        <button
                          onClick={() => executar(c.id, 'estender_trial')}
                          className="text-[10px] text-blue-600 font-semibold"
                        >
                          +14 dias
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Resumo por segmento */}
          <Card className="!p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Por Segmento</p>
            <div className="flex flex-col gap-1.5">
              {Object.entries(SEGMENTO_LABEL).map(([key, label]) => {
                const count = externos.filter(c => c.segmento === key).length
                if (count === 0) return null
                return (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ══ ABA: CLIENTES ══ */}
      {aba === 'clientes' && (
        <div className="flex flex-col gap-3">
          {/* Filtro + ordenação */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {(['todos', 'ativo', 'risco', 'inativo'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  filtro === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {f === 'todos' ? `Todos (${externos.length})` : f === 'ativo' ? `Ativos (${totalSaudaveis})` : f === 'risco' ? `Em risco (${totalRisco})` : `Inativos (${totalInativos})`}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-[10px] text-gray-400">Ordenar:</span>
            {([['recentes', 'Recentes'], ['atividade', 'Atividade'], ['trial', 'Trial']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setOrdenar(id)}
                className={`text-[10px] font-semibold px-2 py-1 rounded-md ${
                  ordenar === id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lista de cards */}
          {visiveis.map(c => {
            const health = HEALTH_CONFIG[c.health]
            const aberto = expandido === c.id
            const contato = c.whatsapp || c.telefone
            const emailContato = c.owner_email || c.email_contato
            const diasTrial = diasAteExpira(c.trial_ate)

            return (
              <Card key={c.id} className="!p-0 overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-start gap-3"
                  onClick={() => setExpandido(aberto ? null : c.id)}
                >
                  <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                    {c.logo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-lg">🐾</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm leading-tight">{c.nome}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${STATUS_COR[c.status] ?? ''}`}>
                        {c.status === 'trial'
                          ? diasTrial !== null && diasTrial <= 0 ? 'expirado' : `trial ${diasTrial}d`
                          : c.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {c.owner_nome || '—'} · {SEGMENTO_LABEL[c.segmento] || c.segmento}
                      {c.cidade ? ` · ${c.cidade}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${health.cor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                        {health.label}
                      </span>
                      {c.nunca_voltou ? (
                        <span className="text-[10px] text-red-500 font-medium">Nunca voltou</span>
                      ) : c.dias_desde_login !== null ? (
                        <span className="text-[10px] text-gray-400">
                          {c.dias_desde_login === 0 ? 'Acesso hoje' : `Acesso há ${c.dias_desde_login}d`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-gray-300 mt-1">
                    {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Métricas de atividade */}
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
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Contato</p>
                      {emailContato && (
                        <a href={`mailto:${emailContato}`} className="flex items-center gap-2 text-sm text-gray-700">
                          <Mail size={13} className="text-gray-400 shrink-0" /><span className="truncate">{emailContato}</span>
                        </a>
                      )}
                      {contato && (
                        <a href={`https://wa.me/55${contato.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 text-sm text-gray-700">
                          <Phone size={13} className="text-gray-400 shrink-0" /><span>{contato}</span>
                        </a>
                      )}
                      {c.cidade && (
                        <p className="flex items-center gap-2 text-sm text-gray-700">
                          <MapPin size={13} className="text-gray-400 shrink-0" />{c.cidade}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Histórico</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white rounded-xl px-3 py-2">
                          <p className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5"><Calendar size={10} /> Cadastro</p>
                          <p className="text-sm font-semibold text-gray-900">{fmt(c.created_at)}</p>
                          <p className="text-[10px] text-gray-400">há {c.dias_desde_cadastro}d</p>
                        </div>
                        <div className="bg-white rounded-xl px-3 py-2">
                          <p className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5"><Clock size={10} /> Último acesso</p>
                          {c.nunca_voltou ? (
                            <p className="text-sm font-semibold text-red-500">Nunca voltou</p>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-gray-900">{fmt(c.ultimo_login)}</p>
                              <p className="text-[10px] text-gray-400">{c.dias_desde_login === 0 ? 'hoje' : `há ${c.dias_desde_login}d`}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Conta</p>
                      <div className="bg-white rounded-xl px-3 py-2 flex flex-col gap-1">
                        <div className="flex justify-between text-xs"><span className="text-gray-400">Slug</span><span className="font-mono text-gray-700">{c.slug}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">Plano</span><span className="text-gray-700 font-medium capitalize">{c.plano}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">Segmento</span><span className="text-gray-700">{SEGMENTO_LABEL[c.segmento] || c.segmento}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">Receitas lançadas</span><span className="text-gray-700 font-semibold">{c.total_receitas}</span></div>
                        {c.status === 'trial' && c.trial_ate && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Trial expira</span>
                            <span className={`font-semibold ${diasTrial !== null && diasTrial <= 3 ? 'text-red-600' : 'text-gray-700'}`}>
                              {fmt(c.trial_ate)} {diasTrial !== null ? `(${diasTrial}d)` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

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
                        <button onClick={() => executar(c.id, 'estender_trial')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700">+14 dias trial</button>
                        {c.status !== 'suspenso' && c.status !== 'cancelado' && (
                          <button onClick={() => executar(c.id, 'suspender')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600">Suspender</button>
                        )}
                        {(c.status === 'suspenso' || c.status === 'inadimplente' || c.status === 'cancelado') && (
                          <button onClick={() => executar(c.id, 'reativar')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700">Reativar</button>
                        )}
                        {c.status !== 'cancelado' && (
                          <button onClick={() => executar(c.id, 'cancelar')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500">Cancelar</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          {visiveis.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Nenhum cliente neste filtro.</p>
          )}
        </div>
      )}

      {/* ══ ABA: RELATÓRIO ══ */}
      {aba === 'relatorio' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{externos.length} empresas · {totalAtivos} pagantes · {totalTrials} em trial</p>
            <button onClick={() => exportarCSV(externos)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600">
              <Download size={11} /> Exportar
            </button>
          </div>

          {/* Tabela resumo */}
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <div className="grid grid-cols-12 gap-1 text-[9px] font-semibold text-gray-400 uppercase tracking-wide">
                <span className="col-span-4">Empresa</span>
                <span className="col-span-2 text-center">Status</span>
                <span className="col-span-2 text-center">Atividade</span>
                <span className="col-span-2 text-center">Cadastro</span>
                <span className="col-span-2 text-center">Acesso</span>
              </div>
            </div>
            {externos
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((c, i) => (
                <div key={c.id} className={`px-4 py-2.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <div className="grid grid-cols-12 gap-1 items-center">
                    <div className="col-span-4 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{c.nome}</p>
                      <p className="text-[10px] text-gray-400 truncate">{c.owner_email || '—'}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-md ${STATUS_COR[c.status] ?? 'bg-gray-50 text-gray-400'}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <p className={`text-xs font-bold ${c.total_atividade > 0 ? 'text-green-600' : 'text-gray-300'}`}>{c.total_atividade}</p>
                      <p className="text-[9px] text-gray-400">{c.health}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <p className="text-[10px] text-gray-700">{fmt(c.created_at)}</p>
                      <p className="text-[9px] text-gray-400">há {c.dias_desde_cadastro}d</p>
                    </div>
                    <div className="col-span-2 text-center">
                      {c.nunca_voltou ? (
                        <p className="text-[9px] font-semibold text-red-500">Nunca</p>
                      ) : (
                        <>
                          <p className="text-[10px] text-gray-700">{fmt(c.ultimo_login)}</p>
                          <p className="text-[9px] text-gray-400">{c.dias_desde_login === 0 ? 'hoje' : `${c.dias_desde_login}d`}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </Card>

          {/* Por health */}
          <Card className="!p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Distribuição de Saúde</p>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Ativos (>10 ações)', count: totalSaudaveis, cor: 'bg-green-500', textCor: 'text-green-600' },
                { label: 'Em risco (1–10 ações)', count: totalRisco, cor: 'bg-amber-400', textCor: 'text-amber-600' },
                { label: 'Nunca ativou (0 ações)', count: totalInativos, cor: 'bg-red-400', textCor: 'text-red-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.cor.replace('bg-', '') }} />
                  <span className="text-xs text-gray-600 flex-1">{item.label}</span>
                  <span className={`text-sm font-bold ${item.textCor}`}>{item.count}</span>
                  <span className="text-xs text-gray-400 w-8 text-right">
                    {externos.length > 0 ? `${Math.round((item.count / externos.length) * 100)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
