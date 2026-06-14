import Link from 'next/link'

/**
 * Banner de aviso de vencimento da assinatura. Aparece nos últimos dias antes
 * de vencer e durante a carência (após o vencimento, antes do bloqueio).
 */
export default function AvisoVencimento({
  vencido,
  diasAteVencer,
  diasAteBloqueio,
  isAdmin,
}: {
  vencido: boolean
  diasAteVencer: number
  diasAteBloqueio: number
  isAdmin: boolean
}) {
  const cor = vencido
    ? { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B' }
    : { bg: '#FEF9C3', border: '#FDE047', text: '#854D0E' }

  const titulo = vencido
    ? 'Sua assinatura venceu'
    : diasAteVencer === 0
    ? 'Sua assinatura vence hoje'
    : `Sua assinatura vence em ${diasAteVencer} dia${diasAteVencer === 1 ? '' : 's'}`

  const detalhe = vencido
    ? `Pague para não perder o acesso. O sistema será bloqueado em ${Math.max(0, diasAteBloqueio)} dia${diasAteBloqueio === 1 ? '' : 's'}.`
    : 'Renove sua assinatura para continuar usando o sistema sem interrupção.'

  return (
    <div
      className="rounded-2xl p-4 mb-4 flex items-center gap-3"
      style={{ background: cor.bg, border: `1px solid ${cor.border}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: cor.text }}>{titulo}</p>
        <p className="text-xs" style={{ color: cor.text, opacity: 0.85 }}>{detalhe}</p>
      </div>
      {isAdmin && (
        <Link
          href="/assinar"
          className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-xl text-white"
          style={{ background: cor.text }}
        >
          {vencido ? 'Pagar agora' : 'Renovar'}
        </Link>
      )}
    </div>
  )
}
