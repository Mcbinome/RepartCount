import { MongoClient } from 'mongodb'

let cachedClient = null

export async function getDb() {
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

export function checkApiKey(req) {
  const key = req.headers['x-api-key']
  if (!key || key !== process.env.API_KEY) {
    return false
  }
  return true
}

export async function resolveProfile(req, { allowCreate = true } = {}) {
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

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-api-key, x-profile-id, x-profile-token',
  )
}

export function serializeTrip(doc) {
  return {
    id: doc.tripId,
    name: doc.name,
    participants: doc.participants || [],
    expenses: doc.expenses || [],
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt:
      doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

export async function ensureTripIndexes(db) {
  const trips = db.collection('trips')
  const access = db.collection('tripAccess')
  await trips.createIndex({ tripId: 1 }, { unique: true }).catch(() => {})
  await access.createIndex({ tripId: 1, profileId: 1 }, { unique: true }).catch(() => {})
  await access.createIndex({ profileId: 1 }).catch(() => {})
}

export async function grantTripAccess(db, tripId, profileId, role = 'member') {
  await ensureTripIndexes(db)
  await db.collection('tripAccess').updateOne(
    { tripId, profileId },
    {
      $set: { updatedAt: new Date() },
      $setOnInsert: {
        tripId,
        profileId,
        role,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  )
}

export async function findTripById(db, tripId) {
  await ensureTripIndexes(db)
  return db.collection('trips').findOne({ tripId })
}

export async function profileCanAccessTrip(db, tripId, profileId) {
  const trip = await findTripById(db, tripId)
  if (!trip) return { trip: null, allowed: false }
  if (trip.ownerId === profileId) return { trip, allowed: true }

  const access = await db.collection('tripAccess').findOne({ tripId, profileId })
  return { trip, allowed: Boolean(access) }
}
