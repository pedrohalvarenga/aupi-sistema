'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { CONTA_TIPO_LABELS } from '@/lib/financeiro'
import { parseMoeda } from '@/lib/utils'
import type { TipoConta } from '@/types/financeiro'
import { Wallet, CreditCard, Banknote, Trash2, Plus, Pencil } from 'lucide-react'

interface Conta {
  id: string
  nome: string
  tipo: TipoConta
  saldo_inicial: number
  ativo: boolean
}

const TIPOS: TipoConta[] = ['banco', 'maquina_cartao', 'dinheiro']
const ICONE: Record<TipoConta, React.ElementType> = { banco: Wallet, maquina_cartao: CreditCard, dinheiro: Banknote }

const VAZIO = { nome: '', tipo: 'banco' as TipoConta, saldo_inicial: '0' }

export default function ContasPage() {
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).single()
    setEmpresaId(profile?.empresa_id ?? null)
    const { data } = await supabase.from('contas_financeiras').select('*').order('created_at')
    setContas(data ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  function abrirNova() { setEditandoId(null); setForm(VAZIO); setErro('') }
  function abrirEdicao(c: Conta) {
    setEditandoId(c.id)
    setForm({ nome: c.nome, tipo: c.tipo, saldo_inicial: String(c.saldo_inicial) })
    setErro('')
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Dê um nome para a conta.'); return }
    setSalvando(true); setErro('')
    try {
      const supabase = createClient()
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        saldo_inicial: parseMoeda(form.saldo_inicial) ?? 0,
      }
      const { error } = editandoId
        ? await supabase.from('contas_financeiras').update(payload).eq('id', editandoId)
        : await supabase.from('contas_financeiras').insert({ ...payload, ativo: true, empresa_id: empresaId })
      if (error) { setErro('Erro ao salvar: ' + error.message); return }
      setForm(VAZIO); setEditandoId(null)
      await carregar()
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(c: Conta) {
    const supabase = createClient()
    await supabase.from('contas_financeiras').update({ ativo: !c.ativo }).eq('id', c.id)
    carregar()
  }

  async function apagar(c: Conta) {
    if (!confirm(`Apagar a conta "${c.nome}"? Esta ação não pode ser desfeita.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('contas_financeiras').delete().eq('id', c.id)
    if (error) {
      alert('Esta conta tem lançamentos vinculados e não pode ser apagada. Você pode desativá-la.')
      return
    }
    carregar()
  }

  if (loading) return <p className="text-gray-400 text-sm py-10 text-center">Carregando...</p>

  return (
    <div className="py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contas bancárias</h1>
        <p className="text-sm text-gray-400">Crie e gerencie as contas onde o dinheiro do seu negócio entra e sai.</p>
      </div>

      {/* Formulário (nova / edição) */}
      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">{editandoId ? 'Editar conta' : 'Nova conta'}</h2>
        <div className="flex flex-col gap-3">
          <Input id="nome" label="Nome" placeholder="Ex.: Conta C6, Nubank, PIX..." value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => {
                const Icon = ICONE[t]
                const ativo = form.tipo === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold ${ativo ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                    style={ativo ? { background: 'var(--brand-purple)' } : undefined}
                  >
                    <Icon size={18} />
                    {CONTA_TIPO_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>
          <Input id="saldo" label="Saldo inicial (R$)" type="text" inputMode="decimal" value={form.saldo_inicial} onChange={(e) => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <div className="flex gap-2">
            {editandoId && <Button variant="ghost" className="flex-1" onClick={abrirNova}>Cancelar</Button>}
            <Button className="flex-1" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar' : <><Plus size={16} /> Adicionar conta</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {contas.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma conta ainda. Crie a primeira acima.</p>}
        {contas.map((c) => {
          const Icon = ICONE[c.tipo] ?? Wallet
          return (
            <Card key={c.id} className={c.ativo ? '' : 'opacity-60'}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{c.nome}</p>
                  <p className="text-xs text-gray-400">{CONTA_TIPO_LABELS[c.tipo]} · saldo inicial R$ {Number(c.saldo_inicial).toFixed(2).replace('.', ',')}{!c.ativo && ' · inativa'}</p>
                </div>
                <button onClick={() => abrirEdicao(c)} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100" aria-label="Editar"><Pencil size={16} /></button>
                <button onClick={() => toggleAtivo(c)} className="text-xs font-semibold px-2 text-gray-500">{c.ativo ? 'Desativar' : 'Ativar'}</button>
                <button onClick={() => apagar(c)} className="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50" aria-label="Apagar"><Trash2 size={16} /></button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
