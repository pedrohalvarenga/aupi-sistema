'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarCheck, Building2, Scissors, Dog, Users, DollarSign,
  Home, Settings, Car, Menu, X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { type UserRole, type Empresa } from '@/types'
import { podeAcessar, type AreaKey, type Permissoes } from '@/lib/permissoes'
import { useState } from 'react'

type ModuloCampo = 'mod_creche' | 'mod_hotel' | 'mod_banho_tosa' | 'mod_transporte' | 'mod_financeiro'

// ── Barra de acesso rápido ──────────────────────────────────
interface QuickItem {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
  modulo?: ModuloCampo
  area?: AreaKey
}

const quickItems: QuickItem[] = [
  { href: '/creche',     label: 'Chamada',    icon: CalendarCheck, roles: ['admin', 'recepcao'], modulo: 'mod_creche', area: 'creche' },
  { href: '/hotel',      label: 'Hotel',      icon: Building2,     roles: ['admin', 'recepcao'], modulo: 'mod_hotel', area: 'hotel' },
  { href: '/banho-tosa',   label: 'Banho',      icon: Scissors, roles: ['admin', 'recepcao', 'banho_tosa'], modulo: 'mod_banho_tosa', area: 'banho_tosa' },
  { href: '/transportes',  label: 'Corridas',   icon: Car,      roles: ['motorista'], modulo: 'mod_transporte', area: 'transporte' },
  { href: '/pets',         label: 'Pets',       icon: Dog,      roles: ['admin', 'recepcao', 'banho_tosa'], area: 'pets' },
  { href: '/tutores',    label: 'Tutores',    icon: Users,         roles: ['admin', 'recepcao'], area: 'tutores' },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign,    roles: ['admin', 'recepcao'], modulo: 'mod_financeiro', area: 'financeiro' },
]

// ── Menu "Mais" ─────────────────────────────────────────────
interface MoreItem {
  href: string
  label: string
  sublabel: string
  icon: React.ElementType
  roles: UserRole[]
  iconColor: string
  iconBg: string
  modulo?: ModuloCampo
  area?: AreaKey
}

const moreItems: MoreItem[] = [
  {
    href: '/dashboard',
    label: 'Início',
    sublabel: 'Painel geral do sistema',
    icon: Home,
    roles: ['admin', 'recepcao', 'banho_tosa'],
    iconColor: 'text-brand-purple',
    iconBg: 'bg-purple-100',
  },
  {
    href: '/admin',
    label: 'Administração',
    sublabel: 'Usuários e configurações',
    icon: Settings,
    roles: ['admin'],
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-100',
  },
  {
    href: '/transportes',
    label: 'Transportes',
    sublabel: 'Corridas de hoje e agenda do motorista',
    icon: Car,
    roles: ['admin', 'recepcao', 'motorista'],
    iconColor: 'text-brand-orange',
    iconBg: 'bg-orange-100',
    modulo: 'mod_transporte',
  },
]

export default function BottomNav({ role, empresa, permissoes }: { role: UserRole; empresa?: Empresa | null; permissoes?: Permissoes | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // mostra o item se: o papel permite E o módulo está ativo E o usuário tem a área liberada
  const moduloAtivo = (m?: ModuloCampo) => !m || !empresa || Boolean(empresa[m])
  const areaLiberada = (a?: AreaKey) => !a || podeAcessar(a, role, permissoes)
  const visibleQuick = quickItems.filter(i => i.roles.includes(role) && moduloAtivo(i.modulo) && areaLiberada(i.area))
  const visibleMore  = moreItems.filter(i => i.roles.includes(role) && moduloAtivo(i.modulo) && areaLiberada(i.area))

  return (
    <>
      {/* ── Barra inferior ─────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-40">
        <div className="flex items-stretch justify-around max-w-lg mx-auto">
          {visibleQuick.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2.5 flex-1 min-w-0 transition-colors',
                  active ? 'text-brand-purple' : 'text-gray-400'
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                <span className={cn(
                  'text-[9px] font-medium leading-none truncate w-full text-center px-0.5',
                  active ? 'text-brand-purple' : 'text-gray-400'
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Botão Mais */}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 py-2.5 flex-1 min-w-0 transition-colors',
              open ? 'text-brand-purple' : 'text-gray-400'
            )}
          >
            <Menu size={21} strokeWidth={open ? 2.5 : 2} />
            <span className="text-[9px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </nav>

      {/* ── Bottom sheet ───────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Painel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
            <div className="bg-white rounded-t-3xl shadow-2xl">
              {/* Alça */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              {/* Cabeçalho */}
              <div className="flex items-center justify-between px-5 pt-1 pb-3">
                <p className="font-bold text-gray-900">Mais opções</p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Itens */}
              <div className="px-4 pb-10 flex flex-col gap-2">
                {visibleMore.map(item => {
                  const Icon = item.icon
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors active:scale-[.98]',
                        active
                          ? 'bg-purple-50 border border-purple-100'
                          : 'bg-gray-50 active:bg-gray-100'
                      )}
                    >
                      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0', item.iconBg)}>
                        <Icon size={22} className={item.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('font-semibold text-sm', active ? 'text-brand-purple' : 'text-gray-900')}>
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.sublabel}</p>
                      </div>
                      {active && <span className="w-2 h-2 rounded-full bg-brand-purple flex-shrink-0" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
