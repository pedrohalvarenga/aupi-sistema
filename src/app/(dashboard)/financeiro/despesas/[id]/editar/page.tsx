'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import CurrencyInput from '@/components/financeiro/CurrencyInput'
import { AREA_LABELS, CATEGORIA_DESPESA_LABELS, isInvestimento } from '@/lib/financeiro'
import type { ContaFinanceira, AreaNegocio, CategoriaDespesa } from '@/types/financeiro'

type TipoFavorecido = 'fornecedor' | 'funcionario' | 'outro'

const CATEGORIAS_DESPESA: CategoriaDespesa[] = [
  'racao_petiscos','limpeza','produtos_banho_tosa','salarios','comissoes',
  'combustivel','manutencao','investimento','aluguel','agua_luz_internet',
  'contador','marketing','impostos','taxas_bancarias','outros',
]

export default function EditarDespesaPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const [data, setData] = useState('')
  const [valor, setValor] = useState(0)
  const [area, setArea] = useState<AreaNegocio>('geral')
  const [categoria, setCategoria] = useState<CategoriaDespesa>('outros')
  const [contaId, setContaId] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<'pago' | 'pendente'>('pago')
  const [dataVenc, setDataVenc] = useState('')
  const [recorrente, setRecorrente] = useState(false)
  const [diaVencimento, setDiaVencimento] = useState('')
  const [tipoFavorecido, setTipoFavorecido] = useState<TipoFavorecido>('outro')
  const [fornecedoresLista, setFornecedoresLista] = useState<{ id: string; nome: string }[]>([])
  const [funcionariosLista, setFuncionariosLista] = useState<{ id: string; nome_completo: string }[]>([])
  const [fornecedorId, setFornecedorId] = useState('')
  const [funcionarioId, setFuncionarioId] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('contas_financeiras').select('*').eq('ativo', true),
      supabase.from('despesas').select('*').eq('id', id).single(),
      supabase.from('fornecedores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('funcionarios').select('id, nome_completo').eq('ativo', true).order('nome_completo'),
    ]).then(([contasRes, despesaRes, fornRes, funcRes]) => {
      if (contasRes.data) setContas(contasRes.data as ContaFinanceira[])
      if (fornRes.data) setFornecedoresLista(fornRes.data)
      if (funcRes.data) setFuncionariosLista(funcRes.data)
      const d = despesaRes.data
      if (d) {
        setData(d.data)
        setValor(d.valor)
        setArea(d.area)
        setCategoria(d.categoria)
        setContaId(d.conta_id)
        setFornecedor(d.fornecedor ?? '')
        setDescricao(d.descricao ?? '')
        setStatus(d.status)
        setDataVenc(d.data_vencimento ?? '')
        setRecorrente(d.recorrente ?? false)
        setDiaVencimento(d.dia_vencimento?.toString() ?? '')
        if (d.fornecedor_id) { setTipoFavorecido('fornecedor'); setFornecedorId(d.fornecedor_id) }
        else if (d.funcionario_id) { setTipoFavorecido('funcionario'); setFuncionarioId(d.funcionario_id) }
        else setTipoFavorecido('outro')
      }
      setLoading(false)
    })
  }, [id])

  async function salvar() {
    if (valor <= 0) { setErro('Informe o valor.'); return }
    if (!contaId) { setErro('Selecione a conta.'); return }
    if (status === 'pendente' && !dataVenc) { setErro('Informe a data de vencimento.'); return }
    setErro(''); setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('despesas').update({
      data, valor, area, categoria,
      conta_id: contaId,
      fornecedor: fornecedor || null,
      fornecedor_id: tipoFavorecido === 'fornecedor' ? (fornecedorId || null) : null,
      funcionario_id: tipoFavorecido === 'funcionario' ? (funcionarioId || null) : null,
      descricao: descricao || null,
      status,
      data_vencimento: status === 'pendente' ? dataVenc : null,
      recorrente,
      dia_vencimento: recorrente ? Number(diaVencimento) : null,
    }).eq('id', id)
    setSaving(false)
    if (error) {
      console.error('Erro ao salvar despesa:', error)
      setErro('Não foi possível salvar as alterações. Tente novamente.')
      return
    }
    router.push(`/financeiro/despesas/${id}`)
  }

  if (loading) return <div className="py-6 text-center text-gray-400">Carregando...</div>

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href={`/financeiro/despesas/${id}`} className="p-2 rounded-xl text-gray-400"><ArrowLeft size={24} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Editar Despesa</h1>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Data</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      <CurrencyInput label="Valor" value={valor} onChange={setValor} />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Área / Centro de custo</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(AREA_LABELS) as AreaNegocio[]).map(a => (
            <button key={a} type="button" onClick={() => setArea(a)}
              className={`py-2.5 px-3 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                area === a ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {AREA_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Categoria</label>
        <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaDespesa)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white">
          {CATEGORIAS_DESPESA.map(c => (
            <option key={c} value={c}>{CATEGORIA_DESPESA_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {isInvestimento(categoria) && (
        <div className="flex items-start gap-2 bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Investimento</strong> não entra no resultado operacional mensal.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Conta de origem</label>
        <div className="flex flex-col gap-2">
          {contas.map(c => (
            <button key={c.id} type="button" onClick={() => setContaId(c.id)}
              className={`py-2.5 px-4 rounded-2xl text-sm font-semibold border-2 text-left transition-colors ${
                contaId === c.id ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Fornecedor (opcional)</label>
        <input type="text" value={fornecedor} onChange={e => setFornecedor(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Descrição (opcional)</label>
        <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
          className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
      </div>

      {/* Favorecido (opcional) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Favorecido (opcional)</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['fornecedor', 'Fornecedor'],
            ['funcionario', 'Funcionário'],
            ['outro', 'Outro'],
          ] as [TipoFavorecido, string][]).map(([t, lbl]) => (
            <button key={t} type="button"
              onClick={() => { setTipoFavorecido(t); setFornecedorId(''); setFuncionarioId('') }}
              className={`py-2.5 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                tipoFavorecido === t ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {lbl}
            </button>
          ))}
        </div>

        {tipoFavorecido === 'fornecedor' && (
          fornecedoresLista.length === 0 ? (
            <p className="text-xs text-gray-400 mt-1">
              Nenhum fornecedor ativo cadastrado. <Link href="/fornecedores/novo" className="text-brand-purple font-semibold">Cadastrar</Link>
            </p>
          ) : (
            <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}
              className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white mt-1">
              <option value="">Selecione o fornecedor...</option>
              {fornecedoresLista.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          )
        )}

        {tipoFavorecido === 'funcionario' && (
          funcionariosLista.length === 0 ? (
            <p className="text-xs text-gray-400 mt-1">Nenhum funcionário disponível.</p>
          ) : (
            <select value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)}
              className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white mt-1">
              <option value="">Selecione o funcionário...</option>
              {funcionariosLista.map(f => (
                <option key={f.id} value={f.id}>{f.nome_completo}</option>
              ))}
            </select>
          )
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700">Status</label>
        <div className="grid grid-cols-2 gap-2">
          {(['pago', 'pendente'] as const).map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`py-2.5 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                status === s ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-700'
              }`}>
              {s === 'pago' ? 'Pago' : 'Pendente'}
            </button>
          ))}
        </div>
      </div>

      {status === 'pendente' && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700">Data de vencimento</label>
          <input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)}
            className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
        </div>
      )}

      <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-4 border border-blue-200">
        <input type="checkbox" id="recorrente" checked={recorrente} onChange={e => setRecorrente(e.target.checked)}
          className="w-5 h-5 rounded accent-brand-purple" />
        <label htmlFor="recorrente" className="text-sm font-semibold text-blue-800 cursor-pointer">
          Despesa recorrente (mensal)
        </label>
      </div>

      {recorrente && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700">Dia do vencimento</label>
          <input type="number" min="1" max="31" value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)}
            className="w-full py-3 px-4 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
        </div>
      )}

      {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

      <Button size="lg" variant="danger" onClick={salvar} loading={saving}>
        Salvar alterações
      </Button>
    </div>
  )
}
