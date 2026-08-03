import { useState, type FormEvent } from 'react'
import type { Trip } from '../types'
import { formatMoney } from '../lib/calculations'
import { computeBalances } from '../lib/calculations'

interface Props {
  trips: Trip[]
  onOpen: (id: string) => void
  onCreate: (name: string) => void
  onDelete: (id: string) => void
}

export function TripList({ trips, onOpen, onCreate, onDelete }: Props) {
  const [name, setName] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
    setName('')
  }

  return (
    <div className="page home">
      <header className="hero">
        <p className="brand">RepartCount</p>
        <h1>Partagez les frais, sans calculatrice.</h1>
        <p className="lede">
          Créez un groupe, définissez les parts de chacun, ajoutez les dépenses.
          On s&apos;occupe du reste.
        </p>
      </header>

      <form className="create-trip" onSubmit={handleSubmit}>
        <label htmlFor="trip-name">Nouveau groupe</label>
        <div className="row">
          <input
            id="trip-name"
            type="text"
            placeholder="Weekend à Biarritz, coloc, resto…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            Créer
          </button>
        </div>
      </form>

      {trips.length === 0 ? (
        <p className="empty">Aucun groupe pour l&apos;instant. Créez le premier ci-dessus.</p>
      ) : (
        <ul className="trip-list">
          {trips.map((trip) => {
            const total = trip.expenses.reduce((s, e) => s + e.amount, 0)
            const balances = computeBalances(trip)
            const unsettled = balances.some((b) => Math.abs(b.net) > 0.005)
            return (
              <li key={trip.id}>
                <button type="button" className="trip-card" onClick={() => onOpen(trip.id)}>
                  <div>
                    <strong>{trip.name}</strong>
                    <span className="meta">
                      {trip.participants.length} personne
                      {trip.participants.length !== 1 ? 's' : ''}
                      {' · '}
                      {trip.expenses.length} dépense
                      {trip.expenses.length !== 1 ? 's' : ''}
                      {' · '}
                      {formatMoney(total)}
                    </span>
                  </div>
                  <span className={`status ${unsettled ? 'open' : 'ok'}`}>
                    {trip.expenses.length === 0
                      ? 'Vide'
                      : unsettled
                        ? 'À régler'
                        : 'Équilibré'}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn ghost danger icon"
                  aria-label={`Supprimer ${trip.name}`}
                  onClick={() => {
                    if (confirm(`Supprimer « ${trip.name} » ?`)) onDelete(trip.id)
                  }}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
