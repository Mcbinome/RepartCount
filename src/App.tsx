import { useState } from 'react'
import { useTrips } from './hooks/useTrips'
import { TripList } from './components/TripList'
import { TripView } from './components/TripView'
import './App.css'

export default function App() {
  const {
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
  } = useTrips()

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeTrip = trips.find((t) => t.id === activeId) ?? null

  if (activeTrip) {
    return (
      <TripView
        trip={activeTrip}
        onBack={() => setActiveId(null)}
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
      />
    )
  }

  return (
    <TripList
      trips={trips}
      onOpen={setActiveId}
      onCreate={(name) => {
        const id = createTrip(name)
        setActiveId(id)
      }}
      onDelete={(id) => {
        deleteTrip(id)
        if (activeId === id) setActiveId(null)
      }}
    />
  )
}
