'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Check } from 'lucide-react'
import { parseMoeda } from '@/lib/utils'
import FuncionarioForm, { estadoVazio, regrasParaPayload, type FuncionarioFormState } from '../FuncionarioForm'

export default function NovoFuncionarioPage() {
  const router = useRouter()
  const [state, setState] = useState<FuncionarioFormState>(estadoVazio())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    if (!state.nome_completo.trim()) { setErro('Informe o nome completo.'); return }
    setSalvando(true)
    const res = await fetch('/api/funcionarios/criar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
        observacoes: state.observacoes.trim() || null,
        regras: state.recebe_comissao ? regrasParaPayload(state.regras) : [],
      }),
    })
    setSalvando(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErro(j.error || 'Não foi possível salvar.')
      return
    }
    router.push('/funcionarios')
  }

  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/funcionarios" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={22} className="text-brand-purple" /> Novo funcionário
        </h1>
      </div>

      <FuncionarioForm state={state} setState={setState} />

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="py-4 rounded-2xl bg-brand-purple text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando ? 'Salvando...' : <><Check size={20} /> Cadastrar funcionário</>}
      </button>
    </div>
  )
}
