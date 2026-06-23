import Link from 'next/link'
import {
  Dog, CalendarCheck, Moon, Scissors, Wallet, Upload, Users, Palette, CreditCard, ChevronRight, LifeBuoy,
} from 'lucide-react'

export const metadata = { title: 'Como usar · Aupipet' }

interface Passo {
  icon: React.ElementType
  titulo: string
  texto: string
  href: string
  cta: string
  destaque?: boolean
}

const PASSOS: Passo[] = [
  {
    icon: Dog,
    titulo: '1. Cadastre seu primeiro pet',
    texto: 'É o passo que destrava tudo. O tutor (dono do pet) entra no mesmo cadastro — e você pode fotografar o cartão de vacina que a IA preenche as datas sozinha.',
    href: '/pets/novo', cta: 'Cadastrar pet', destaque: true,
  },
  {
    icon: CalendarCheck,
    titulo: '2. Faça a chamada do dia',
    texto: 'Marque quem chegou (check-in) e quem foi embora (check-out). Em segundos você sabe quantos cães estão na creche agora.',
    href: '/creche', cta: 'Abrir a chamada',
  },
  {
    icon: Wallet,
    titulo: '3. Registre um pagamento',
    texto: 'Lance a primeira receita (uma diária, um pacote, um banho). O sistema passa a mostrar quanto você faturou no mês e quem está devendo.',
    href: '/financeiro', cta: 'Ir ao financeiro',
  },
  {
    icon: Upload,
    titulo: 'Importe seus dados de uma vez (IA)',
    texto: 'Está num caderno, planilha ou fichas de papel? Envie Excel, PDF ou fotos e a inteligência da Aupipet lê e cadastra tutores, pets, vacinas e saldos automaticamente.',
    href: '/importar', cta: 'Importar dados',
  },
  {
    icon: Moon,
    titulo: 'Hotel e reservas',
    texto: 'Controle hospedagens, check-in/out, diárias e extras. Use só se você oferece hotelzinho.',
    href: '/hotel', cta: 'Ver hotel',
  },
  {
    icon: Scissors,
    titulo: 'Banho & tosa',
    texto: 'Agende banhos e tosas, acompanhe a fila do dia e a entrega. Ative só se for um serviço seu.',
    href: '/banho-tosa', cta: 'Ver banho & tosa',
  },
  {
    icon: Users,
    titulo: 'Adicione sua equipe',
    texto: 'Cadastre funcionários e defina o que cada um pode ver e fazer. Cada pessoa entra com o próprio acesso.',
    href: '/funcionarios', cta: 'Gerenciar equipe',
  },
  {
    icon: Palette,
    titulo: 'Deixe com a sua marca',
    texto: 'Suba seu logo e escolha as cores. Seu cliente vê o sistema como se fosse seu — sem o nome Aupipet. (Mais fácil pelo computador.)',
    href: '/empresa', cta: 'Personalizar marca',
  },
  {
    icon: CreditCard,
    titulo: 'Escolher um plano',
    texto: 'Gostou? Assine para continuar usando depois do teste. Seus dados ficam guardados. Cartão renova sozinho todo mês.',
    href: '/assinar', cta: 'Ver planos',
  },
]

export default function AjudaPage() {
  return (
    <div className="py-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-brand-purple flex items-center justify-center shrink-0">
          <LifeBuoy size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Como usar a Aupipet</h1>
          <p className="text-gray-500 text-sm">Um guia rápido para colocar o seu negócio pra rodar hoje.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {PASSOS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`block rounded-2xl border p-4 active:opacity-90 ${p.destaque ? 'bg-purple-50 border-brand-purple/30' : 'bg-white border-gray-100 shadow-sm'}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${p.destaque ? 'bg-brand-purple' : 'bg-gray-100'}`}>
                <p.icon size={20} className={p.destaque ? 'text-white' : 'text-brand-purple'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{p.titulo}</p>
                <p className="text-sm text-gray-500 mt-0.5">{p.texto}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold mt-2" style={{ color: 'var(--brand-purple)' }}>
                  {p.cta} <ChevronRight size={15} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-center">
        <p className="text-sm font-semibold text-gray-700">Ficou com dúvida?</p>
        <p className="text-sm text-gray-500 mt-0.5">
          Fale com o assistente da Aupipet 24h — ele resolve na hora.
        </p>
        <Link href="/admin/suporte" className="inline-block mt-3 text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: 'var(--brand-purple)' }}>
          Abrir o assistente
        </Link>
      </div>
    </div>
  )
}
