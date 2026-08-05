import type { Expense, Participant, Trip } from '../types'

interface TripExportFile {
  version: 1
  exportedAt: string
  trip: Trip
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isParticipant(value: unknown): value is Participant {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.defaultShares === 'number' &&
    Number.isFinite(value.defaultShares) &&
    value.defaultShares > 0
  )
}

function isExpense(value: unknown): value is Expense {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.amount !== 'number' ||
    !Number.isFinite(value.amount) ||
    value.amount <= 0 ||
    typeof value.paidBy !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !Array.isArray(value.participantIds) ||
    !value.participantIds.every((id) => typeof id === 'string')
  ) {
    return false
  }

  if (value.shares === undefined) return true
  if (!isRecord(value.shares)) return false

  const shareValues = Object.values(value.shares)
  if (
    !shareValues.every(
      (share) => typeof share === 'number' && Number.isFinite(share) && share >= 0,
    )
  ) {
    return false
  }
  // At least one positive share is required when overrides are set
  return shareValues.some((share) => (share as number) > 0)
}

function validateTrip(trip: unknown): trip is Trip {
  if (
    !isRecord(trip) ||
    typeof trip.id !== 'string' ||
    typeof trip.name !== 'string' ||
    typeof trip.createdAt !== 'string' ||
    !Array.isArray(trip.participants) ||
    !Array.isArray(trip.expenses) ||
    !trip.participants.every(isParticipant) ||
    !trip.expenses.every(isExpense)
  ) {
    return false
  }

  const participantIds = new Set(trip.participants.map((p) => p.id))
  if (participantIds.size !== trip.participants.length) return false

  return trip.expenses.every((expense) => {
    if (!participantIds.has(expense.paidBy)) return false
    if (expense.participantIds.length === 0) return false
    if (!expense.participantIds.every((id) => participantIds.has(id))) return false
    if (new Set(expense.participantIds).size !== expense.participantIds.length) {
      return false
    }

    if (!expense.shares) return true
    return Object.keys(expense.shares).every((id) => expense.participantIds.includes(id))
  })
}

export function createTripExport(trip: Trip): string {
  const payload: TripExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    trip,
  }

  return JSON.stringify(payload, null, 2)
}

export function parseTripImport(contents: string): Trip {
  let parsed: unknown

  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new Error('Le fichier est invalide : JSON illisible.')
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !('trip' in parsed)) {
    throw new Error('Le fichier ne correspond pas à un export RepartCount valide.')
  }

  if (!validateTrip(parsed.trip)) {
    throw new Error('Le groupe importé est incomplet ou incohérent.')
  }

  return parsed.trip
}

export function downloadTripExport(trip: Trip): void {
  const content = createTripExport(trip)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safeName = trip.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  anchor.href = url
  anchor.download = `${safeName || 'groupe'}-repartcount.json`
  anchor.click()

  URL.revokeObjectURL(url)
}
