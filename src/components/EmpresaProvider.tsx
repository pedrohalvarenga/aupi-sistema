'use client'

import { createContext, useContext } from 'react'
import type { Empresa } from '@/types'

const EmpresaContext = createContext<Empresa | null>(null)

export function useEmpresa() {
  return useContext(EmpresaContext)
}

/**
 * Disponibiliza a empresa (tenant) para os componentes client e
 * aplica o tema white label: as cores da empresa sobrescrevem as
 * CSS variables --brand-* usadas em todo o app.
 */
export default function EmpresaProvider({
  empresa,
  children,
}: {
  empresa: Empresa | null
  children: React.ReactNode
}) {
  const style = empresa
    ? ({
        '--brand-purple': empresa.cor_primaria,
        '--brand-purple-light': empresa.cor_primaria,
        '--brand-purple-dark': empresa.cor_primaria,
        '--brand-orange': empresa.cor_secundaria,
        '--color-brand-purple': empresa.cor_primaria,
        '--color-brand-purple-light': empresa.cor_primaria,
        '--color-brand-purple-dark': empresa.cor_primaria,
        '--color-brand-orange': empresa.cor_secundaria,
      } as React.CSSProperties)
    : undefined

  return (
    <EmpresaContext.Provider value={empresa}>
      <div style={style}>{children}</div>
    </EmpresaContext.Provider>
  )
}
