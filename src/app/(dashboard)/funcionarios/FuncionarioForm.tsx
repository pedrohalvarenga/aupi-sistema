'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Plus, Trash2, Percent } from 'lucide-react'
import { parseMoeda } from '@/lib/utils'
import { COMISSAO_TIPO_LABELS } from '@/types/funcionarios'
import type { ComissaoTipo } from '@/types/funcionarios'

const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm'
const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block'

export interface RegraDraft { tipo: ComissaoTipo; percentual: string }

export interface FuncionarioFormState {
  nome_completo: string
  cpf: string
  rg: string
  data_nascimento: string
  email: string
  telefone: string
  cargo: string
  salario: string
  data_admissao: string
  tam_calca: string
  tam_camisa: string
  tam_sapato: string
  observacoes: string
  foto_url: string | null
  recebe_comissao: boolean
  usuario_id: string | null
  ativo: boolean
  regras: RegraDraft[]
}

export function estadoVazio(): FuncionarioFormState {
  return {
    nome_completo: '', cpf: '', rg: '', data_nascimento: '', email: '', telefone: '',
    cargo: '', salario: '', data_admissao: '', tam_calca: '', tam_camisa: '', tam_sapato: '',
    observacoes: '', foto_url: null, recebe_comissao: false, usuario_id: null, ativo: true,
    regras: [],
  }
}

const TIPOS: ComissaoTipo[] = ['banho_tosa', 'hotel', 'creche', 'transporte', 'veterinario', 'geral']

export default function FuncionarioForm({
  state, setState, showAtivo = false,
}: {
  state: FuncionarioFormState
  setState: (s: FuncionarioFormState) => void
  showAtivo?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [profiles, setProfiles] = useState<{ id: string; nome: string; email: string }[]>([])

  const set = <K extends keyof FuncionarioFormState>(campo: K, valor: FuncionarioFormState[K]) =>
    setState({ ...state, [campo]: valor })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('id, nome, email').eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) setProfiles(data) })
  }, [])

  async function uploadFoto(file: File) {
    setUploadingFoto(true)
    const fd = new FormData()
    fd.append('arquivo', file)
    const res = await fetch('/api/upload-foto-pet', { method: 'POST', body: fd })
    if (res.ok) {
      const { url } = await res.json()
      set('foto_url', url)
    }
    setUploadingFoto(false)
  }

  function addRegra() {
    const usados = new Set(state.regras.map(r => r.tipo))
    const proximo = TIPOS.find(t => !usados.has(t)) ?? 'geral'
    set('regras', [...state.regras, { tipo: proximo, percentual: '' }])
  }
  function updateRegra(i: number, campo: keyof RegraDraft, valor: string) {
    const novas = state.regras.map((r, idx) => idx === i ? { ...r, [campo]: valor } : r)
    set('regras', novas)
  }
  function removeRegra(i: number) {
    set('regras', state.regras.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Foto */}
      <div className="flex justify-center">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="relative w-24 h-24 rounded-3xl bg-purple-50 border-2 border-dashed border-purple-200 flex items-center justify-center overflow-hidden">
          {state.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.foto_url} alt="foto" className="w-full h-full object-cover" />
          ) : (
            <Camera size={26} className="text-brand-purple/60" />
          )}
          {uploadingFoto && (
            <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f) }} />
      </div>

      {/* Dados pessoais */}
      <div>
        <label className={labelCls}>Nome completo *</label>
        <input value={state.nome_completo} onChange={e => set('nome_completo', e.target.value)}
          placeholder="Ex.: Maria Silva" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>CPF</label>
          <input value={state.cpf} onChange={e => set('cpf', e.target.value)} className={inputCls} inputMode="numeric" />
        </div>
        <div>
          <label className={labelCls}>RG</label>
          <input value={state.rg} onChange={e => set('rg', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Nascimento</label>
          <input type="date" value={state.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Telefone</label>
          <input value={state.telefone} onChange={e => set('telefone', e.target.value)} className={inputCls} inputMode="tel" />
        </div>
      </div>
      <div>
        <label className={labelCls}>E-mail</label>
        <input value={state.email} onChange={e => set('email', e.target.value)} className={inputCls} inputMode="email" />
      </div>

      {/* Profissional */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Cargo</label>
          <input value={state.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Tosador(a)" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Salário</label>
          <input value={state.salario} onChange={e => set('salario', e.target.value)} placeholder="0,00" className={inputCls} inputMode="decimal" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Data de admissão</label>
          <input type="date" value={state.data_admissao} onChange={e => set('data_admissao', e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Uniformes */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">Uniformes</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Calça</label>
            <input value={state.tam_calca} onChange={e => set('tam_calca', e.target.value)} placeholder="42" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Camisa</label>
            <input value={state.tam_camisa} onChange={e => set('tam_camisa', e.target.value)} placeholder="M" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sapato</label>
            <input value={state.tam_sapato} onChange={e => set('tam_sapato', e.target.value)} placeholder="38" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Acesso */}
      <div>
        <label className={labelCls}>Vincular a um usuário do sistema (opcional)</label>
        <select value={state.usuario_id ?? ''} onChange={e => set('usuario_id', e.target.value || null)} className={inputCls}>
          <option value="">Sem vínculo</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.nome} — {p.email}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">Liga este funcionário a uma conta de login já existente.</p>
      </div>

      {/* Comissão */}
      <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 flex flex-col gap-3">
        <button type="button" onClick={() => set('recebe_comissao', !state.recebe_comissao)}
          className="flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <Percent size={16} className="text-brand-purple" />
            <span className="font-bold text-gray-800 text-sm">Recebe comissão</span>
          </div>
          <span className="w-11 h-6 rounded-full flex-shrink-0 relative transition-colors"
            style={{ background: state.recebe_comissao ? 'var(--brand-purple)' : '#e5e7eb' }}>
            <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all"
              style={{ left: state.recebe_comissao ? '22px' : '2px' }} />
          </span>
        </button>

        {state.recebe_comissao && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">Defina o percentual por área de serviço. &quot;Geral&quot; vale para áreas sem regra específica.</p>
            {state.regras.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={r.tipo} onChange={e => updateRegra(i, 'tipo', e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white">
                  {TIPOS.map(t => <option key={t} value={t}>{COMISSAO_TIPO_LABELS[t]}</option>)}
                </select>
                <div className="relative w-24">
                  <input value={r.percentual} onChange={e => updateRegra(i, 'percentual', e.target.value)}
                    placeholder="0" inputMode="decimal"
                    className="w-full pl-3 pr-7 py-2.5 rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                <button type="button" onClick={() => removeRegra(i)} className="p-2 text-red-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addRegra}
              className="flex items-center gap-1.5 text-sm font-semibold text-brand-purple mt-1">
              <Plus size={15} /> Adicionar regra
            </button>
          </div>
        )}
      </div>

      {/* Observações */}
      <div>
        <label className={labelCls}>Observações</label>
        <textarea value={state.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className={inputCls} />
      </div>

      {showAtivo && (
        <button type="button" onClick={() => set('ativo', !state.ativo)}
          className="flex items-center justify-between py-3 px-4 rounded-2xl border border-gray-200 bg-white text-left">
          <div>
            <p className="font-medium text-gray-900 text-sm">Funcionário ativo</p>
            <p className="text-xs text-gray-400">Inativos não aparecem nas comissões nem nos seletores</p>
          </div>
          <span className="w-11 h-6 rounded-full flex-shrink-0 relative transition-colors"
            style={{ background: state.ativo ? 'var(--brand-purple)' : '#e5e7eb' }}>
            <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" style={{ left: state.ativo ? '22px' : '2px' }} />
          </span>
        </button>
      )}
    </div>
  )
}

// Helpers compartilhados de serialização
export function regrasParaPayload(regras: RegraDraft[]) {
  return regras
    .map(r => ({ tipo: r.tipo, percentual: parseMoeda(r.percentual) }))
    .filter(r => r.percentual != null && r.percentual > 0) as { tipo: ComissaoTipo; percentual: number }[]
}
