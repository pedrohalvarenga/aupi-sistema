'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Truck, Check } from 'lucide-react'
import { CATEGORIAS } from '@/types/fornecedores'

const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm'
const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block'

export default function NovoFornecedorPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [categoria, setCategoria] = useState('')
  const [contatoNome, setContatoNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    if (!nome.trim()) { setErro('Informe o nome do fornecedor.'); return }
    setSalvando(true)
    const supabase = createClient()
    // empresa_id é preenchido pelo DEFAULT current_empresa_id() via RLS (cliente de sessão).
    const { error } = await supabase.from('fornecedores').insert({
      nome: nome.trim(),
      cnpj: cnpj.trim() || null,
      categoria: categoria || null,
      contato_nome: contatoNome.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      endereco: endereco.trim() || null,
      observacoes: observacoes.trim() || null,
    })
    setSalvando(false)
    if (error) {
      console.error('Erro ao cadastrar fornecedor:', error)
      setErro('Não foi possível salvar o fornecedor. Tente novamente.')
      return
    }
    router.push('/fornecedores')
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/fornecedores" className="p-2 rounded-xl text-gray-400 hover:text-gray-700">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Truck size={22} className="text-brand-purple" /> Novo fornecedor
        </h1>
      </div>

      <div>
        <label className={labelCls}>Nome *</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Petshop Atacado XYZ" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>CNPJ</label>
          <input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Categoria</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">Selecione...</option>
            {CATEGORIAS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Pessoa de contato</label>
          <input value={contatoNome} onChange={e => setContatoNome(e.target.value)} placeholder="Nome do contato" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Telefone</label>
          <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>E-mail</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@fornecedor.com" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Endereço</label>
        <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Observações</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
          placeholder="Condições de pagamento, prazos, detalhes..." className={inputCls} />
      </div>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="py-4 rounded-2xl bg-brand-purple text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando ? 'Salvando...' : <><Check size={20} /> Cadastrar fornecedor</>}
      </button>
    </div>
  )
}
