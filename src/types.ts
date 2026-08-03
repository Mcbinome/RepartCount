export interface Participant {
  id: string
  name: string
  /** Default share weight used when an expense doesn't override shares */
  defaultShares: number
}

export interface Expense {
  id: string
  title: string
  amount: number
  paidBy: string
  /** Participant ids involved in this expense */
  participantIds: string[]
  /**
   * Optional per-participant share overrides for this expense.
   * Missing entries fall back to the participant's defaultShares.
   */
  shares?: Record<string, number>
  createdAt: string
}

export interface Trip {
  id: string
  name: string
  participants: Participant[]
  expenses: Expense[]
  createdAt: string
}

export interface Balance {
  participantId: string
  name: string
  paid: number
  owed: number
  net: number
}

export interface Settlement {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}
