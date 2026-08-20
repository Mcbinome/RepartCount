import type { Balance, Expense, Settlement, Trip } from '../types'
import {
  computeBalances,
  computeSettlements,
  expenseDate,
  expenseShareBreakdown,
  formatExpenseDate,
  formatMoney,
} from './calculations'

interface ParticipantExpenseLine {
  expense: Expense
  payerName: string
  shareAmount: number
  shares: number
  paidByMe: boolean
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function money(amount: number): string {
  return formatMoney(amount).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ')
}

function getParticipantExpenseLines(
  trip: Trip,
  participantId: string,
): ParticipantExpenseLine[] {
  const byId = new Map(trip.participants.map((p) => [p.id, p.name]))

  return trip.expenses
    .filter(
      (expense) =>
        expense.paidBy === participantId ||
        expense.participantIds.includes(participantId),
    )
    .map((expense) => {
      const breakdown = expenseShareBreakdown(expense, trip.participants)
      const mine = breakdown.find((row) => row.id === participantId)
      return {
        expense,
        payerName: byId.get(expense.paidBy) ?? '?',
        shareAmount: mine?.amount ?? 0,
        shares: mine?.shares ?? 0,
        paidByMe: expense.paidBy === participantId,
      }
    })
    .sort((a, b) => {
      const byDate = expenseDate(b.expense).localeCompare(expenseDate(a.expense))
      if (byDate !== 0) return byDate
      return a.expense.title.localeCompare(b.expense.title, 'fr')
    })
}

function netLabel(balance: Balance): string {
  if (balance.net > 0.005) return `À recevoir : ${money(balance.net)}`
  if (balance.net < -0.005) return `À rembourser : ${money(Math.abs(balance.net))}`
  return 'Solde : équilibré'
}

function settlementLinesFor(
  participantId: string,
  settlements: Settlement[],
): string[] {
  const mine = settlements.filter(
    (s) => s.fromId === participantId || s.toId === participantId,
  )
  if (mine.length === 0) return ['Aucun règlement à effectuer.']

  return mine.map((s) => {
    if (s.fromId === participantId) {
      return `Vous devez ${money(s.amount)} à ${s.toName}`
    }
    return `${s.fromName} vous doit ${money(s.amount)}`
  })
}

async function buildParticipantPdf(trip: Trip, participantIds?: string[]) {
  const { jsPDF } = await import('jspdf')
  const balances = computeBalances(trip)
  const settlements = computeSettlements(balances)
  const selected = participantIds
    ? balances.filter((b) => participantIds.includes(b.participantId))
    : balances.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 16

  selected.forEach((balance, index) => {
    if (index > 0) doc.addPage()

    const maxWidth = pageWidth - margin * 2
    let y = margin

    const ensureSpace = (needed: number) => {
      const pageHeight = doc.internal.pageSize.getHeight()
      if (y + needed > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(15, 107, 92)
    doc.text('RepartCount', margin, y)
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(74, 88, 84)
    doc.text(`Groupe : ${trip.name}`, margin, y)
    y += 6
    doc.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
      margin,
      y,
    )
    y += 12

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(26, 36, 33)
    doc.text(balance.name, margin, y)
    y += 10

    doc.setDrawColor(212, 203, 184)
    doc.setFillColor(247, 255, 252)
    doc.roundedRect(margin, y, maxWidth, 28, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(26, 36, 33)
    doc.text(`A payé : ${money(balance.paid)}`, margin + 4, y + 8)
    doc.text(`Sa part totale : ${money(balance.owed)}`, margin + 4, y + 16)
    doc.setFont('helvetica', 'bold')
    doc.text(netLabel(balance), margin + 4, y + 24)
    y += 36

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Règlements', margin, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    for (const line of settlementLinesFor(balance.participantId, settlements)) {
      ensureSpace(8)
      const wrapped = doc.splitTextToSize(line, maxWidth)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 5.5 + 2
    }
    y += 6

    const lines = getParticipantExpenseLines(trip, balance.participantId)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(26, 36, 33)
    doc.text('Récapitulatif des dépenses', margin, y)
    y += 8

    if (lines.length === 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(74, 88, 84)
      doc.text('Aucune dépense pour ce participant.', margin, y)
      return
    }

    for (const line of lines) {
      ensureSpace(22)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(26, 36, 33)
      const title = doc.splitTextToSize(line.expense.title, maxWidth - 40)
      doc.text(title, margin, y)
      doc.text(money(line.expense.amount), pageWidth - margin, y, {
        align: 'right',
      })
      y += title.length * 5 + 1

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(74, 88, 84)
      const detail = [
        formatExpenseDate(line.expense),
        `Payé par ${line.payerName}${line.paidByMe ? ' (vous)' : ''}`,
        `Votre part : ${money(line.shareAmount)} (${line.shares} part${line.shares !== 1 ? 's' : ''})`,
      ].join(' · ')
      const wrappedDetail = doc.splitTextToSize(detail, maxWidth)
      doc.text(wrappedDetail, margin, y)
      y += wrappedDetail.length * 4.5 + 6
    }
  })

  return doc
}

export async function downloadParticipantPdf(
  trip: Trip,
  participantId: string,
): Promise<void> {
  const participant = trip.participants.find((p) => p.id === participantId)
  if (!participant) return

  const doc = await buildParticipantPdf(trip, [participantId])
  const group = slugify(trip.name) || 'groupe'
  const person = slugify(participant.name) || 'participant'
  doc.save(`${group}-${person}-repartcount.pdf`)
}

export async function downloadAllParticipantPdfs(trip: Trip): Promise<void> {
  if (trip.participants.length === 0) return

  const doc = await buildParticipantPdf(trip)
  const group = slugify(trip.name) || 'groupe'
  doc.save(`${group}-tous-participants-repartcount.pdf`)
}
