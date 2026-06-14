'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Users, Check, Trash2, FileText } from 'lucide-react'
import { parseMoeda } from '@/lib/utils'
import FuncionarioForm, { estadoVazio, regrasParaPayload, type FuncionarioFormState } from '../../FuncionarioForm'
import type { Funcionario, ComissaoRegra } from '@/types/funcionarios'

export default function EditarFuncionarioPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [state, setState] = useState<FuncionarioFormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmarExcluir, setConfirmarExcluir] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: f } = await supabase.from('funcionarios').select('*').eq('id', id).single<Funcionario>()
      const { data: regras } = await supabase.from('comissao_regras').select('*').eq('funcionario_id', id)
      if (f) {
        const base = estadoVazio()
        setState({
          ...base,
          nome_completo: f.nome_completo ?? '',
          cpf: f.cpf ?? '', rg: f.rg ?? '',
          data_nascimento: f.data_nascimento ?? '',
          email: f.email ?? '', telefone: f.telefone ?? '',
          cargo: f.cargo ?? '',
          salario: f.salario != null ? String(f.salario).replace('.', ',') : '',
          data_admissao: f.data_admissao ?? '',
          tam_calca: f.tam_calca ?? '', tam_camisa: f.tam_camisa ?? '', tam_sapato: f.tam_sapato ?? '',
          observacoes: f.observacoes ?? '',
          foto_url: f.foto_url ?? null,
          usuario_id: f.usuario_id ?? null,
          recebe_comissao: f.recebe_comissao,
          ativo: f.ativo,
          regras: ((regras as ComissaoRegra[]) ?? []).map(r => ({
            tipo: r.tipo, percentual: String(r.percentual).replace('.', ','),
          })),
        })
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function salvar() {
    if (!state) return
    setErro('')
    if (!state.nome_completo.trim()) { setErro('Informe o nome completo.'); return }
    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.from('funcionarios').update({
      nome_completo: state.nome_completo.trim(),
      cpf: state.cpf.trim() || null,
      rg: state.rg.trim() || null,
      data_nascimento: state.data_nascimento || null,
      email: state.email.trim() || null,
      telefone: state.telefone.trim() || null,
      cargo: state.cargo.trim() || null,
      salario: parseMoeda(state.salario) ?? 0,
      data_admissao: state.data_admissao || null,
      tam_calca: state.tam_calca.trim() || null,
      tam_camisa: state.tam_camisa.trim() || null,
      tam_sapato: state.tam_sapato.trim() || null,
      foto_url: state.foto_url,
      usuario_id: state.usuario_id,
      recebe_comissao: state.recebe_comissao,
      ativo: state.ativo,
      observacoes: state.observacoes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (error) { setSalvando(false); setErro(error.message); return }

    // Regras: substitui o conjunto inteiro (delete + insert)
    await supabase.from('comissao_regras').delete().eq('funcionario_id', id)
    if (state.recebe_comissao) {
      const novas = regrasParaPayload(state.regras).map(r => ({ ...r, funcionario_id: id }))
      if (novas.length) {
        const { error: errR } = await supabase.from('comissao_regras').insert(novas)
        if (errR) { setSalvando(false); setErro(errR.message); return }
      }
    }

    setSalvando(false)
    router.push('/funcionarios')
  }

  async function excluir() {
    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.from('funcionarios').delete().eq('id', id)
    setSalvando(false)
    if (error) { setErro(error.message); return }
    router.push('/funcionarios')
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
  if (!state) return (
    <div className="py-20 text-center text-gray-400">Funcionário não encontrado.</div>
  )

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/funcionarios" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} className="text-brand-purple" /> Editar funcionário
          </h1>
        </div>
        {state.recebe_comissao && (
          <Link href={`/funcionarios/${id}/extrato`}
            className="flex items-center gap-1 text-sm font-semibold text-brand-purple">
            <FileText size={15} /> Extrato
          </Link>
        )}
      </div>

      <FuncionarioForm state={state} setState={(s) => setState(s)} showAtivo />

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="py-4 rounded-2xl bg-brand-purple text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando ? 'Salvando...' : <><Check size={20} /> Salvar alterações</>}
      </button>

      {confirmarExcluir ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm text-red-700 font-medium">Excluir este funcionário? As regras de comissão serão removidas. O histórico de comissões pagas é mantido sem o vínculo.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmarExcluir(false)} className="py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancelar</button>
            <button onClick={excluir} disabled={salvando} className="py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-50">Excluir</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmarExcluir(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl text-red-500 font-semibold text-sm border border-red-200">
          <Trash2 size={16} /> Excluir funcionário
        </button>
      )}
    </div>
  )
}
