import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  deleteCloudTrip,
  isCloudConfigured,
  joinCloudTrip,
  listCloudTrips,
  upsertCloudTrip,
} from '../lib/api'
import { loadTrips, saveTrips } from '../lib/storage'
import type { Expense, Participant, Trip } from '../types'

export type SyncStatus = 'idle' | 'loading' | 'synced' | 'offline' | 'error'

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>(() => loadTrips())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const hydrated = useRef(false)
  const skipNextPersist = useRef(false)
  const cloudEnabled = isCloudConfigured()

  // Always keep a local cache
  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    saveTrips(trips)
  }, [trips])

  // Initial cloud hydrate + migrate local → cloud if needed
  useEffect(() => {
    if (!cloudEnabled || hydrated.current) return
    hydrated.current = true
    let cancelled = false

    ;(async () => {
      setSyncStatus('loading')
      setSyncError(null)
      try {
        const remote = await listCloudTrips()
        if (cancelled) return

        const local = loadTrips()
        if (remote.length === 0 && local.length > 0) {
          for (const trip of local) {
            await upsertCloudTrip(trip)
          }
          skipNextPersist.current = true
          setTrips(local)
        } else {
          skipNextPersist.current = true
          setTrips(remote)
          saveTrips(remote)
        }
        setSyncStatus('synced')
      } catch (err) {
        if (cancelled) return
        setSyncStatus('error')
        setSyncError(err instanceof Error ? err.message : 'Sync cloud impossible')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cloudEnabled])

  const pushTrip = useCallback(
    async (trip: Trip) => {
      if (!cloudEnabled) return
      try {
        await upsertCloudTrip(trip)
        setSyncStatus('synced')
        setSyncError(null)
      } catch (err) {
        setSyncStatus('error')
        setSyncError(err instanceof Error ? err.message : 'Échec de sauvegarde cloud')
      }
    },
    [cloudEnabled],
  )

  const removeRemoteTrip = useCallback(
    async (tripId: string) => {
      if (!cloudEnabled) return
      try {
        await deleteCloudTrip(tripId)
        setSyncStatus('synced')
        setSyncError(null)
      } catch (err) {
        setSyncStatus('error')
        setSyncError(err instanceof Error ? err.message : 'Échec de suppression cloud')
      }
    },
    [cloudEnabled],
  )

  const createTrip = useCallback(
    (name: string) => {
      const trip: Trip = {
        id: uuid(),
        name: name.trim() || 'Nouveau voyage',
        participants: [],
        expenses: [],
        createdAt: new Date().toISOString(),
      }
      setTrips((prev) => [trip, ...prev])
      void pushTrip(trip)
      return trip.id
    },
    [pushTrip],
  )

  const deleteTrip = useCallback(
    (tripId: string) => {
      setTrips((prev) => prev.filter((t) => t.id !== tripId))
      void removeRemoteTrip(tripId)
    },
    [removeRemoteTrip],
  )

  const updateTrip = useCallback(
    (tripId: string, updater: (t: Trip) => Trip) => {
      setTrips((prev) => {
        const next = prev.map((t) => (t.id === tripId ? updater(t) : t))
        const updated = next.find((t) => t.id === tripId)
        if (updated) void pushTrip(updated)
        return next
      })
    },
    [pushTrip],
  )

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

  const refreshFromCloud = useCallback(async () => {
    if (!cloudEnabled) return
    setSyncStatus('loading')
    try {
      const remote = await listCloudTrips()
      skipNextPersist.current = true
      setTrips(remote)
      saveTrips(remote)
      setSyncStatus('synced')
      setSyncError(null)
    } catch (err) {
      setSyncStatus('error')
      setSyncError(err instanceof Error ? err.message : 'Sync cloud impossible')
    }
  }, [cloudEnabled])

  const openSharedTrip = useCallback(
    async (tripId: string) => {
      if (!cloudEnabled) {
        throw new Error('Cloud non configuré')
      }
      setSyncStatus('loading')
      try {
        const trip = await joinCloudTrip(tripId)
        setTrips((prev) => {
          const without = prev.filter((t) => t.id !== trip.id)
          const next = [trip, ...without]
          saveTrips(next)
          return next
        })
        setSyncStatus('synced')
        setSyncError(null)
        return trip.id
      } catch (err) {
        setSyncStatus('error')
        const message =
          err instanceof Error ? err.message : 'Impossible d’ouvrir le lien partagé'
        setSyncError(message)
        throw err instanceof Error ? err : new Error(message)
      }
    },
    [cloudEnabled],
  )

  return {
    trips,
    syncStatus,
    syncError,
    cloudEnabled,
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
    refreshFromCloud,
    openSharedTrip,
  }
}
