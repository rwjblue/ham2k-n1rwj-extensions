import type { PanelSceneControl, PanelSceneMapCircle } from '@ham2k/extension-sdk'
import { distanceKm, earthRadiusKm } from '../geography.ts'
import { type ReceptionMapCamera, receptionMapCamera } from './camera.ts'
import type { MapLocation, MapStation, MapTheme } from './types.ts'

export const receptionMapId = 'reception-map'

const maxMapPaths = 1024
const antipodeKm = earthRadiusKm * Math.PI

export function isMapLocation(location: MapLocation | undefined): location is MapLocation {
  return (
    location !== undefined &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180
  )
}

function opacityColor(color: string, opacity: number): string {
  return `#${Math.round(255 * opacity)
    .toString(16)
    .padStart(2, '0')}${color.slice(1)}`
}

function freshOpacity(minutes: number): number {
  return Number.isFinite(minutes) ? Math.max(0.32, 1 - Math.max(0, minutes) / 45) : 0.32
}

function distanceRings(theme: MapTheme): PanelSceneMapCircle[] {
  return [500, 1000, 2000, 5000, 10000, 15000].map((km, index) => {
    const showFromZoom = Math.max(0, 3 - index)
    return {
      id: `distance:${km}`,
      at: 'origin',
      km,
      color: opacityColor(theme.muted, 0.6),
      casing: opacityColor(theme.surface, 0.65),
      width: showFromZoom
        ? [
            [showFromZoom - 0.5, 0],
            [showFromZoom, 1],
          ]
        : 1,
      dashed: true,
      label: { unit: 'km' },
    }
  })
}

interface Options {
  context: string
  label: string
  rectangle: { x: number; y: number; width: number; height: number }
  origin: MapLocation
  stations: readonly MapStation[]
  projection: 'regional' | 'azimuthal'
  theme: MapTheme
  previous?: ReceptionMapCamera
}

export function buildReceptionMap({
  context,
  label,
  rectangle,
  origin,
  stations,
  projection,
  theme,
  previous,
}: Options): { control: PanelSceneControl; camera: ReceptionMapCamera; count: number } {
  const azimuthal = projection === 'azimuthal'
  const points = stations
    .filter(isMapLocation)
    .map((station) => ({ station, km: distanceKm(origin, station) }))
    // The host's azimuthal projection stops drawing near the antipode.
    .filter(({ km }) => !azimuthal || km <= antipodeKm * 0.97)
    .sort(
      (a, b) =>
        b.station.ageMinutes - a.station.ageMinutes || a.station.key.localeCompare(b.station.key),
    )
    .slice(-maxMapPaths)
  const camera = receptionMapCamera(
    context,
    rectangle,
    origin,
    points.map(({ station }) => station),
    azimuthal,
    previous,
  )
  const center = { lat: origin.latitude, lon: origin.longitude }
  const control: PanelSceneControl = {
    // A new fit owns a new host viewport, including when one axis did not change.
    id: camera.revision ? `${receptionMapId}-${camera.revision}` : receptionMapId,
    kind: 'map',
    label,
    event: 'map:view',
    ...rectangle,
    projection: azimuthal ? 'azimuthal' : 'equirectangular',
    ...(azimuthal ? { origin: center } : {}),
    home: camera.fit.home,
    zoom: { initial: camera.zoom },
    pan: { repeat: false },
    map: {
      sea: theme.surface,
      background: theme.surface,
      land: theme.land,
      coast: theme.border,
      borders: theme.border,
      divisions: theme.border,
      grayline: false,
    },
    styles: {
      origin: { fill: theme.text, color: theme.land, radius: 6.5, width: 2.5 },
      station: { color: theme.land, radius: 4, width: 1.5 },
      path: { width: 1.25 },
    },
    markers: [
      ...points.map(({ station }) => ({
        id: `station:${station.key}`,
        lat: station.latitude,
        lon: station.longitude,
        style: 'station',
        fill: opacityColor(theme.accent, freshOpacity(station.ageMinutes)),
      })),
      { id: 'origin', ...center, style: 'origin' },
    ],
    lines: points
      // At the antipode a great circle has no unique bearing. Its marker still helps.
      .filter(({ km }) => km / earthRadiusKm < Math.PI - 0.0002)
      .map(({ station }) => ({
        id: `path:${station.key}`,
        from: 'origin',
        to: `station:${station.key}`,
        style: 'path',
        color: opacityColor(theme.accent, freshOpacity(station.ageMinutes) * 0.46),
      })),
    ...(azimuthal ? { circles: distanceRings(theme) } : {}),
  }
  return { control, camera, count: points.length }
}
