import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Expense, Trip } from '../types'
import { expenseShareBreakdown, formatMoney } from '../lib/calculations'

interface Props {
  trip: Trip
  onAdd: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Expense>) => void
}

type ExpenseDraft = Omit<Expense, 'id' | 'createdAt'>

export function ExpensesPanel({ trip, onAdd, onRemove, onUpdate }: Props) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(trip.participants[0]?.id ?? '')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(trip.participants.map((p) => p.id)),
  )
  const [customShares, setCustomShares] = useState<Record<string, string>>({})
  const [useCustomShares, setUseCustomShares] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const knownIds = useRef(new Set(trip.participants.map((p) => p.id)))
  const formRef = useRef<HTMLFormElement | null>(null)
  const isEditing = editingId !== null

  useEffect(() => {
    if (!trip.participants.find((p) => p.id === paidBy)) {
      setPaidBy(trip.participants[0]?.id ?? '')
    }
  }, [trip.participants, paidBy])

  useEffect(() => {
    const ids = trip.participants.map((p) => p.id)
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.includes(id)))
      for (const id of ids) {
        if (!knownIds.current.has(id)) next.add(id)
      }
      knownIds.current = new Set(ids)
      return next
    })
  }, [trip.participants])

  // If the expense being edited was removed, exit edit mode
  useEffect(() => {
    if (editingId && !trip.expenses.some((e) => e.id === editingId)) {
      resetForm()
    }
  }, [editingId, trip.expenses])

  function resetForm() {
    setTitle('')
    setAmount('')
    setPaidBy(trip.participants[0]?.id ?? '')
    setSelected(new Set(trip.participants.map((p) => p.id)))
    setCustomShares({})
    setUseCustomShares(false)
    setEditingId(null)
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id)
    setOpenId(null)
    setTitle(expense.title)
    setAmount(String(expense.amount).replace('.', ','))
    setPaidBy(expense.paidBy)
    setSelected(new Set(expense.participantIds))

    const hasCustomShares = Boolean(expense.shares && Object.keys(expense.shares).length > 0)
    setUseCustomShares(hasCustomShares)

    if (hasCustomShares && expense.shares) {
      const init: Record<string, string> = {}
      for (const id of expense.participantIds) {
        const share = expense.shares[id]
        const person = trip.participants.find((p) => p.id === id)
        init[id] = String(share ?? person?.defaultShares ?? 1)
      }
      setCustomShares(init)
    } else {
      setCustomShares({})
    }

    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function togglePerson(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(trip.participants.map((p) => p.id)))
  }

  function buildDraft(): ExpenseDraft | null {
    const parsed = Number.parseFloat(amount.replace(',', '.'))
    if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0) return null
    if (!paidBy || selected.size === 0) return null

    let shares: Record<string, number> | undefined
    if (useCustomShares) {
      shares = {}
      for (const id of selected) {
        const raw = customShares[id]
        const person = trip.participants.find((p) => p.id === id)
        const v =
          raw !== undefined && raw !== ''
            ? Number.parseFloat(raw.replace(',', '.'))
            : (person?.defaultShares ?? 1)
        shares[id] = Number.isFinite(v) && v > 0 ? v : (person?.defaultShares ?? 1)
      }
    }

    return {
      title: title.trim(),
      amount: Math.round(parsed * 100) / 100,
      paidBy,
      participantIds: [...selected],
      shares,
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const draft = buildDraft()
    if (!draft) return

    if (editingId) {
      onUpdate(editingId, {
        title: draft.title,
        amount: draft.amount,
        paidBy: draft.paidBy,
        participantIds: draft.participantIds,
        shares: draft.shares,
      })
    } else {
      onAdd(draft)
    }

    resetForm()
  }

  if (trip.participants.length === 0) {
    return (
      <section className="panel">
        <p className="empty">Ajoutez d&apos;abord des participants.</p>
      </section>
    )
  }

  const payer = (id: string) =>
    trip.participants.find((p) => p.id === id)?.name ?? '?'

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{isEditing ? 'Modifier la dépense' : 'Dépenses'}</h2>
        <p>
          {isEditing
            ? 'Corrigez les infos, les personnes concernées ou les parts, puis enregistrez.'
            : 'Choisissez qui a payé et qui partage. Vous pouvez ajuster les parts pour une dépense précise.'}
        </p>
      </div>

      <form ref={formRef} className="expense-form" onSubmit={handleSubmit}>
        <div className="field-grid">
          <div className="field grow">
            <label htmlFor="e-title">Description</label>
            <input
              id="e-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Courses, essence, Airbnb…"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="e-amount">Montant (€)</label>
            <input
              id="e-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="field">
            <label htmlFor="e-payer">Payé par</label>
            <select
              id="e-payer"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
              {trip.participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="who-fieldset">
          <legend>
            Concernés
            <button type="button" className="linkish" onClick={selectAll}>
              Tous
            </button>
          </legend>
          <div className="chip-row">
            {trip.participants.map((p) => {
              const active = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${active ? 'on' : ''}`}
                  onClick={() => togglePerson(p.id)}
                  aria-pressed={active}
                >
                  {p.name}
                  <span className="chip-shares">
                    {p.defaultShares} part{p.defaultShares !== 1 ? 's' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="custom-shares-toggle">
          <label className="check">
            <input
              type="checkbox"
              checked={useCustomShares}
              onChange={(e) => {
                setUseCustomShares(e.target.checked)
                if (e.target.checked) {
                  const init: Record<string, string> = {}
                  for (const p of trip.participants) {
                    if (selected.has(p.id)) {
                      init[p.id] =
                        customShares[p.id] ?? String(p.defaultShares)
                    }
                  }
                  setCustomShares(init)
                }
              }}
            />
            Ajuster les parts pour cette dépense
          </label>
        </div>

        {useCustomShares && (
          <div className="share-grid">
            {trip.participants
              .filter((p) => selected.has(p.id))
              .map((p) => (
                <label key={p.id} className="share-cell">
                  <span>{p.name}</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    inputMode="decimal"
                    value={customShares[p.id] ?? String(p.defaultShares)}
                    onChange={(e) =>
                      setCustomShares((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="btn primary"
            disabled={!title.trim() || !amount || selected.size === 0 || !paidBy}
          >
            {isEditing ? 'Enregistrer' : 'Ajouter la dépense'}
          </button>
          {isEditing && (
            <button type="button" className="btn ghost" onClick={resetForm}>
              Annuler
            </button>
          )}
        </div>
      </form>

      {trip.expenses.length === 0 ? (
        <p className="empty">Aucune dépense enregistrée.</p>
      ) : (
        <ul className="expense-list">
          {trip.expenses.map((expense) => {
            const open = openId === expense.id
            const editing = editingId === expense.id
            const breakdown = expenseShareBreakdown(expense, trip.participants)
            return (
              <li
                key={expense.id}
                className={`${open ? 'open' : ''} ${editing ? 'editing' : ''}`}
              >
                <button
                  type="button"
                  className="expense-row"
                  onClick={() => setOpenId(open ? null : expense.id)}
                >
                  <div>
                    <strong>
                      {expense.title}
                      {editing ? ' · en cours de modification' : ''}
                    </strong>
                    <span className="meta">
                      Payé par {payer(expense.paidBy)} ·{' '}
                      {expense.participantIds.length} personne
                      {expense.participantIds.length !== 1 ? 's' : ''}
                      {expense.shares ? ' · parts custom' : ''}
                    </span>
                  </div>
                  <span className="amount">{formatMoney(expense.amount)}</span>
                </button>
                {open && (
                  <div className="expense-detail">
                    <ul>
                      {breakdown.map((row) => (
                        <li key={row.id}>
                          <span>
                            {row.name}{' '}
                            <em>
                              ({row.shares} part{row.shares !== 1 ? 's' : ''})
                            </em>
                          </span>
                          <span>{formatMoney(row.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="expense-detail-actions">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => startEdit(expense)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn ghost danger"
                        onClick={() => {
                          if (editingId === expense.id) resetForm()
                          onRemove(expense.id)
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
