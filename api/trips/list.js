const { getDb, checkApiKey, resolveProfile, setCors } = require('../_db')

module.exports = async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkApiKey(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const profile = await resolveProfile(req)
    if (!profile) return res.status(401).json({ error: 'Profile not linked' })

    const db = await getDb()
    await db.collection('trips').createIndex({ ownerId: 1, tripId: 1 }, { unique: true }).catch(() => {})

    const docs = await db
      .collection('trips')
      .find({ ownerId: profile.profileId })
      .sort({ updatedAt: -1 })
      .toArray()

    const trips = docs.map((d) => ({
      id: d.tripId,
      name: d.name,
      participants: d.participants || [],
      expenses: d.expenses || [],
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
    }))

    res.status(200).json({ trips })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
