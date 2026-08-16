import { v4 as uuid } from 'uuid'

const PROFILE_KEY = 'repartcount.profile.v1'

export interface CloudProfile {
  profileId: string
  syncToken: string
}

export function getOrCreateProfile(): CloudProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CloudProfile
      if (parsed.profileId && parsed.syncToken) return parsed
    }
  } catch {
    // ignore and recreate
  }

  const profile: CloudProfile = {
    profileId: uuid(),
    syncToken: uuid(),
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  return profile
}
