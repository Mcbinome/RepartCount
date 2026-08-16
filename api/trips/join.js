import {
  checkApiKey,
  ensureTripIndexes,
  findTripById,
  getDb,
  grantTripAccess,
  resolveProfile,
  serializeTrip,
  setCors,
} from '../_db.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkApiKey(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })

    const profile = await resolveProfile(req)
    if (!profile) return res.status(401).json({ error: 'Profile not linked' })

    const db = await getDb()
    await ensureTripIndexes(db)

    const trip = await findTripById(db, id)
    if (!trip) return res.status(404).json({ error: 'Groupe introuvable' })

    await grantTripAccess(db, id, profile.profileId, 'member')

    res.status(200).json({ trip: serializeTrip(trip) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
