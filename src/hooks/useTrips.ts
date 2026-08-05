import { useCallback, useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { loadTrips, saveTrips } from '../lib/storage'
import type { Expense, Participant, Trip } from '../types'

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>(() => loadTrips())

  useEffect(() => {
    saveTrips(trips)
  }, [trips])

  const createTrip = useCallback((name: string) => {
    const trip: Trip = {
      id: uuid(),
      name: name.trim() || 'Nouveau voyage',
      participants: [],
      expenses: [],
      createdAt: new Date().toISOString(),
    }
    setTrips((prev) => [trip, ...prev])
    return trip.id
  }, [])

  const deleteTrip = useCallback((tripId: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId))
  }, [])

  const updateTrip = useCallback((tripId: string, updater: (t: Trip) => Trip) => {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? updater(t) : t)))
  }, [])

  const addParticipant = useCallback(
    (tripId: string, name: string, defaultShares = 1) => {
      const participant: Participant = {
        id: uuid(),
        name: name.trim(),
        defaultShares: Math.max(0.01, defaultShares),
      }
      updateTrip(tripId, (t) => ({
        ...t,
        participants: [...t.participants, participant],
      }))
      return participant.id
    },
    [updateTrip],
  )

  const updateParticipant = useCallback(
    (tripId: string, participantId: string, patch: Partial<Participant>) => {
      updateTrip(tripId, (t) => ({
        ...t,
        participants: t.participants.map((p) =>
          p.id === participantId ? { ...p, ...patch } : p,
        ),
      }))
    },
    [updateTrip],
  )

  const removeParticipant = useCallback(
    (tripId: string, participantId: string) => {
      updateTrip(tripId, (t) => ({
        ...t,
        participants: t.participants.filter((p) => p.id !== participantId),
        expenses: t.expenses
          .filter((e) => e.paidBy !== participantId)
          .map((e) => {
            const participantIds = e.participantIds.filter((id) => id !== participantId)
            if (!e.shares) return { ...e, participantIds }
            const { [participantId]: _, ...shares } = e.shares
            return { ...e, participantIds, shares }
          }),
      }))
    },
    [updateTrip],
  )

  const addExpense = useCallback(
    (tripId: string, expense: Omit<Expense, 'id' | 'createdAt'>) => {
      const full: Expense = {
        ...expense,
        id: uuid(),
        createdAt: new Date().toISOString(),
      }
      updateTrip(tripId, (t) => ({
        ...t,
        expenses: [full, ...t.expenses],
      }))
      return full.id
    },
    [updateTrip],
  )

  const updateExpense = useCallback(
    (tripId: string, expenseId: string, patch: Partial<Expense>) => {
      updateTrip(tripId, (t) => ({
        ...t,
        expenses: t.expenses.map((e) => {
          if (e.id !== expenseId) return e
          const next = { ...e, ...patch }
          // Allow clearing custom shares when switching back to defaults
          if ('shares' in patch && patch.shares === undefined) {
            delete next.shares
          }
          return next
        }),
      }))
    },
    [updateTrip],
  )

  const removeExpense = useCallback(
    (tripId: string, expenseId: string) => {
      updateTrip(tripId, (t) => ({
        ...t,
        expenses: t.expenses.filter((e) => e.id !== expenseId),
      }))
    },
    [updateTrip],
  )

  const renameTrip = useCallback(
    (tripId: string, name: string) => {
      updateTrip(tripId, (t) => ({ ...t, name: name.trim() || t.name }))
    },
    [updateTrip],
  )

  const replaceTrip = useCallback(
    (tripId: string, replacement: Trip) => {
      updateTrip(tripId, (t) => ({
        ...replacement,
        id: t.id,
      }))
    },
    [updateTrip],
  )

  return {
    trips,
    createTrip,
    deleteTrip,
    renameTrip,
    addParticipant,
    updateParticipant,
    removeParticipant,
    addExpense,
    updateExpense,
    removeExpense,
    replaceTrip,
  }
}
