'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, UploadCloud, FileSpreadsheet, FileText, Image as ImageIcon, Sparkles, Trash2, CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { ENTIDADES, type TipoEntidade, type Registro, type CampoDef } from '@/lib/importar-entidades'

const DESTINO: Record<TipoEntidade, string> = {
  funcionarios: '/funcionarios',
  fornecedores: '/fornecedores',
  financeiro: '/financeiro',
}

function iconeArquivo(nome: string) {
  if (/\.(xlsx|xls|csv|tsv)$/i.test(nome)) return <FileSpreadsheet size={18} className="text-green-600" />
  if (/\.pdf$/i.test(nome)) return <FileText size={18} className="text-red-500" />
  return <ImageIcon size={18} className="text-blue-500" />
}

function CampoInput({ campo, valor, onChange }: { campo: CampoDef; valor: string; onChange: (v: string) => void }) {
  const cls = 'rounded-xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm px-3 py-2 w-full bg-white'
  if (campo.tipo === 'select' && campo.options) {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)} className={cls}>
        {campo.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  return (
    <input
      value={valor}
      onChange={e => onChange(e.target.value)}
      placeholder={campo.label}
      inputMode={campo.tipo === 'number' ? 'decimal' : undefined}
      className={cls}
    />
  )
}

export default function ImportEntidade({ tipo, onVoltar }: { tipo: TipoEntidade; onVoltar: () => void }) {
  const config = ENTIDADES[tipo]
  const [arquivos, setArquivos] = useState<File[]>([])
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [avisos, setAvisos] = useState<string[]>([])
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [pronto, setPronto] = useState<{ criados: number; ignorados: number } | null>(null)
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
      fd.append('tipo', tipo)
      arquivos.forEach(f => fd.append('arquivos', f))
      const res = await fetch('/api/importar/entidade/analisar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Não foi possível ler os arquivos.'); return }
      setAvisos(json.erros ?? [])
      if (!json.registros || json.registros.length === 0) {
        setErro(`A IA não encontrou ${config.plural} nos arquivos. Confira se os dados estão visíveis e tente novamente.`)
        return
      }
      setRegistros(json.registros)
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setAnalisando(false)
    }
  }

  async function confirmar() {
    if (!registros || salvando) return
    setErro(''); setSalvando(true)
    try {
      const res = await fetch('/api/importar/entidade/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, registros }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Não foi possível salvar.'); return }
      setPronto({ criados: json.criados ?? 0, ignorados: json.ignorados ?? 0 })
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  function atualizar(i: number, key: string, valor: string) {
    setRegistros(rs => rs!.map((r, idx) => idx === i ? { ...r, [key]: valor } : r))
  }
  function remover(i: number) { setRegistros(rs => rs!.filter((_, idx) => idx !== i)) }

  // ---- Sucesso ----
  if (pronto) {
    return (
      <div className="py-10 flex flex-col items-center text-center gap-3 max-w-md mx-auto">
        <CheckCircle2 size={56} className="text-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">Importação concluída!</h1>
        <p className="text-gray-600">
          Cadastramos <b>{pronto.criados}</b> {pronto.criados === 1 ? config.singular : config.plural} automaticamente.
        </p>
        {pronto.ignorados > 0 && (
          <p className="text-xs text-gray-400">{pronto.ignorados} registro(s) já existiam ou estavam incompletos e foram ignorados.</p>
        )}
        <div className="flex gap-2 mt-2">
          <Link href={DESTINO[tipo]}><Button variant="primary">Ver {config.plural}</Button></Link>
          <Button variant="ghost" onClick={() => { setPronto(null); setRegistros(null); setArquivos([]) }}>Importar mais</Button>
        </div>
      </div>
    )
  }

  // ---- Revisão ----
  if (registros) {
    return (
      <div className="py-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setRegistros(null)} className="text-gray-400"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Confira antes de salvar</h1>
            <p className="text-sm text-gray-400">A IA leu <b>{registros.length}</b> {registros.length === 1 ? config.singular : config.plural}. Edite o que precisar e confirme.</p>
          </div>
        </div>

        {avisos.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm text-amber-700">
            {avisos.map((a, i) => <p key={i}>⚠️ {a}</p>)}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {registros.map((r, i) => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 p-4">
              <div className="flex items-start gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                  {config.campos.map(campo => (
                    <div key={campo.key} className={campo.key === 'descricao' || campo.key === 'nome_completo' || campo.key === 'nome' ? 'sm:col-span-2' : ''}>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold ml-1">{campo.label}</label>
                      <CampoInput campo={campo} valor={r[campo.key] ?? ''} onChange={v => atualizar(i, campo.key, v)} />
                    </div>
                  ))}
                </div>
                <button onClick={() => remover(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0 p-1"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

        <div className="sticky bottom-4 flex gap-2">
          <Button variant="ghost" onClick={() => setRegistros(null)} className="flex-1">Voltar</Button>
          <Button variant="primary" loading={salvando} onClick={confirmar} className="flex-[2]">
            {salvando ? 'Salvando...' : `Confirmar e cadastrar (${registros.length})`}
          </Button>
        </div>
      </div>
    )
  }

  // ---- Upload ----
  return (
    <div className="py-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <button onClick={onVoltar} className="text-gray-400"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar {config.plural}</h1>
          <p className="text-sm text-gray-400">Sem digitar tudo de novo — a IA lê e organiza pra você.</p>
        </div>
      </div>

      <div className="bg-purple-50 border border-brand-purple/20 rounded-3xl p-4 flex gap-3">
        <Sparkles size={20} className="text-brand-purple flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">{config.descricao} Envie <b>planilhas (Excel/CSV)</b>, <b>PDFs</b> ou <b>fotos</b>. Você só revisa e confirma.</p>
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
