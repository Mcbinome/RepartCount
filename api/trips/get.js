import { getDb, checkApiKey, resolveProfile, setCors } from '../_db.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkApiKey(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })

    const profile = await resolveProfile(req, { allowCreate: false })
    if (!profile) return res.status(401).json({ error: 'Profile not linked' })

    const db = await getDb()
    const doc = await db.collection('trips').findOne({
      ownerId: profile.profileId,
      tripId: id,
    })

    if (!doc) return res.status(404).json({ error: 'Not found' })

    res.status(200).json({
      trip: {
        id: doc.tripId,
        name: doc.name,
        participants: doc.participants || [],
        expenses: doc.expenses || [],
        createdAt:
          doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
        updatedAt:
          doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
