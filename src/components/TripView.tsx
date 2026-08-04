import { useRef, useState } from 'react'
import type { Expense, Participant, Trip } from '../types'
import { downloadTripExport, parseTripImport } from '../lib/importExport'
import { ParticipantsPanel } from './ParticipantsPanel'
import { ExpensesPanel } from './ExpensesPanel'
import { BalancesPanel } from './BalancesPanel'

type Tab = 'people' | 'expenses' | 'balances'

interface Props {
  trip: Trip
  onBack: () => void
  onRename: (name: string) => void
  onAddParticipant: (name: string, shares: number) => void
  onUpdateParticipant: (id: string, patch: Partial<Participant>) => void
  onRemoveParticipant: (id: string) => void
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
  onUpdateExpense: (id: string, patch: Partial<Expense>) => void
  onRemoveExpense: (id: string) => void
  onReplaceTrip: (trip: Trip) => void
}

export function TripView({
  trip,
  onBack,
  onRename,
  onAddParticipant,
  onUpdateParticipant,
  onRemoveParticipant,
  onAddExpense,
  onUpdateExpense,
  onRemoveExpense,
  onReplaceTrip,
}: Props) {
  const [tab, setTab] = useState<Tab>(
    trip.participants.length === 0 ? 'people' : 'expenses',
  )
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(trip.name)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  function handleExport() {
    downloadTripExport(trip)
    setError(null)
    setNotice('Groupe exporté en fichier JSON local.')
  }

  async function handleImport(file: File | null) {
    if (!file) return

    try {
      const contents = await file.text()
      const importedTrip = parseTripImport(contents)
      const confirmed = window.confirm(
        `Remplacer le groupe actuel par le contenu de "${file.name}" ?`,
      )
      if (!confirmed) return
      onReplaceTrip(importedTrip)
      setError(null)
      setNotice('Groupe réimporté depuis le fichier local.')
    } catch (err) {
      setNotice(null)
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'importer ce fichier.",
      )
    }
  }

  return (
    <div className="page trip">
      <header className="trip-header">
        <button type="button" className="btn ghost back" onClick={onBack}>
          ← Groupes
        </button>
        {editingTitle ? (
          <form
            className="title-edit"
            onSubmit={(e) => {
              e.preventDefault()
              onRename(titleDraft)
              setEditingTitle(false)
            }}
          >
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              autoFocus
              onBlur={() => {
                onRename(titleDraft)
                setEditingTitle(false)
              }}
            />
          </form>
        ) : (
          <button
            type="button"
            className="trip-title"
            onClick={() => {
              setTitleDraft(trip.name)
              setEditingTitle(true)
            }}
          >
            {trip.name}
          </button>
        )}
        <p className="brand-mini">RepartCount</p>
      </header>

      <section className="trip-tools">
        <div>
          <strong>Sauvegarde locale</strong>
          <p>
            Exportez ce groupe en fichier plat JSON, puis reimportez-le si besoin.
          </p>
        </div>
        <div className="trip-tools-actions">
          <button type="button" className="btn ghost" onClick={handleExport}>
            Exporter
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => importInputRef.current?.click()}
          >
            Reimporter
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              void handleImport(e.target.files?.[0] ?? null)
              e.currentTarget.value = ''
            }}
          />
        </div>
      </section>

      {notice && <p className="inline-message success">{notice}</p>}
      {error && <p className="inline-message error">{error}</p>}

      <nav className="tabs" aria-label="Sections">
        {(
          [
            ['people', 'Participants'],
            ['expenses', 'Dépenses'],
            ['balances', 'Soldes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'people' && (
              <span className="count">{trip.participants.length}</span>
            )}
            {id === 'expenses' && (
              <span className="count">{trip.expenses.length}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'people' && (
        <ParticipantsPanel
          trip={trip}
          onAdd={onAddParticipant}
          onUpdate={onUpdateParticipant}
          onRemove={onRemoveParticipant}
        />
      )}
      {tab === 'expenses' && (
        <ExpensesPanel
          trip={trip}
          onAdd={onAddExpense}
          onUpdate={onUpdateExpense}
          onRemove={onRemoveExpense}
        />
      )}
      {tab === 'balances' && <BalancesPanel trip={trip} />}
    </div>
  )
}
