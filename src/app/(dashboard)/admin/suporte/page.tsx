'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Headset, Sparkles, CheckCircle2, Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Msg = { role: 'user' | 'assistant'; content: string }

const SAUDACAO: Msg = {
  role: 'assistant',
  content: 'Oi! Sou a assistente do Aupipet 🐾 Como posso te ajudar com o sistema hoje? Se preferir falar com uma pessoa da nossa equipe, é só tocar em "Falar com a equipe Aupipet" aqui embaixo.',
}

export default function SuportePage() {
  const [messages, setMessages] = useState<Msg[]>([SAUDACAO])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Escalonamento humano
  const [modoHumano, setModoHumano] = useState(false)
  const [contato, setContato] = useState('')
  const [escalando, setEscalando] = useState(false)
  const [escalado, setEscalado] = useState(false)

  const fimRef = useRef<HTMLDivElement>(null)
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, escalando, escalado, modoHumano])

  async function enviar() {
    const texto = input.trim()
    if (!texto || enviando) return
    setErro('')
    const novas = [...messages, { role: 'user' as const, content: texto }]
    setMessages(novas)
    setInput('')
    setEnviando(true)
    try {
      const res = await fetch('/api/suporte/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: novas.filter(m => m !== SAUDACAO) }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Não foi possível responder.'); setEnviando(false); return }
      setMessages([...novas, { role: 'assistant', content: json.reply }])
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  async function escalar() {
    if (escalando) return
    setErro(''); setEscalando(true)
    try {
      const res = await fetch('/api/suporte/escalar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contato: contato.trim() || undefined,
          messages: messages.filter(m => m !== SAUDACAO),
          mensagem: messages.filter(m => m !== SAUDACAO).length === 0 ? contato.trim() : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Não foi possível enviar.'); setEscalando(false); return }
      setEscalado(true)
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setEscalando(false)
    }
  }

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-gray-400"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Falar com o Aupipet</h1>
          <p className="text-sm text-gray-400">Tire dúvidas com a IA na hora ou fale com a nossa equipe</p>
        </div>
      </div>

      {/* Janela do chat */}
      <div className="bg-white rounded-3xl border border-gray-100 p-4 flex flex-col gap-3 min-h-[50vh]">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={
              m.role === 'user'
                ? 'max-w-[85%] bg-brand-purple text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap'
                : 'max-w-[85%] bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm whitespace-pre-wrap'
            }>
              {m.role === 'assistant' && i === 0 && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-purple mb-1"><Sparkles size={12} /> Assistente IA</span>
              )}
              {m.content}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:.15s]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:.3s]" />
              </span>
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

      {/* Caixa de envio */}
      {!escalado && (
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder="Escreva sua dúvida..."
            rows={1}
            className="flex-1 resize-none rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white px-4 py-3 max-h-32"
          />
          <button
            onClick={enviar}
            disabled={enviando || !input.trim()}
            className="w-12 h-12 rounded-2xl bg-brand-purple text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {/* Escalonamento humano */}
      {escalado ? (
        <div className="bg-green-50 border border-green-200 rounded-3xl p-5 text-center flex flex-col items-center gap-2">
          <CheckCircle2 size={40} className="text-green-500" />
          <p className="font-bold text-gray-900">Recebemos sua mensagem!</p>
          <p className="text-sm text-gray-600 flex items-center gap-1.5">
            <Clock size={15} /> Nossa equipe vai responder em até <b>48 horas</b>.
          </p>
          <p className="text-xs text-gray-400">Você pode continuar usando o sistema normalmente enquanto isso.</p>
        </div>
      ) : modoHumano ? (
        <div className="bg-orange-50 border border-brand-orange/30 rounded-3xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Headset size={18} className="text-brand-orange" />
            <p className="font-bold text-gray-800">Falar com a equipe Aupipet</p>
          </div>
          <p className="text-xs text-gray-500">
            Vamos encaminhar sua conversa para a nossa equipe. O retorno acontece em até <b>48 horas</b>.
            Confirme o melhor e-mail ou WhatsApp para resposta (opcional).
          </p>
          <input
            value={contato}
            onChange={e => setContato(e.target.value)}
            placeholder="E-mail ou WhatsApp para retorno"
            className="rounded-2xl border-2 border-gray-200 focus:border-brand-orange outline-none text-sm bg-white px-4 py-3"
          />
          <div className="flex gap-2">
            <button onClick={() => setModoHumano(false)} className="flex-1 py-3 rounded-2xl font-semibold text-sm text-gray-500 border border-gray-200">
              Voltar
            </button>
            <button
              onClick={escalar}
              disabled={escalando}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white bg-brand-orange disabled:opacity-50"
            >
              {escalando ? 'Enviando...' : 'Enviar para a equipe'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setModoHumano(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm text-brand-orange border border-brand-orange/40 bg-orange-50/50"
        >
          <Headset size={17} /> Falar com a equipe Aupipet
        </button>
      )}
    </div>
  )
}
