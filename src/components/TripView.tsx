import { useState } from 'react'
import type { Expense, Participant, Trip } from '../types'
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
}: Props) {
  const [tab, setTab] = useState<Tab>(
    trip.participants.length === 0 ? 'people' : 'expenses',
  )
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(trip.name)

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
