const { getDb, checkApiKey, setCors } = require('../_db')

module.exports = async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkApiKey(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    res.status(200).json({
      ok: true,
      database: process.env.MONGODB_DATABASE || 'repartcount',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
