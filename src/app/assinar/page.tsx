'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PLANOS, PLANO_TESTE } from '@/lib/planos'
import Button from '@/components/ui/Button'

type Metodo = 'cartao' | 'pix' | 'boleto'
type Etapa = 'escolha' | 'dados' | 'pix' | 'boleto'

function reais(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0 })
}
function valorReais(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Máscaras leves ──
const mascCpfCnpj = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}
const mascCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
const mascTel = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
const mascCartao = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
const mascValidade = (v: string) => v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2')

export default function AssinarPage() {
  const router = useRouter()
  const [teste, setTeste] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [plano, setPlano] = useState<string | null>(null)
  const [metodo, setMetodo] = useState<Metodo>('cartao')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  const [cliente, setCliente] = useState({ nome: '', cpfCnpj: '', email: '', telefone: '', cep: '', numero: '' })
  const [cartao, setCartao] = useState({ numero: '', nome: '', validade: '', cvv: '' })
  const [pix, setPix] = useState<{ imagem: string | null; copiaECola: string | null } | null>(null)
  const [boleto, setBoleto] = useState<{ url: string | null; linhaDigitavel: string | null } | null>(null)

  // Pré-preenche nome/e-mail a partir da conta logada.
  useEffect(() => {
    setTeste(new URLSearchParams(window.location.search).get('teste') === '1')
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('empresa_id, nome').eq('id', user.id).single()
      const empresaId = profile?.empresa_id
      let empNome = '', empTel = ''
      if (empresaId) {
        const { data: emp } = await supabase.from('empresas').select('nome, telefone, email_contato').eq('id', empresaId).single()
        empNome = emp?.nome || ''
        empTel = emp?.telefone || ''
      }
      setCliente((c) => ({
        ...c,
        nome: c.nome || empNome || profile?.nome || '',
        email: c.email || user.email || '',
        telefone: c.telefone || (empTel ? mascTel(empTel) : ''),
      }))
    })()
  }, [])

  // Polling de ativação (após gerar PIX/boleto).
  const aguardarAtivacao = useCallback(() => {
    let n = 0
    const t = setInterval(async () => {
      n++
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).single()
      if (!profile?.empresa_id) return
      const { data: emp } = await supabase.from('empresas').select('status').eq('id', profile.empresa_id).single()
      if (emp?.status === 'ativo') { clearInterval(t); router.push('/assinar/sucesso') }
      if (n > 200) clearInterval(t) // ~10 min
    }, 3000)
    return () => clearInterval(t)
  }, [router])

  const planoInfo = teste && plano === 'teste'
    ? PLANO_TESTE
    : PLANOS.find((p) => p.id === plano)

  async function pagar() {
    if (!plano) return
    setCarregando(true); setErro('')
    try {
      const res = await fetch('/api/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, metodo, cliente, cartao: metodo === 'cartao' ? cartao : undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Não foi possível processar o pagamento.'); return }

      if (json.tipo === 'cartao') {
        if (json.aprovado) { router.push('/assinar/sucesso'); return }
        // cartão em análise — webhook confirma; manda para a tela de espera
        router.push('/assinar/sucesso'); return
      }
      if (json.tipo === 'pix') {
        setPix(json.pix); setEtapa('pix'); aguardarAtivacao(); return
      }
      if (json.tipo === 'boleto') {
        setBoleto(json.boleto); setEtapa('boleto'); aguardarAtivacao(); return
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(true); setTimeout(() => setCopiado(false), 2500)
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-[var(--brand-purple)]'

  // ───────────────────────── ESCOLHA DE PLANO + MÉTODO ─────────────────────────
  if (etapa === 'escolha') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-gray-900 text-center">Escolha seu plano</h1>
        <p className="text-gray-500 text-sm text-center mb-5">Assinatura mensal — cancele quando quiser.</p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {([['cartao', 'Cartão'], ['pix', 'PIX'], ['boleto', 'Boleto']] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMetodo(m)}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${metodo === m ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
              style={metodo === m ? { background: 'var(--brand-purple)' } : undefined}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mb-5">
          {metodo === 'cartao' ? 'Débito automático todo mês no cartão — sem se preocupar.'
            : metodo === 'pix' ? 'Cobrança mensal por PIX — cai na hora, menor taxa.'
            : 'Boleto mensal — você recebe um novo a cada mês.'}
        </p>

        <div className="flex flex-col gap-3">
          {teste && (
            <PlanoCard nome={`${PLANO_TESTE.nome} 🧪`} preco="R$ 5,00" desc={PLANO_TESTE.descricao}
              tracejado onClick={() => { setPlano('teste'); setEtapa('dados') }} cta="Testar R$5" />
          )}
          {PLANOS.map((p) => (
            <PlanoCard key={p.id} nome={p.nome} preco={`R$ ${reais(p.precoCentavos)}/mês`} desc={p.descricao}
              destaque={p.destaque} onClick={() => { setPlano(p.id); setEtapa('dados') }} />
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-6">Pagamento seguro processado pela Aupipet.</p>
      </Shell>
    )
  }

  // ───────────────────────── DADOS + PAGAMENTO ─────────────────────────
  if (etapa === 'dados') {
    return (
      <Shell>
        <button onClick={() => setEtapa('escolha')} className="text-sm text-gray-400 mb-3">← Voltar</button>
        <h1 className="text-xl font-bold text-gray-900">
          {planoInfo?.nome} · {planoInfo ? valorReais(planoInfo.precoCentavos / 100) : ''}
          {plano !== 'teste' && <span className="text-sm font-normal text-gray-400">/mês</span>}
        </h1>
        <p className="text-gray-500 text-sm mb-5">
          {metodo === 'cartao' ? 'Pague com cartão — renovação automática.' : metodo === 'pix' ? 'Gere o PIX e pague na hora.' : 'Gere o boleto para pagar.'}
        </p>

        <div className="flex flex-col gap-3">
          <Field label="Nome completo ou razão social">
            <input className={inputCls} value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} placeholder="Seu nome" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF ou CNPJ">
              <input className={inputCls} value={cliente.cpfCnpj} inputMode="numeric"
                onChange={(e) => setCliente({ ...cliente, cpfCnpj: mascCpfCnpj(e.target.value) })} placeholder="000.000.000-00" />
            </Field>
            <Field label="Telefone">
              <input className={inputCls} value={cliente.telefone} inputMode="numeric"
                onChange={(e) => setCliente({ ...cliente, telefone: mascTel(e.target.value) })} placeholder="(00) 00000-0000" />
            </Field>
          </div>
          <Field label="E-mail">
            <input className={inputCls} value={cliente.email} type="email"
              onChange={(e) => setCliente({ ...cliente, email: e.target.value })} placeholder="voce@email.com" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CEP">
              <input className={inputCls} value={cliente.cep} inputMode="numeric"
                onChange={(e) => setCliente({ ...cliente, cep: mascCep(e.target.value) })} placeholder="00000-000" />
            </Field>
            <Field label="Número">
              <input className={inputCls} value={cliente.numero} inputMode="numeric"
                onChange={(e) => setCliente({ ...cliente, numero: e.target.value })} placeholder="123" />
            </Field>
          </div>

          {metodo === 'cartao' && (
            <div className="mt-2 pt-4 border-t border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">Dados do cartão</p>
              <Field label="Número do cartão">
                <input className={inputCls} value={cartao.numero} inputMode="numeric"
                  onChange={(e) => setCartao({ ...cartao, numero: mascCartao(e.target.value) })} placeholder="0000 0000 0000 0000" />
              </Field>
              <Field label="Nome impresso no cartão">
                <input className={inputCls} value={cartao.nome}
                  onChange={(e) => setCartao({ ...cartao, nome: e.target.value.toUpperCase() })} placeholder="COMO ESTÁ NO CARTÃO" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Validade">
                  <input className={inputCls} value={cartao.validade} inputMode="numeric"
                    onChange={(e) => setCartao({ ...cartao, validade: mascValidade(e.target.value) })} placeholder="MM/AA" />
                </Field>
                <Field label="CVV">
                  <input className={inputCls} value={cartao.cvv} inputMode="numeric"
                    onChange={(e) => setCartao({ ...cartao, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="000" />
                </Field>
              </div>
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-red-500 text-center mt-4">{erro}</p>}
        <Button onClick={pagar} disabled={carregando} className="w-full mt-5">
          {carregando ? 'Processando...'
            : metodo === 'cartao' ? `Pagar ${planoInfo ? valorReais(planoInfo.precoCentavos / 100) : ''}`
            : metodo === 'pix' ? 'Gerar PIX' : 'Gerar boleto'}
        </Button>
        <p className="text-[11px] text-gray-400 text-center mt-3">🔒 Seus dados trafegam criptografados. Não armazenamos o número do seu cartão.</p>
      </Shell>
    )
  }

  // ───────────────────────── PIX ─────────────────────────
  if (etapa === 'pix') {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-gray-900 text-center">Pague com PIX</h1>
        <p className="text-gray-500 text-sm text-center mb-5">Abra o app do seu banco, escaneie o código e a conta é liberada na hora.</p>
        {pix?.imagem && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${pix.imagem}`} alt="QR Code PIX" className="w-56 h-56 mx-auto rounded-xl border border-gray-100" />
        )}
        {pix?.copiaECola && (
          <div className="mt-5">
            <p className="text-xs text-gray-400 mb-1.5">PIX copia e cola</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 overflow-hidden">
                <p className="text-xs text-gray-500 truncate">{pix.copiaECola}</p>
              </div>
              <button onClick={() => copiar(pix.copiaECola!)}
                className={`px-4 py-2.5 rounded-xl font-semibold text-sm text-white ${copiado ? 'bg-green-500' : ''}`}
                style={!copiado ? { background: 'var(--brand-purple)' } : undefined}>
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-400">
          <span className="w-4 h-4 border-2 border-gray-300 border-t-[var(--brand-purple)] rounded-full animate-spin" />
          Aguardando confirmação do pagamento...
        </div>
      </Shell>
    )
  }

  // ───────────────────────── BOLETO ─────────────────────────
  return (
    <Shell>
      <h1 className="text-xl font-bold text-gray-900 text-center">Boleto gerado</h1>
      <p className="text-gray-500 text-sm text-center mb-5">Pague o boleto e sua conta é liberada após a compensação.</p>
      {boleto?.linhaDigitavel && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1.5">Linha digitável</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 overflow-hidden">
              <p className="text-xs text-gray-500 truncate">{boleto.linhaDigitavel}</p>
            </div>
            <button onClick={() => copiar(boleto.linhaDigitavel!)}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm text-white ${copiado ? 'bg-green-500' : ''}`}
              style={!copiado ? { background: 'var(--brand-purple)' } : undefined}>
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      )}
      {boleto?.url && (
        <a href={boleto.url} target="_blank" rel="noopener noreferrer"
          className="block w-full text-center py-3 rounded-xl font-semibold text-white" style={{ background: 'var(--brand-purple)' }}>
          Abrir boleto
        </a>
      )}
      <div className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-400">
        <span className="w-4 h-4 border-2 border-gray-300 border-t-[var(--brand-purple)] rounded-full animate-spin" />
        Aguardando compensação...
      </div>
    </Shell>
  )
}

// ── Subcomponentes ──
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FBF5EC] to-white px-6 py-10">
      <div className="w-full max-w-md mx-auto">{children}</div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 mb-1 block">{label}</span>
      {children}
    </label>
  )
}
function PlanoCard({ nome, preco, desc, destaque, tracejado, onClick, cta = 'Assinar' }: {
  nome: string; preco: string; desc: string; destaque?: boolean; tracejado?: boolean; onClick: () => void; cta?: string
}) {
  return (
    <div className={`bg-white rounded-2xl p-5 ${tracejado ? 'border-2 border-dashed border-gray-300' : destaque ? 'border-2' : 'border border-gray-100'}`}
      style={destaque && !tracejado ? { borderColor: 'var(--brand-purple)' } : undefined}>
      <div className="flex items-baseline justify-between mb-1">
        <p className="font-bold text-lg text-gray-900">{nome}</p>
        <p className="font-bold text-xl" style={{ color: 'var(--brand-purple)' }}>{preco}</p>
      </div>
      <p className="text-sm text-gray-500 mb-4">{desc}</p>
      <Button onClick={onClick} className="w-full" variant={tracejado ? 'ghost' : 'primary'}>{cta}</Button>
    </div>
  )
}
