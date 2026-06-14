'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, UploadCloud, FileSpreadsheet, FileText, Image as ImageIcon, Sparkles, Trash2, CheckCircle2, Dog, User } from 'lucide-react'
import Button from '@/components/ui/Button'

type Pet = {
  nome: string; raca?: string; porte: 'P' | 'M' | 'G'; castrado?: boolean
  data_nascimento?: string; restricoes?: string; comportamento?: string
  vacina_v8_v10?: string; vacina_antirabica?: string; vacina_gripe?: string; saldo_diarias?: number
}
type Tutor = {
  nome: string; telefone?: string; whatsapp?: string; email?: string
  cpf?: string; endereco?: string; observacoes?: string; pets: Pet[]
}

const PORTES: Array<'P' | 'M' | 'G'> = ['P', 'M', 'G']

function iconeArquivo(nome: string) {
  if (/\.(xlsx|xls|csv|tsv)$/i.test(nome)) return <FileSpreadsheet size={18} className="text-green-600" />
  if (/\.pdf$/i.test(nome)) return <FileText size={18} className="text-red-500" />
  return <ImageIcon size={18} className="text-blue-500" />
}

export default function ImportarPage() {
  const [arquivos, setArquivos] = useState<File[]>([])
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [avisos, setAvisos] = useState<string[]>([])
  const [tutores, setTutores] = useState<Tutor[] | null>(null)
  const [pronto, setPronto] = useState<{ tutores: number; pets: number; ignorados: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addArquivos(lista: FileList | null) {
    if (!lista) return
    setArquivos(prev => [...prev, ...Array.from(lista)].slice(0, 15))
  }

  async function analisar() {
    if (arquivos.length === 0 || analisando) return
    setErro(''); setAvisos([]); setAnalisando(true)
    try {
      const fd = new FormData()
      arquivos.forEach(f => fd.append('arquivos', f))
      const res = await fetch('/api/importar/analisar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Não foi possível ler os arquivos.'); return }
      setAvisos(json.erros ?? [])
      if (!json.tutores || json.tutores.length === 0) {
        setErro('A IA não encontrou cadastros nos arquivos. Confira se os dados estão visíveis e tente novamente.')
        return
      }
      setTutores(json.tutores)
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setAnalisando(false)
    }
  }

  async function confirmar() {
    if (!tutores || salvando) return
    setErro(''); setSalvando(true)
    try {
      const res = await fetch('/api/importar/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutores }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Não foi possível salvar.'); return }
      setPronto({ tutores: json.tutores, pets: json.pets, ignorados: json.tutores_ignorados ?? 0 })
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  function atualizarTutor(i: number, campo: keyof Tutor, valor: string) {
    setTutores(ts => ts!.map((t, idx) => idx === i ? { ...t, [campo]: valor } : t))
  }
  function atualizarPet(ti: number, pi: number, campo: keyof Pet, valor: string) {
    setTutores(ts => ts!.map((t, idx) => idx !== ti ? t : {
      ...t, pets: t.pets.map((p, j) => j === pi ? { ...p, [campo]: valor } : p),
    }))
  }
  function removerTutor(i: number) { setTutores(ts => ts!.filter((_, idx) => idx !== i)) }
  function removerPet(ti: number, pi: number) {
    setTutores(ts => ts!.map((t, idx) => idx !== ti ? t : { ...t, pets: t.pets.filter((_, j) => j !== pi) }))
  }

  const totalPets = tutores?.reduce((s, t) => s + t.pets.length, 0) ?? 0

  // ---- Tela de sucesso ----
  if (pronto) {
    return (
      <div className="py-10 flex flex-col items-center text-center gap-3 max-w-md mx-auto">
        <CheckCircle2 size={56} className="text-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">Importação concluída!</h1>
        <p className="text-gray-600">
          Cadastramos <b>{pronto.tutores}</b> {pronto.tutores === 1 ? 'tutor' : 'tutores'} e{' '}
          <b>{pronto.pets}</b> {pronto.pets === 1 ? 'pet' : 'pets'} automaticamente.
        </p>
        {pronto.ignorados > 0 && (
          <p className="text-xs text-gray-400">{pronto.ignorados} tutor(es) já existiam e foram mantidos sem duplicar.</p>
        )}
        <div className="flex gap-2 mt-2">
          <Link href="/tutores"><Button variant="primary">Ver tutores</Button></Link>
          <Button variant="ghost" onClick={() => { setPronto(null); setTutores(null); setArquivos([]) }}>Importar mais</Button>
        </div>
      </div>
    )
  }

  // ---- Tela de revisão ----
  if (tutores) {
    return (
      <div className="py-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setTutores(null)} className="text-gray-400"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Confira antes de salvar</h1>
            <p className="text-sm text-gray-400">A IA leu <b>{tutores.length}</b> tutores e <b>{totalPets}</b> pets. Edite o que precisar e confirme.</p>
          </div>
        </div>

        {avisos.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm text-amber-700">
            {avisos.map((a, i) => <p key={i}>⚠️ {a}</p>)}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {tutores.map((t, ti) => (
            <div key={ti} className="bg-white rounded-3xl border border-gray-100 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-brand-purple" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                  <input value={t.nome} onChange={e => atualizarTutor(ti, 'nome', e.target.value)}
                    placeholder="Nome do tutor"
                    className="rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm px-3 py-2 font-semibold" />
                  <input value={t.telefone ?? ''} onChange={e => atualizarTutor(ti, 'telefone', e.target.value)}
                    placeholder="Telefone"
                    className="rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm px-3 py-2" />
                  <input value={t.email ?? ''} onChange={e => atualizarTutor(ti, 'email', e.target.value)}
                    placeholder="E-mail"
                    className="rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm px-3 py-2" />
                </div>
                <button onClick={() => removerTutor(ti)} className="text-gray-300 hover:text-red-500 flex-shrink-0 p-1"><Trash2 size={16} /></button>
              </div>

              {t.pets.map((p, pi) => (
                <div key={pi} className="flex items-center gap-2 pl-4 border-l-2 border-gray-100 ml-4">
                  <Dog size={16} className="text-brand-orange flex-shrink-0" />
                  <input value={p.nome} onChange={e => atualizarPet(ti, pi, 'nome', e.target.value)}
                    placeholder="Nome do pet"
                    className="flex-1 rounded-xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm px-3 py-1.5" />
                  <input value={p.raca ?? ''} onChange={e => atualizarPet(ti, pi, 'raca', e.target.value)}
                    placeholder="Raça"
                    className="flex-1 rounded-xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm px-3 py-1.5" />
                  <select value={p.porte} onChange={e => atualizarPet(ti, pi, 'porte', e.target.value)}
                    className="rounded-xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm px-2 py-1.5 bg-white">
                    {PORTES.map(po => <option key={po} value={po}>{po}</option>)}
                  </select>
                  <button onClick={() => removerPet(ti, pi)} className="text-gray-300 hover:text-red-500 flex-shrink-0 p-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

        <div className="sticky bottom-4 flex gap-2">
          <Button variant="ghost" onClick={() => setTutores(null)} className="flex-1">Voltar</Button>
          <Button variant="primary" loading={salvando} onClick={confirmar} className="flex-[2]">
            {salvando ? 'Salvando...' : `Confirmar e cadastrar (${tutores.length})`}
          </Button>
        </div>
      </div>
    )
  }

  // ---- Tela de upload ----
  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-gray-400"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar dados com IA</h1>
          <p className="text-sm text-gray-400">Traga seus tutores e pets de qualquer lugar — sem digitar tudo de novo.</p>
        </div>
      </div>

      <div className="bg-purple-50 border border-brand-purple/20 rounded-3xl p-4 flex gap-3">
        <Sparkles size={20} className="text-brand-purple flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">
          Envie <b>planilhas (Excel/CSV)</b>, <b>PDFs</b> ou <b>fotos das suas fichas</b>. A inteligência da Aupipet lê,
          organiza e prepara o cadastro de tutores, pets e portes. Você só revisa e confirma.
        </p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addArquivos(e.dataTransfer.files) }}
        className="border-2 border-dashed border-gray-300 rounded-3xl p-8 flex flex-col items-center gap-2 text-center cursor-pointer hover:border-brand-purple transition-colors"
      >
        <UploadCloud size={36} className="text-gray-400" />
        <p className="font-semibold text-gray-700">Arraste os arquivos aqui</p>
        <p className="text-xs text-gray-400">ou toque para escolher · Excel, CSV, PDF, JPG, PNG (até 15)</p>
        <input ref={inputRef} type="file" multiple hidden
          accept=".xlsx,.xls,.csv,.tsv,.pdf,image/*"
          onChange={e => addArquivos(e.target.files)} />
      </div>

      {arquivos.length > 0 && (
        <div className="flex flex-col gap-2">
          {arquivos.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-white rounded-2xl border border-gray-100 px-3 py-2">
              {iconeArquivo(f.name)}
              <span className="text-sm text-gray-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => setArquivos(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

      <Button variant="primary" size="lg" loading={analisando} disabled={arquivos.length === 0} onClick={analisar}>
        <Sparkles size={18} /> {analisando ? 'Lendo e organizando...' : 'Analisar com IA'}
      </Button>
      <p className="text-center text-xs text-gray-400">100% automático. Seus dados não são compartilhados com ninguém.</p>
    </div>
  )
}
