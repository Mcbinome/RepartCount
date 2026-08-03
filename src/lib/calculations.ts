import type { Balance, Expense, Participant, Settlement, Trip } from '../types'

function sharesForExpense(
  expense: Expense,
  participants: Participant[],
): Map<string, number> {
  const byId = new Map(participants.map((p) => [p.id, p]))
  const result = new Map<string, number>()

  for (const id of expense.participantIds) {
    const override = expense.shares?.[id]
    const participant = byId.get(id)
    const weight =
      override !== undefined && override > 0
        ? override
        : (participant?.defaultShares ?? 1)
    result.set(id, Math.max(0, weight))
  }

  return result
}

export function computeBalances(trip: Trip): Balance[] {
  const paid = new Map<string, number>()
  const owed = new Map<string, number>()

  for (const p of trip.participants) {
    paid.set(p.id, 0)
    owed.set(p.id, 0)
  }

  for (const expense of trip.expenses) {
    if (expense.amount <= 0 || expense.participantIds.length === 0) continue

    paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + expense.amount)

    const weights = sharesForExpense(expense, trip.participants)
    const totalWeight = [...weights.values()].reduce((a, b) => a + b, 0)
    if (totalWeight <= 0) continue

    for (const [id, weight] of weights) {
      owed.set(id, (owed.get(id) ?? 0) + (expense.amount * weight) / totalWeight)
    }
  }

  return trip.participants.map((p) => {
    const pPaid = paid.get(p.id) ?? 0
    const pOwed = owed.get(p.id) ?? 0
    return {
      participantId: p.id,
      name: p.name,
      paid: pPaid,
      owed: pOwed,
      net: pPaid - pOwed,
    }
  })
}

/** Greedy settle: debtors pay creditors until balances clear. */
export function computeSettlements(balances: Balance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ ...b, remaining: -b.net }))
    .sort((a, b) => b.remaining - a.remaining)

  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ ...b, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining)
    if (amount > 0.005) {
      settlements.push({
        fromId: debtors[i].participantId,
        fromName: debtors[i].name,
        toId: creditors[j].participantId,
        toName: creditors[j].name,
        amount: Math.round(amount * 100) / 100,
      })
    }
    debtors[i].remaining -= amount
    creditors[j].remaining -= amount
    if (debtors[i].remaining < 0.005) i++
    if (creditors[j].remaining < 0.005) j++
  }

  return settlements
}

export function expenseShareBreakdown(
  expense: Expense,
  participants: Participant[],
): { id: string; name: string; shares: number; amount: number }[] {
  const byId = new Map(participants.map((p) => [p.id, p]))
  const weights = sharesForExpense(expense, participants)
  const totalWeight = [...weights.values()].reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) return []

  return expense.participantIds
    .map((id) => {
      const shares = weights.get(id) ?? 0
      return {
        id,
        name: byId.get(id)?.name ?? '?',
        shares,
        amount: (expense.amount * shares) / totalWeight,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export function formatMoney(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
