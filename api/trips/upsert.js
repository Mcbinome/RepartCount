import {
  checkApiKey,
  ensureTripIndexes,
  findTripById,
  getDb,
  grantTripAccess,
  profileCanAccessTrip,
  resolveProfile,
  setCors,
} from '../_db.js'

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
    await ensureTripIndexes(db)
    const coll = db.collection('trips')
    const now = new Date()

    const existing = await findTripById(db, trip.id)

    if (existing) {
      const { allowed } = await profileCanAccessTrip(db, trip.id, profile.profileId)
      if (!allowed) return res.status(403).json({ error: 'Accès refusé' })

      await coll.updateOne(
        { tripId: trip.id },
        {
          $set: {
            name: trip.name,
            participants: Array.isArray(trip.participants) ? trip.participants : [],
            expenses: Array.isArray(trip.expenses) ? trip.expenses : [],
            updatedAt: now,
          },
        },
      )
      await grantTripAccess(db, trip.id, profile.profileId, 'member')
      return res.status(200).json({ ok: true, tripId: trip.id, created: false })
    }

    const doc = {
      tripId: trip.id,
      name: trip.name,
      participants: Array.isArray(trip.participants) ? trip.participants : [],
      expenses: Array.isArray(trip.expenses) ? trip.expenses : [],
      ownerId: profile.profileId,
      createdAt: trip.createdAt ? new Date(trip.createdAt) : now,
      updatedAt: now,
    }

    await coll.insertOne(doc)
    await grantTripAccess(db, trip.id, profile.profileId, 'owner')
    res.status(200).json({ ok: true, tripId: trip.id, created: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
