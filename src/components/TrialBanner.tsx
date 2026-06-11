'use client'

import Link from 'next/link'

interface Props {
  trialAte: string
  status: string
}

export default function TrialBanner({ trialAte, status }: Props) {
  if (status !== 'trial') return null

  const dias = Math.ceil(
    (new Date(trialAte + 'T23:59:59').getTime() - Date.now()) / 86400000
  )

  if (dias <= 0) return null

  const urgente = dias <= 3

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
      style={{
        background: urgente ? '#FEF2F2' : '#FBF5EC',
        border: `1px solid ${urgente ? '#FECACA' : '#F1E6D6'}`,
      }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: urgente ? '#DC2626' : '#2B1F14' }}>
          {dias === 1 ? 'Último dia de teste!' : `${dias} dias restantes no teste grátis`}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Assine agora e mantenha todos os seus dados.
        </p>
      </div>
      <Link
        href="https://aulado.com.br/#precos"
        target="_blank"
        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl text-white"
        style={{ background: 'var(--brand-caramel)' }}
      >
        Ver planos
      </Link>
    </div>
  )
}
