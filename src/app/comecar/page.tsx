'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const SEGMENTOS = [
  { valor: 'creche', label: 'Creche' },
  { valor: 'hotel', label: 'Hotel' },
  { valor: 'banho_tosa', label: 'Banho & Tosa' },
  { valor: 'completo', label: 'Tudo' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [segmento, setSegmento] = useState('completo')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeEmpresa, segmento, nome, email, senha, whatsapp }),
    })
    const json = await res.json()

    if (!res.ok) {
      setErro(json.error || 'Não foi possível criar a conta')
      setLoading(false)
      return
    }

    // Login automático e direto para o painel
    const supabase = createClient()
    await supabase.auth.signInWithPassword({ email, password: senha })
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#FBF5EC] to-white px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-lg flex items-center justify-center mb-4">
            <Image src="/logo-aulado.svg" alt="Aulado" width={56} height={56} className="rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Crie sua conta</h1>
          <p className="text-gray-500 text-sm text-center">14 dias grátis, sem cartão de crédito</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="nomeEmpresa"
            label="Nome do seu negócio"
            type="text"
            placeholder="Ex.: Creche Patinhas"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">O que você oferece?</label>
            <div className="grid grid-cols-4 gap-2">
              {SEGMENTOS.map((s) => (
                <button
                  key={s.valor}
                  type="button"
                  onClick={() => setSegmento(s.valor)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-colors ${
                    segmento === s.valor
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                  style={segmento === s.valor ? { background: 'var(--brand-purple)' } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            id="nome"
            label="Seu nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <Input
            id="whatsapp"
            label="WhatsApp (opcional)"
            type="tel"
            placeholder="(32) 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          <Input
            id="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="senha"
            label="Senha (mínimo 8 caracteres)"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          {erro && <p className="text-sm text-red-500 text-center">{erro}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? 'Criando sua conta...' : 'Começar agora — grátis'}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            Ao criar a conta você concorda com os Termos de Uso e a Política de Privacidade.
          </p>
        </form>
      </div>
    </div>
  )
}
