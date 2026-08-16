import type { Trip } from '../types'
import { getOrCreateProfile } from './profile'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || ''

function apiKey(): string {
  const key = import.meta.env.VITE_API_KEY as string | undefined
  if (!key) {
    throw new Error('VITE_API_KEY manquant : cloud non configuré.')
  }
  return key
}

async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  const profile = getOrCreateProfile()
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey(),
      'x-profile-id': profile.profileId,
      'x-profile-token': profile.syncToken,
    },
    body: JSON.stringify(body),
    credentials: 'omit',
    cache: 'no-store',
  })

  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    throw new Error(data.error || `Erreur API ${response.status}`)
  }
  return data
}

export async function listCloudTrips(): Promise<Trip[]> {
  const data = await postJson<{ trips: Trip[] }>('/api/trips/list', {})
  return Array.isArray(data.trips) ? data.trips : []
}

export async function upsertCloudTrip(trip: Trip): Promise<void> {
  await postJson('/api/trips/upsert', { trip })
}

export async function deleteCloudTrip(id: string): Promise<void> {
  await postJson('/api/trips/delete', { id })
}

export async function testCloudConnection(): Promise<{ ok: boolean; database: string }> {
  return postJson('/api/trips/test', {})
}

export function isCloudConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_KEY)
}
