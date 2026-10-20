// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0
import {
  graveyardArtwork,
  lanternArtwork,
  pumpkinArtwork,
  sparkleArtwork,
  tombstoneArtwork,
  zombieBodyArtwork,
  zombieLeftArmArtwork,
  zombieRightArmArtwork,
} from './scene-art.ts'

function content(artwork: string, namespace: string): string {
  return artwork
    .replace(/^<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/id="([^"]+)"/g, `id="${namespace}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${namespace}-$1)`)
}

function place(
  artwork: string,
  name: string,
  x: number,
  y: number,
  scale: number,
  rotation = '',
): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})${rotation ? ` ${rotation}` : ''}">${content(artwork, `zombie-picker-${name}`)}</g>`
}

// Original monoline path lettering survives the font-free picker renderer.
const letters: Record<string, string> = {
  Z: 'M3 3H37L3 47H37',
  O: 'M20 3C-3 3-3 47 20 47S43 3 20 3Z',
  M: 'M3 47V3L20 26 37 3V47',
  B: 'M4 3H20Q36 3 36 14Q36 25 20 25H4M20 25Q38 25 38 36Q38 47 20 47H4V3',
  I: 'M6 3H34M20 3V47M6 47H34',
  E: 'M37 3H4V47H37M4 25H31',
  S: 'M35 8Q29 3 20 3C-3 3-1 24 19 25S43 47 20 47Q9 47 3 41',
  H: 'M4 3V47M36 3V47M4 25H36',
  U: 'M4 3V32Q4 47 20 47T36 32V3',
  F: 'M4 47V3H37M4 25H31',
  L: 'M4 3V47H37',
}

function lettering(word: string, y: number, scale: number, advance: number): string {
  const width = ((word.length - 1) * advance + 40) * scale
  return `<g transform="translate(${(640 - width) / 2} ${y}) scale(${scale})" fill="none" stroke="#F5E3C6" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round">
    ${[...word].map((letter, index) => `<path d="${letters[letter]}" transform="translate(${index * advance} 0)"/>`).join('')}
  </g>`
}

/** A welcoming illustration, independent of the operation's score or log. */
export const zombiePanelPreview = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-label="Zombie Shuffle midnight radio club">
  <title>Zombie Shuffle midnight radio club</title>
  <desc>A friendly green Zombie in headphones waves beside a lantern, with a moonlit cemetery and warmly lit radio shack behind.</desc>
  <defs>
    <linearGradient id="zombie-picker-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#241B3D"/><stop offset="1" stop-color="#50405F"/></linearGradient>
    <linearGradient id="zombie-picker-plaque" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#4D3C60"/><stop offset="1" stop-color="#30233F"/></linearGradient>
    <clipPath id="zombie-picker-bounds"><rect x="5" y="5" width="630" height="630" rx="29"/></clipPath>
  </defs>
  <g clip-path="url(#zombie-picker-bounds)">
    <rect width="640" height="640" fill="url(#zombie-picker-sky)"/>
    ${place(graveyardArtwork, 'graveyard', -88, 146, 1.16)}
    <path d="M24 164q77 10 149 1t144 1q77 10 147-1t152 0" fill="none" stroke="#A28AA7" stroke-width="2" opacity=".23"/>
    <rect x="31" y="22" width="578" height="150" rx="24" fill="#17162C" opacity=".25"/>
    <rect x="31" y="17" width="578" height="150" rx="24" fill="url(#zombie-picker-plaque)" stroke="#92788F" stroke-width="2.5"/>
    <path d="M51 39q0-8 9-8h520q9 0 9 8" fill="none" stroke="#B5A0B0" stroke-width="2" stroke-linecap="round" opacity=".45"/>
    ${lettering('ZOMBIE', 40, 1.3, 62)}
    ${lettering('SHUFFLE', 118, 0.65, 48)}
    <g fill="#D9C18D">
      <path d="m119 128 2.2 6.8 6.8 2.2-6.8 2.2-2.2 6.8-2.2-6.8-6.8-2.2 6.8-2.2Z"/>
      <path d="m521 128 2.2 6.8 6.8 2.2-6.8 2.2-2.2 6.8-2.2-6.8-6.8-2.2 6.8-2.2Z"/>
    </g>
    <ellipse cx="308" cy="575" rx="151" ry="18" fill="#152536" opacity=".28"/>
    ${place(tombstoneArtwork, 'tombstone', 452, 452, 1.02, 'rotate(4 55 126)')}
    ${place(zombieLeftArmArtwork, 'left-arm', 186.6, 374, 1.7, 'rotate(10 30 12)')}
    ${place(zombieRightArmArtwork, 'right-arm', 329.4, 374, 1.7, 'rotate(-118 30 12)')}
    ${place(zombieBodyArtwork, 'body', 139, 187, 1.7)}
    ${place(lanternArtwork, 'lantern', 70, 461, 1.25, 'rotate(-5 32 74)')}
    ${place(pumpkinArtwork, 'pumpkin', 527, 548, 1.08)}
    ${place(sparkleArtwork, 'moon-sparkle', 190, 203, 0.46)}
    ${place(sparkleArtwork, 'lantern-sparkle', 47, 450, 0.4)}
    <path d="M0 623q99-13 179 2t171 0q78-9 151 0t139-1v16H0Z" fill="#223642"/>
  </g>
  <rect x="5" y="5" width="630" height="630" rx="29" fill="none" stroke="#86718F" stroke-width="3"/>
</svg>`
