import { getDb, checkApiKey, resolveProfile, setCors } from '../_db.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkApiKey(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { trip } = req.body || {}
    if (!trip || !trip.id || !trip.name) {
      return res.status(400).json({ error: 'trip with id and name required' })
    }

    const profile = await resolveProfile(req)
    if (!profile) return res.status(401).json({ error: 'Profile not linked' })

    const db = await getDb()
    const coll = db.collection('trips')
    await coll.createIndex({ ownerId: 1, tripId: 1 }, { unique: true }).catch(() => {})

    const now = new Date()
    const existing = await coll.findOne({
      ownerId: profile.profileId,
      tripId: trip.id,
    })

    const doc = {
      tripId: trip.id,
      name: trip.name,
      participants: Array.isArray(trip.participants) ? trip.participants : [],
      expenses: Array.isArray(trip.expenses) ? trip.expenses : [],
      ownerId: profile.profileId,
      createdAt: existing?.createdAt
        ? existing.createdAt
        : trip.createdAt
          ? new Date(trip.createdAt)
          : now,
      updatedAt: now,
    }

    if (existing) {
      await coll.replaceOne({ _id: existing._id }, { ...doc, _id: existing._id })
      return res.status(200).json({ ok: true, tripId: trip.id, created: false })
    }

    await coll.insertOne(doc)
    res.status(200).json({ ok: true, tripId: trip.id, created: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
