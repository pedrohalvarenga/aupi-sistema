'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { slugify, APP_HOST } from '@/lib/dominio'
import { fbTrack } from '@/lib/fbpixel'
import { gtagEvent } from '@/lib/gtag'
import { Globe } from 'lucide-react'

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

  // Pré-seleciona o segmento se veio do formulário do site (?segmento=)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('segmento')
    const mapa: Record<string, string> = { creche: 'creche', hotel: 'hotel', 'banho-tosa': 'banho_tosa', banho_tosa: 'banho_tosa', todos: 'completo', completo: 'completo' }
    if (p && mapa[p]) setSegmento(mapa[p])
  }, [])

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

    // Conversões — Meta Pixel e GA4 (importado no Google Ads como ação de conversão)
    fbTrack('CompleteRegistration')
    gtagEvent('sign_up', { method: 'email' })

    // Login automático e segue para o wizard de personalização da marca
    const supabase = createClient()
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (loginError) {
      // conta criada, mas login automático falhou: manda para o login com aviso
      router.push('/login?criada=1')
      return
    }
    router.push('/configurar')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#FBF5EC] to-white px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-lg flex items-center justify-center mb-4">
            <Image src="/logo-aupi.svg" alt="Aupipet" width={56} height={56} className="rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Crie sua conta</h1>
          <p className="text-gray-500 text-sm text-center">14 dias grátis, sem cartão de crédito</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Input
              id="nomeEmpresa"
              label="Nome do seu negócio"
              type="text"
              placeholder="Ex.: Creche Patinhas"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              required
            />
            {/* Preview do link próprio (subdomínio) — mostra desde o início */}
            <div className="rounded-2xl border border-dashed border-brand-purple/40 bg-purple-50/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-purple mb-0.5">
                <Globe size={13} /> Seu link de acesso será
              </div>
              <p className="text-sm font-bold text-gray-800 break-all leading-tight">
                {nomeEmpresa.trim()
                  ? <><span className="text-brand-purple">{slugify(nomeEmpresa) || 'sua-empresa'}</span>.{APP_HOST}</>
                  : <span className="text-gray-400">sua-empresa.{APP_HOST}</span>}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">É assim que você e seus clientes vão acessar o sistema.</p>
            </div>
          </div>

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
