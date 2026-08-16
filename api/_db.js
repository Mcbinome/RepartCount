const { MongoClient } = require('mongodb')

let cachedClient = null

async function getDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured')
  }
  if (cachedClient) {
    return cachedClient.db(process.env.MONGODB_DATABASE || 'repartcount')
  }
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  cachedClient = client
  return client.db(process.env.MONGODB_DATABASE || 'repartcount')
}

function checkApiKey(req) {
  const key = req.headers['x-api-key']
  if (!key || key !== process.env.API_KEY) {
    return false
  }
  return true
}

async function resolveProfile(req, { allowCreate = true } = {}) {
  const profileId = req.headers['x-profile-id']
  const syncToken = req.headers['x-profile-token']
  if (!profileId || !syncToken) {
    return null
  }

  const db = await getDb()
  const profiles = db.collection('profiles')
  await profiles.createIndex({ profileId: 1 }, { unique: true }).catch(() => {})

  const existing = await profiles.findOne({ profileId })
  if (!existing) {
    if (!allowCreate) return null
    await profiles.insertOne({
      profileId,
      syncToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return { profileId, syncToken }
  }

  if (existing.syncToken !== syncToken) {
    return null
  }

  if (allowCreate) {
    await profiles
      .updateOne({ profileId }, { $set: { updatedAt: new Date() } })
      .catch(() => {})
  }

  return { profileId, syncToken: existing.syncToken }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-api-key, x-profile-id, x-profile-token',
  )
}

module.exports = { getDb, checkApiKey, resolveProfile, setCors }
