const { getDb, checkApiKey, resolveProfile, setCors } = require('../_db')

module.exports = async function handler(req, res) {
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
    const result = await db.collection('trips').deleteOne({
      ownerId: profile.profileId,
      tripId: id,
    })

    res.status(200).json({ deletedCount: result.deletedCount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
