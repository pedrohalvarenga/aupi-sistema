import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmpresa, acessoBloqueado, statusAssinatura } from '@/lib/empresa'
import AvisoVencimento from '@/components/AvisoVencimento'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'
import EmpresaProvider from '@/components/EmpresaProvider'
import type { Profile } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || !profile.ativo) redirect('/login')

  // Super admin (Aupi) opera no painel próprio, sem tenant
  if (profile.role === 'super_admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
      </div>
    )
  }

  const empresa = await getEmpresa()
  if (!empresa) redirect('/login')

  if (acessoBloqueado(empresa)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {empresa.status === 'trial' ? 'Seu período de teste terminou' : 'Conta suspensa'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {empresa.status === 'trial'
              ? 'Assine um plano para continuar usando o sistema. Seus dados estão guardados em segurança.'
              : 'Identificamos uma pendência na assinatura. Regularize o pagamento para reativar o acesso.'}
          </p>
          <a
            href="/assinar"
            className="inline-block w-full py-3 rounded-xl font-semibold text-white mb-2"
            style={{ background: 'var(--brand-purple)' }}
          >
            Assinar agora
          </a>
          <a
            href="mailto:oi@aupipet.com.br"
            className="inline-block w-full py-2 rounded-xl font-semibold text-gray-500 text-sm"
          >
            Falar com a Aupi
          </a>
        </div>
      </div>
    )
  }

  const aviso = statusAssinatura(empresa)

  return (
    <EmpresaProvider empresa={empresa}>
      <div className="min-h-screen bg-gray-50">
        <TopBar nome={profile.nome} />
        <main className="pt-14 pb-24 max-w-lg mx-auto px-4">
          {(aviso.vencido || aviso.diasAteVencer <= 5) && (
            <AvisoVencimento
              vencido={aviso.vencido}
              diasAteVencer={aviso.diasAteVencer}
              diasAteBloqueio={aviso.diasAteBloqueio}
              isAdmin={profile.role === 'admin'}
            />
          )}
          {children}
        </main>
        <BottomNav role={profile.role} empresa={empresa} permissoes={profile.permissoes} />
      </div>
    </EmpresaProvider>
  )
}
