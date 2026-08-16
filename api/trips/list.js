import {
  checkApiKey,
  ensureTripIndexes,
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
    const profile = await resolveProfile(req)
    if (!profile) return res.status(401).json({ error: 'Profile not linked' })

    const db = await getDb()
    await ensureTripIndexes(db)

    // Backfill access for trips this profile already owns
    const owned = await db
      .collection('trips')
      .find({ ownerId: profile.profileId })
      .project({ tripId: 1 })
      .toArray()
    for (const doc of owned) {
      await grantTripAccess(db, doc.tripId, profile.profileId, 'owner')
    }

    const accessRows = await db
      .collection('tripAccess')
      .find({ profileId: profile.profileId })
      .project({ tripId: 1 })
      .toArray()
    const tripIds = [...new Set(accessRows.map((row) => row.tripId))]

    const docs = tripIds.length
      ? await db
          .collection('trips')
          .find({ tripId: { $in: tripIds } })
          .sort({ updatedAt: -1 })
          .toArray()
      : []

    res.status(200).json({ trips: docs.map(serializeTrip) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
