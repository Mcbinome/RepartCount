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

export async function joinCloudTrip(id: string): Promise<Trip> {
  const data = await postJson<{ trip: Trip }>('/api/trips/join', { id })
  if (!data.trip) throw new Error('Groupe introuvable')
  return data.trip
}

export async function testCloudConnection(): Promise<{ ok: boolean; database: string }> {
  return postJson('/api/trips/test', {})
}

export function isCloudConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_KEY)
}

export function getTripShareUrl(tripId: string): string {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('g', tripId)
  return url.toString()
}

export function readSharedTripIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('g')?.trim()
  return id || null
}

export function setSharedTripInUrl(tripId: string | null): void {
  const url = new URL(window.location.href)
  if (tripId) url.searchParams.set('g', tripId)
  else url.searchParams.delete('g')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
