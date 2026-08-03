import { useMemo } from 'react'
import type { Trip } from '../types'
import {
  computeBalances,
  computeSettlements,
  formatMoney,
} from '../lib/calculations'

interface Props {
  trip: Trip
}

export function BalancesPanel({ trip }: Props) {
  const balances = useMemo(() => computeBalances(trip), [trip])
  const settlements = useMemo(() => computeSettlements(balances), [balances])
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0)

  if (trip.participants.length === 0) {
    return (
      <section className="panel">
        <p className="empty">Ajoutez des participants pour voir les soldes.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Soldes</h2>
        <p>
          Total des dépenses&nbsp;: <strong>{formatMoney(total)}</strong>
        </p>
      </div>

      <ul className="balance-list">
        {balances
          .slice()
          .sort((a, b) => b.net - a.net)
          .map((b) => {
            const tone = b.net > 0.005 ? 'pos' : b.net < -0.005 ? 'neg' : 'zero'
            return (
              <li key={b.participantId} className={tone}>
                <div>
                  <strong>{b.name}</strong>
                  <span className="meta">
                    A payé {formatMoney(b.paid)} · Doit {formatMoney(b.owed)}
                  </span>
                </div>
                <span className="net">
                  {b.net > 0.005
                    ? `+${formatMoney(b.net)}`
                    : b.net < -0.005
                      ? formatMoney(b.net)
                      : formatMoney(0)}
                </span>
              </li>
            )
          })}
      </ul>

      <div className="settlements">
        <h3>Pour équilibrer</h3>
        {settlements.length === 0 ? (
          <p className="empty ok">Tout le monde est à l&apos;équilibre.</p>
        ) : (
          <ul>
            {settlements.map((s, i) => (
              <li key={`${s.fromId}-${s.toId}-${i}`}>
                <span>
                  <strong>{s.fromName}</strong> doit{' '}
                  <strong>{formatMoney(s.amount)}</strong> à{' '}
                  <strong>{s.toName}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
