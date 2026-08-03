import { useState, type FormEvent } from 'react'
import type { Participant, Trip } from '../types'

interface Props {
  trip: Trip
  onAdd: (name: string, shares: number) => void
  onUpdate: (id: string, patch: Partial<Participant>) => void
  onRemove: (id: string) => void
}

export function ParticipantsPanel({ trip, onAdd, onUpdate, onRemove }: Props) {
  const [name, setName] = useState('')
  const [shares, setShares] = useState('1')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const parsed = Number.parseFloat(shares.replace(',', '.'))
    onAdd(name.trim(), Number.isFinite(parsed) && parsed > 0 ? parsed : 1)
    setName('')
    setShares('1')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Participants</h2>
        <p>
          Les <em>parts</em> définissent le poids de chacun dans la répartition.
          Ex.&nbsp;: adultes = 1, enfants = 0,5.
        </p>
      </div>

      <form className="inline-form" onSubmit={handleSubmit}>
        <div className="field grow">
          <label htmlFor="p-name">Nom</label>
          <input
            id="p-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prénom"
            autoComplete="off"
          />
        </div>
        <div className="field shares-field">
          <label htmlFor="p-shares">Parts</label>
          <input
            id="p-shares"
            type="number"
            min="0.01"
            step="any"
            inputMode="decimal"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
          />
        </div>
        <button type="submit" className="btn primary" disabled={!name.trim()}>
          Ajouter
        </button>
      </form>

      {trip.participants.length === 0 ? (
        <p className="empty">Ajoutez les membres du groupe pour commencer.</p>
      ) : (
        <ul className="people-list">
          {trip.participants.map((p) => (
            <li key={p.id}>
              <input
                className="name-edit"
                value={p.name}
                aria-label="Nom"
                onChange={(e) => onUpdate(p.id, { name: e.target.value })}
              />
              <label className="shares-edit">
                <span>Parts</span>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  inputMode="decimal"
                  value={p.defaultShares}
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value)
                    if (Number.isFinite(v) && v > 0) {
                      onUpdate(p.id, { defaultShares: v })
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => {
                  if (
                    confirm(
                      `Retirer ${p.name} ? Ses dépenses payées seront aussi supprimées.`,
                    )
                  ) {
                    onRemove(p.id)
                  }
                }}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
