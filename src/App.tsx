import { useEffect, useRef, useState } from 'react'
import { useTrips } from './hooks/useTrips'
import { TripList } from './components/TripList'
import { TripView } from './components/TripView'
import {
  readSharedTripIdFromUrl,
  setSharedTripInUrl,
} from './lib/api'
import './App.css'

export default function App() {
  const {
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
  } = useTrips()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [shareBootError, setShareBootError] = useState<string | null>(null)
  const shareOpenedRef = useRef<string | null>(null)
  const tripsRef = useRef(trips)
  tripsRef.current = trips
  const openSharedTripRef = useRef(openSharedTrip)
  openSharedTripRef.current = openSharedTrip
  const activeTrip = trips.find((t) => t.id === activeId) ?? null

  // Open shared link ?g=<tripId> once after cloud sync is ready
  useEffect(() => {
    if (!cloudEnabled || syncStatus !== 'synced') return

    const sharedId = readSharedTripIdFromUrl()
    if (!sharedId) {
      shareOpenedRef.current = null
      return
    }
    if (shareOpenedRef.current === sharedId) return

    let cancelled = false

    ;(async () => {
      try {
        if (tripsRef.current.some((t) => t.id === sharedId)) {
          if (cancelled) return
          shareOpenedRef.current = sharedId
          setActiveId(sharedId)
          setShareBootError(null)
          return
        }

        const id = await openSharedTripRef.current(sharedId)
        if (cancelled) return
        shareOpenedRef.current = id
        setActiveId(id)
        setSharedTripInUrl(id)
        setShareBootError(null)
      } catch (err) {
        if (cancelled) return
        shareOpenedRef.current = null
        setShareBootError(
          err instanceof Error ? err.message : 'Lien de partage invalide',
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cloudEnabled, syncStatus])

  function openTrip(id: string) {
    shareOpenedRef.current = id
    setActiveId(id)
    setSharedTripInUrl(id)
    setShareBootError(null)
  }

  function backToList() {
    shareOpenedRef.current = null
    setActiveId(null)
    setSharedTripInUrl(null)
  }

  if (activeTrip) {
    return (
      <TripView
        trip={activeTrip}
        onBack={backToList}
        onRename={(name) => renameTrip(activeTrip.id, name)}
        onAddParticipant={(name, shares) =>
          addParticipant(activeTrip.id, name, shares)
        }
        onUpdateParticipant={(id, patch) =>
          updateParticipant(activeTrip.id, id, patch)
        }
        onRemoveParticipant={(id) => removeParticipant(activeTrip.id, id)}
        onAddExpense={(expense) => addExpense(activeTrip.id, expense)}
        onUpdateExpense={(id, patch) => updateExpense(activeTrip.id, id, patch)}
        onRemoveExpense={(id) => removeExpense(activeTrip.id, id)}
        onReplaceTrip={(trip) => replaceTrip(activeTrip.id, trip)}
      />
    )
  }

  return (
    <TripList
      trips={trips}
      syncStatus={syncStatus}
      syncError={shareBootError || syncError}
      cloudEnabled={cloudEnabled}
      onRefresh={() => void refreshFromCloud()}
      onOpen={openTrip}
      onCreate={(name) => {
        const id = createTrip(name)
        openTrip(id)
      }}
      onDelete={(id) => {
        const trip = trips.find((t) => t.id === id)
        if (
          !confirm(
            `Supprimer « ${trip?.name ?? 'ce groupe'} » pour tout le monde (y compris ceux qui ont le lien) ?`,
          )
        ) {
          return
        }
        deleteTrip(id)
        if (activeId === id) backToList()
      }}
    />
  )
}
