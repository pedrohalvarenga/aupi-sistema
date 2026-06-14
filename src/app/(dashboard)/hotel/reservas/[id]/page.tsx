'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LogIn, LogOut, Edit, X, Check, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatDate, formatDateTime, formatTime } from '@/lib/utils'
import { STATUS_HOTEL_CORES, STATUS_HOTEL_LABELS, calcNoites, formatCurrencyHotel } from '@/lib/hotel'
import type { Hospedagem } from '@/types/hotel'

export default function ReservaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [h, setH] = useState<Hospedagem | null>(null)
  const [loading, setLoading] = useState(true)
  const [agindo, setAgindo] = useState(false)

  // Checkout modal
  const [showCheckout, setShowCheckout] = useState(false)
  const [valorTotal, setValorTotal] = useState('')
  const [valorExtras, setValorExtras] = useState('')
  const [extrasDesc, setExtrasDesc] = useState('')
  const [formaPag, setFormaPag] = useState('pix')
  const [statusPagCheckout, setStatusPagCheckout] = useState<'pago' | 'pendente'>('pago')
  const [savingCheckout, setSavingCheckout] = useState(false)

  // Payment modal ("Registrar pagamento")
  const [showPagamento, setShowPagamento] = useState(false)
  const [valorPagamento, setValorPagamento] = useState('')
  const [formaPagPagamento, setFormaPagPagamento] = useState('pix')
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().split('T')[0])
  const [savingPagamento, setSavingPagamento] = useState(false)

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('hospedagens')
      .select('*, pet:pets(*, tutor:tutores(nome, telefone, whatsapp))')
      .eq('id', id)
      .single()
    setH(data as Hospedagem)
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  // Preenche valor sugerido no modal de checkout
  useEffect(() => {
    if (!h || !showCheckout) return
    const noites = calcNoites(
      h.checkin_real ?? h.checkin_previsto,
      h.checkout_previsto
    )
    setValorTotal((noites * h.valor_diaria).toFixed(2).replace('.', ','))
  }, [h, showCheckout])

  // Preenche valor sugerido no modal de pagamento
  useEffect(() => {
    if (!h || !showPagamento) return
    const noites = calcNoites(
      h.checkin_real ?? h.checkin_previsto,
      h.checkout_real ?? h.checkout_previsto
    )
    const sugerido = h.valor_total ?? noites * h.valor_diaria
    setValorPagamento(sugerido.toFixed(2).replace('.', ','))
    setDataPagamento(new Date().toISOString().split('T')[0])
  }, [h, showPagamento])

  async function fazerCheckin() {
    setAgindo(true)
    const supabase = createClient()
    await supabase.from('hospedagens').update({
      status: 'hospedado',
      checkin_real: new Date().toISOString(),
    }).eq('id', id)
    await carregar()
    setAgindo(false)
  }

  async function confirmarCheckout() {
    if (!h) return
    setSavingCheckout(true)
    const supabase = createClient()
    const total = parseFloat(valorTotal.replace(',', '.')) || 0
    const extras = parseFloat(valorExtras.replace(',', '.')) || 0
    const valorFinal = total + extras
    const jaPago = h.status_pagamento === 'pago'

    // Registra hospedagem como finalizada
    const updates: Record<string, unknown> = {
      status: 'finalizada',
      checkout_real: new Date().toISOString(),
      valor_total: valorFinal,
      valor_extras: extras,
      extras_descricao: extrasDesc || null,
    }

    const pet = h.pet as NonNullable<Hospedagem['pet']>
    const descricao = `Hotel — ${pet?.nome} (${formatDate(h.checkin_previsto, 'dd/MM')} → ${formatDate(h.checkout_previsto, 'dd/MM')})`

    if (jaPago && h.receita_id) {
      // Pagamento já registrado: NÃO cria receita duplicada, só atualiza o valor existente
      if (valorFinal > 0) {
        await supabase.from('receitas').update({ valor: valorFinal }).eq('id', h.receita_id)
      }
      await supabase.from('hospedagens').update(updates).eq('id', id)
    } else if (valorFinal > 0) {
      // Pendente: cria receita com o status escolhido (pago agora ou pendente)
      const { data: recData } = await supabase.from('receitas').insert({
        data: new Date().toISOString().split('T')[0],
        valor: valorFinal,
        area: 'hotel',
        categoria: 'hotel',
        forma_pagamento: formaPag,
        status: statusPagCheckout,
        descricao,
        tutor_id: pet?.tutor_id,
        pet_id: pet?.id,
      }).select().single()

      if (recData?.id) {
        updates.receita_id = recData.id
        if (statusPagCheckout === 'pago') updates.status_pagamento = 'pago'
      }
      await supabase.from('hospedagens').update(updates).eq('id', id)
    } else {
      await supabase.from('hospedagens').update(updates).eq('id', id)
    }

    setSavingCheckout(false)
    setShowCheckout(false)
    await carregar()
  }

  async function registrarPagamento() {
    if (!h) return
    const valor = parseFloat(valorPagamento.replace(',', '.')) || 0
    if (valor <= 0) return
    setSavingPagamento(true)
    const supabase = createClient()
    const pet = h.pet as NonNullable<Hospedagem['pet']>

    const { data: recData } = await supabase.from('receitas').insert({
      data: dataPagamento,
      valor,
      area: 'hotel',
      categoria: 'hotel',
      forma_pagamento: formaPagPagamento,
      status: 'pago',
      descricao: `Hotel — ${pet?.nome} (${formatDate(h.checkin_previsto, 'dd/MM')} → ${formatDate(h.checkout_previsto, 'dd/MM')})`,
      tutor_id: pet?.tutor_id,
      pet_id: pet?.id,
    }).select().single()

    await supabase.from('hospedagens').update({
      status_pagamento: 'pago',
      ...(recData?.id ? { receita_id: recData.id } : {}),
    }).eq('id', id)

    setSavingPagamento(false)
    setShowPagamento(false)
    await carregar()
  }

  async function cancelar() {
    if (!motivoCancel.trim()) return
    setAgindo(true)
    const supabase = createClient()
    await supabase.from('hospedagens').update({
      status: 'cancelada',
      motivo_cancelamento: motivoCancel.trim(),
    }).eq('id', id)
    setShowCancel(false)
    setAgindo(false)
    await carregar()
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <span className="w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )

  if (!h) return <div className="py-6 text-center text-gray-500">Reserva não encontrada.</div>

  const pet = h.pet as NonNullable<Hospedagem['pet']>
  const noites = calcNoites(
    h.checkin_real ?? h.checkin_previsto,
    h.checkout_real ?? h.checkout_previsto
  )
  const valorEstimado = noites * h.valor_diaria

  return (
    <div className="py-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/hotel/reservas" className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Reserva</h1>
        </div>
        {h.status !== 'cancelada' && (
          <Link href={`/hotel/reservas/${id}/editar`} className="p-2 rounded-xl text-gray-400">
            <Edit size={20} />
          </Link>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUS_HOTEL_CORES[h.status]}`}>
          {STATUS_HOTEL_LABELS[h.status]}
        </span>
        {h.status !== 'cancelada' && (
          h.status_pagamento === 'pago' ? (
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700">
              ✓ Pago
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700">
              ⏳ Pendente
            </span>
          )
        )}
      </div>

      {/* Pet info */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-2xl">🐾</div>
          <div>
            <p className="text-xl font-bold text-gray-900">{pet?.nome}</p>
            <p className="text-sm text-gray-500">{pet?.tutor?.nome}</p>
            {pet?.tutor?.telefone && (
              <p className="text-xs text-gray-400">{pet?.tutor?.telefone}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Datas */}
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><LogIn size={12} /> Check-in previsto</p>
            <p className="font-semibold text-gray-800">{formatDate(h.checkin_previsto, 'dd/MM/yyyy')}</p>
            <p className="text-sm text-gray-500">{formatTime(h.checkin_previsto)}</p>
            {h.checkin_real && (
              <p className="text-xs text-green-600 mt-1 font-semibold">
                ✓ Real: {formatDateTime(h.checkin_real)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><LogOut size={12} /> Check-out previsto</p>
            <p className="font-semibold text-gray-800">{formatDate(h.checkout_previsto, 'dd/MM/yyyy')}</p>
            <p className="text-sm text-gray-500">{formatTime(h.checkout_previsto)}</p>
            {h.checkout_real && (
              <p className="text-xs text-green-600 mt-1 font-semibold">
                ✓ Real: {formatDateTime(h.checkout_real)}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Valor */}
      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">Diária</p>
            <p className="font-bold text-gray-900">{formatCurrencyHotel(h.valor_diaria)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Noites</p>
            <p className="font-bold text-gray-900">{noites}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">{h.valor_total != null ? 'Total pago' : 'Estimado'}</p>
            <p className={`font-bold ${h.valor_total != null ? 'text-brand-purple' : 'text-gray-900'}`}>
              {formatCurrencyHotel(h.valor_total ?? valorEstimado)}
            </p>
          </div>
        </div>
        {h.valor_extras != null && h.valor_extras > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Extras: {formatCurrencyHotel(h.valor_extras)}</p>
            {h.extras_descricao && <p className="text-xs text-gray-500">{h.extras_descricao}</p>}
          </div>
        )}
      </Card>

      {/* Pagamento */}
      {h.status !== 'cancelada' && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Pagamento</p>
              {h.status_pagamento === 'pago' ? (
                <p className="font-bold text-green-600 flex items-center gap-1">
                  <Check size={16} /> Pago — {formatCurrencyHotel(h.valor_total ?? valorEstimado)}
                </p>
              ) : (
                <p className="font-bold text-amber-600">
                  Pendente — {formatCurrencyHotel(h.valor_total ?? valorEstimado)}
                </p>
              )}
            </div>
            {h.status_pagamento !== 'pago' && (
              <button
                onClick={() => setShowPagamento(true)}
                className="px-4 py-2 rounded-2xl bg-green-500 text-white font-bold text-sm flex items-center gap-2 active:bg-green-600"
              >
                <DollarSign size={16} /> Receber
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Observações */}
      {h.observacoes && (
        <Card>
          <p className="text-xs text-gray-400 mb-1">Observações</p>
          <p className="text-sm text-gray-700">{h.observacoes}</p>
        </Card>
      )}

      {/* Cancelamento */}
      {h.motivo_cancelamento && (
        <Card className="border-l-4 border-red-300">
          <p className="text-xs text-gray-400 mb-1">Motivo do cancelamento</p>
          <p className="text-sm text-gray-700">{h.motivo_cancelamento}</p>
        </Card>
      )}

      {/* Ações */}
      {h.status === 'reservada' && (
        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={fazerCheckin}
            disabled={agindo}
            className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-lg flex items-center justify-center gap-3 active:bg-green-600 disabled:opacity-50"
          >
            <LogIn size={24} />
            {agindo ? 'Registrando...' : 'Fazer Check-in agora'}
          </button>
          <button
            onClick={() => setShowCancel(true)}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <X size={18} /> Cancelar reserva
          </button>
        </div>
      )}

      {h.status === 'hospedado' && (
        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full py-4 rounded-2xl bg-brand-orange text-white font-bold text-lg flex items-center justify-center gap-3 active:bg-orange-600"
          >
            <LogOut size={24} />
            Fazer Check-out agora
          </button>
          <button
            onClick={() => setShowCancel(true)}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <X size={18} /> Cancelar hospedagem
          </button>
        </div>
      )}

      {/* Editar (datas, horários e valor) — visível em reservada, hospedado e finalizada */}
      {h.status !== 'cancelada' && (
        <Link
          href={`/hotel/reservas/${id}/editar`}
          className="w-full py-3 rounded-2xl border-2 border-brand-purple/30 text-brand-purple font-semibold text-sm flex items-center justify-center gap-2 active:bg-purple-50"
        >
          <Edit size={18} /> Editar datas, horários e valor
        </Link>
      )}

      {/* Modal Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Finalizar Check-out</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Valor total (R$) — {noites} noite{noites !== 1 ? 's' : ''} × R$ {h.valor_diaria.toFixed(2).replace('.', ',')}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={valorTotal}
                onChange={e => setValorTotal(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Extras (R$)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={valorExtras}
                onChange={e => setValorExtras(e.target.value)}
                placeholder="0,00"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
              />
            </div>

            {parseFloat(valorExtras.replace(',', '.')) > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Descrição dos extras
                </label>
                <input
                  type="text"
                  value={extrasDesc}
                  onChange={e => setExtrasDesc(e.target.value)}
                  placeholder="Banho, medicação..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
                />
              </div>
            )}

            {h.status_pagamento === 'pago' ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <Check size={18} /> Pagamento já registrado
                </p>
                <p className="text-xs text-green-600 mt-1">
                  O caixa não será afetado novamente. O valor da receita será atualizado para o total final.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                    Forma de pagamento
                  </label>
                  <select
                    value={formaPag}
                    onChange={e => setFormaPag(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                    Status do pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['pago', 'pendente'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatusPagCheckout(s)}
                        className={`py-3 rounded-2xl font-semibold text-sm border-2 transition-colors ${
                          statusPagCheckout === s
                            ? s === 'pago'
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-amber-400 bg-amber-50 text-amber-700'
                            : 'border-gray-200 text-gray-500'
                        }`}
                      >
                        {s === 'pago' ? 'Pago agora' : 'Pendente'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="bg-purple-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500">Total a cobrar</p>
              <p className="text-2xl font-bold text-brand-purple">
                {formatCurrencyHotel(
                  (parseFloat(valorTotal.replace(',', '.')) || 0) +
                  (parseFloat(valorExtras.replace(',', '.')) || 0)
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                Cancelar
              </button>
              <Button variant="primary" loading={savingCheckout} onClick={confirmarCheckout}>
                <Check size={18} /> Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar pagamento */}
      {showPagamento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900">Registrar pagamento</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Valor (R$)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={valorPagamento}
                onChange={e => setValorPagamento(e.target.value)}
                placeholder="0,00"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Forma de pagamento
              </label>
              <select
                value={formaPagPagamento}
                onChange={e => setFormaPagPagamento(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Data do recebimento
              </label>
              <input
                type="date"
                value={dataPagamento}
                onChange={e => setDataPagamento(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-sm bg-white"
              />
            </div>

            <div className="bg-green-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500">Receita a registrar (paga)</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrencyHotel(parseFloat(valorPagamento.replace(',', '.')) || 0)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowPagamento(false)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                Cancelar
              </button>
              <Button
                variant="primary"
                loading={savingPagamento}
                onClick={registrarPagamento}
                className="bg-green-500 hover:bg-green-600"
              >
                <Check size={18} /> Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900">Cancelar reserva</h2>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Motivo *
              </label>
              <textarea
                rows={3}
                value={motivoCancel}
                onChange={e => setMotivoCancel(e.target.value)}
                placeholder="Explique o motivo do cancelamento..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-red-400 outline-none text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCancel(false)}
                className="py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold"
              >
                Voltar
              </button>
              <button
                onClick={cancelar}
                disabled={!motivoCancel.trim() || agindo}
                className="py-3 rounded-2xl bg-red-500 text-white font-bold disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
