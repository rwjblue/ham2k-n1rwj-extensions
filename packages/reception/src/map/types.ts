export interface MapLocation {
  latitude: number
  longitude: number
  label?: string
}

export interface MapStation extends MapLocation {
  key: string
  label: string
  ageMinutes: number
}

export interface MapTheme {
  surface: string
  land: string
  text: string
  muted: string
  border: string
  accent: string
}

export interface ReceptionMapOptions {
  origin?: MapLocation
  stations: readonly MapStation[]
  /** Fit reports on a north-up map, or preserve distances/bearings from the origin. */
  projection?: 'regional' | 'azimuthal'
  filterKey?: string
}
