// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

import {
  bigfootBodyArtwork,
  bigfootLeftArmArtwork,
  bigfootRightArmArtwork,
  footprintArtwork,
  forestArtwork,
  skunkArtwork,
  sparkleArtwork,
} from './scene-art.ts'

function content(artwork: string): string {
  return artwork
    .replace(/^<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/id="([^"]+)"/g, 'id="hunt-preview-$1"')
    .replace(/url\(#([^)]+)\)/g, 'url(#hunt-preview-$1)')
}

function place(artwork: string, x: number, y: number, scale: number, rotation = ''): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})${rotation ? ` ${rotation}` : ''}">${content(artwork)}</g>`
}

// Path lettering also works in the host's font-free SVG thumbnail renderer.
const letters: Record<string, string> = {
  B: 'M4 2H17Q29 2 29 12Q29 21 17 21H4M17 21Q30 21 30 31Q30 40 17 40H4V2',
  I: 'M5 2H27M16 2V40M5 40H27',
  G: 'M29 8Q24 2 16 2C-3 2-3 40 16 40Q25 40 29 33V23H18',
  F: 'M5 40V2H29M5 20H25',
  O: 'M16 2C-2 2-2 40 16 40S34 2 16 2Z',
  T: 'M2 2H30M16 2V40',
}

const tiles = [...'BIGFOOT']
  .map(
    (letter, index) => `<g transform="translate(${45 + index * 80} 27)">
      <rect x="0" y="5" width="70" height="76" rx="12" fill="#15352A" opacity=".2"/>
      <rect x="0" y="0" width="70" height="76" rx="12" fill="#203F32" stroke="#738867" stroke-width="2"/>
      <path d="M11 9H59" fill="none" stroke="#49654B" stroke-width="2" stroke-linecap="round"/>
      <path d="${letters[letter]}" transform="translate(19 18)" fill="none" stroke="#C5D0B1" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`,
  )
  .join('')

/** A decorative catalog illustration: every tile has the same unearned treatment. */
export const huntPanelPreview = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <g transform="scale(${640 / 720} ${640 / 440})">${content(forestArtwork)}</g>
  <path d="M26 7H614Q633 7 633 26V113Q633 125 614 125H26Q7 125 7 113V26Q7 7 26 7Z" fill="#173C30" opacity=".12"/>
  ${tiles}
  <ellipse cx="323" cy="574" rx="157" ry="15" fill="#294C39" opacity=".24"/>
  ${place(bigfootLeftArmArtwork, 149, 284, 1.9, 'rotate(12 30 14)')}
  ${place(bigfootRightArmArtwork, 377, 284, 1.9, 'rotate(-132 30 14)')}
  ${place(bigfootBodyArtwork, 130, 162, 1.9)}
  ${place(footprintArtwork, 320, 596, 0.32, 'rotate(-25 28 36)')}
  ${place(footprintArtwork, 365, 583, 0.29, 'rotate(12 28 36)')}
  ${place(footprintArtwork, 407, 570, 0.26, 'rotate(-25 28 36)')}
  ${place(footprintArtwork, 445, 555, 0.23, 'rotate(12 28 36)')}
  ${place(footprintArtwork, 505, 459, 0.36, 'rotate(8 28 36)')}
  ${place(skunkArtwork, 475, 494, 1.12)}
  ${place(sparkleArtwork, 99, 211, 0.65)}
  ${place(sparkleArtwork, 559, 177, 0.55)}
  ${place(sparkleArtwork, 578, 427, 0.4)}
</svg>`
