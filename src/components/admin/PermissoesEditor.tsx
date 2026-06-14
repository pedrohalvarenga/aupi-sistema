'use client'

import { AREAS, permissoesPadrao, type Permissoes } from '@/lib/permissoes'
import type { UserRole } from '@/types'
import { Check } from 'lucide-react'

/**
 * Editor de áreas visíveis por usuário. O admin parte do padrão do papel
 * e pode DESMARCAR áreas para restringir. Áreas que o papel não usa ficam
 * indisponíveis (os dados são protegidos por RLS pelo papel).
 */
export default function PermissoesEditor({
  role, value, onChange,
}: {
  role: UserRole
  value: Permissoes
  onChange: (p: Permissoes) => void
}) {
  if (role === 'admin') {
    return (
      <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
        Administrador tem acesso total a todas as áreas.
      </p>
    )
  }

  const base = permissoesPadrao(role)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-400">
        Marque as áreas que este usuário pode ver. O padrão vem do perfil — desmarque para restringir.
      </p>
      {AREAS.map(a => {
        const disponivel = Boolean(base[a.key])
        const marcado = disponivel && (value[a.key] ?? true)
        return (
          <button
            key={a.key}
            type="button"
            disabled={!disponivel}
            onClick={() => onChange({ ...value, [a.key]: !marcado })}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left transition-colors ${
              !disponivel
                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                : marcado
                  ? 'border-brand-purple/40 bg-purple-50'
                  : 'border-gray-200 bg-white'
            }`}
          >
            <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${marcado ? 'bg-brand-purple text-white' : 'border-2 border-gray-300'}`}>
              {marcado && <Check size={13} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-800">{a.label}</span>
              <span className="block text-xs text-gray-400">
                {disponivel ? a.desc : 'Indisponível para este perfil'}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
