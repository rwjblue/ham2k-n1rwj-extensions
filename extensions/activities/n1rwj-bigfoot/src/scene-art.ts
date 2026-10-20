// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

// Original vector illustrations. Labels belong to native scene text layers.
// Each export is a complete, independently renderable SVG without animation.
function svg(width: number, height: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`
}

function pine(x: number, y: number, width: number, height: number, fill: string): string {
  return `<g transform="translate(${x} ${y}) scale(${width / 100} ${height / 200})">
    <path d="M47 157H54V200H47Z" fill="${fill}"/>
    <path d="M50 0 36 31 42 30 24 65 33 61 12 100 24 95 2 137 18 130 0 167Q21 173 43 169L50 174 57 169Q80 173 100 167L82 130 98 137 76 95 88 100 67 61 76 65 58 30 64 31Z" fill="${fill}"/>
  </g>`
}

export const forestArtwork = svg(
  720,
  440,
  `<defs>
    <linearGradient id="forest-sky" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#BFD7D2"/><stop offset=".56" stop-color="#E8E7CC"/><stop offset="1" stop-color="#FAE7B9"/>
    </linearGradient>
    <linearGradient id="forest-floor" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#B6C18A"/><stop offset="1" stop-color="#788F66"/>
    </linearGradient>
    <linearGradient id="forest-path" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#EBD6A1"/><stop offset="1" stop-color="#D0B37A"/>
    </linearGradient>
    <linearGradient id="forest-sign" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#D4A267"/><stop offset="1" stop-color="#B67F47"/>
    </linearGradient>
    <radialGradient id="forest-moon"><stop stop-color="#FFF9DF" stop-opacity=".75"/><stop offset="1" stop-color="#FFF9DF" stop-opacity="0"/></radialGradient>
    <radialGradient id="forest-firefly"><stop stop-color="#FFE9A2" stop-opacity=".9"/><stop offset="1" stop-color="#FFE9A2" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="720" height="440" fill="url(#forest-sky)"/>
  <circle cx="594" cy="75" r="65" fill="url(#forest-moon)"/>
  <circle cx="594" cy="75" r="25" fill="#FFF8DC"/>
  <path d="M574 76Q578 56 598 53A25 25 0 0 0 574 76Z" fill="#FFFDF0"/>
  <g fill="#F7F6E5" opacity=".62">
    <path d="M111 75C120 63 135 64 141 73 151 70 164 74 166 81H101Q101 75 111 75Z"/>
    <path d="M406 57C415 48 427 49 433 57 443 54 453 58 454 64H394Q394 58 406 57Z"/>
    <path d="M574 103C584 91 600 93 605 102 618 98 629 105 629 110H561Q561 103 574 103Z"/>
  </g>
  <path d="M0 198 62 163 115 187 207 105 255 140 292 133 367 213 425 165 468 185 555 121 601 162 648 149 720 193V339H0Z" fill="#ABC2B0"/>
  <path d="m149 160 58-55 48 35 37-7 35 39-43-22-27 10-48-31-30 28Z" fill="#DFE5CD" opacity=".8"/>
  <path d="m504 159 51-38 46 41 47-13 36 22-40-8-42 15-44-34-32 25Z" fill="#D9E2C9" opacity=".72"/>
  <path d="M0 249Q93 179 190 213T370 229Q472 186 539 211T720 215V342H0Z" fill="#91AD98"/>
  ${[
    [0, 134, 56, 180],
    [38, 155, 53, 160],
    [80, 180, 44, 139],
    [126, 160, 52, 165],
    [174, 190, 40, 137],
    [217, 183, 43, 144],
    [456, 175, 46, 155],
    [494, 156, 56, 174],
    [543, 178, 44, 154],
    [583, 145, 54, 180],
    [628, 154, 47, 170],
    [673, 129, 61, 204],
  ]
    .map(([x, y, w, h]) => pine(x, y, w, h, '#718E79'))
    .join('')}
  <path d="M0 315Q106 267 209 293T394 292Q535 260 720 299V440H0Z" fill="url(#forest-floor)"/>
  <path d="M342 287C326 302 343 316 387 329S463 371 506 440H218C261 401 313 385 343 365S365 344 341 329 325 302 342 287Z" fill="url(#forest-path)" opacity=".92"/>
  <path d="M251 422Q302 391 342 371M394 339Q413 349 424 360" fill="none" stroke="#F5E4BB" stroke-width="3" stroke-linecap="round" opacity=".55"/>
  ${pine(-43, 7, 164, 370, '#355B4C')}
  ${pine(49, 88, 105, 264, '#486D56')}
  ${pine(608, 36, 145, 341, '#365C4B')}
  ${pine(567, 122, 91, 227, '#4C7157')}
  <path d="M0 362Q44 345 89 365T154 369L174 440H0Z" fill="#456A4E"/>
  <path d="M556 386Q608 347 655 363T720 351V440H532Z" fill="#41654A"/>
  <g fill="#274E3E" opacity=".7">
    <path d="m32 440-5-71 10 14 4-27 9 24 14-19-4 32 22-15-13 38 20-10-8 34Z"/>
    <path d="m672 440 5-70-11 14-4-26-9 23-14-18 4 31-22-15 13 37-20-10 8 34Z"/>
  </g>
  <g fill="none" stroke="#8EA56C" stroke-width="2" stroke-linecap="round">
    <path d="M87 425Q80 390 56 377M78 401 60 397M73 391 75 380M82 412 99 400M653 421Q661 391 684 383M665 401 682 399M671 392 669 382M659 412 645 400"/>
  </g>
  <g>
    <path d="M83 391V406Q85 410 89 407L91 390" fill="#F4DBA5"/>
    <path d="M70 392Q75 374 87 376T105 392Q90 397 70 392Z" fill="#BB6C4E" stroke="#795642" stroke-width="1.5"/>
    <ellipse cx="82" cy="384" rx="3" ry="2" fill="#FFE6BB"/><ellipse cx="94" cy="388" rx="2.5" ry="1.8" fill="#FFE6BB"/>
    <path d="M111 404V414Q114 417 117 413L116 403" fill="#F4DBA5"/>
    <path d="M101 405Q103 392 113 393T126 405Q114 409 101 405Z" fill="#D09A58" stroke="#795642" stroke-width="1.4"/>
    <ellipse cx="112" cy="398" rx="2.5" ry="1.5" fill="#FFE6BB"/>
  </g>
  <g fill="#D0D5AC" opacity=".72">
    <ellipse cx="187" cy="379" rx="12" ry="4"/><ellipse cx="516" cy="408" rx="15" ry="4"/>
    <ellipse cx="274" cy="324" rx="8" ry="2.5"/><ellipse cx="458" cy="312" rx="11" ry="3"/>
  </g>
  <g transform="translate(524 303)">
    <path d="M57 41H69L67 105H58Z" fill="#795338" stroke="#604B35" stroke-width="2"/>
    <path d="m62 75 1 25" stroke="#A47849" stroke-width="2"/>
    <path d="M2 5 112 0 132 24 114 48 3 52 8 29Z" fill="url(#forest-sign)" stroke="#775337" stroke-width="3" stroke-linejoin="round"/>
    <path d="m10 13 99-4M13 43l96-4" fill="none" stroke="#E4BC80" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    <path d="M13 27 6 29M116 18l8 6-9 8" fill="none" stroke="#986333" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="16" cy="18" r="2" fill="#775337"/><circle cx="15" cy="38" r="2" fill="#775337"/>
  </g>
  <g>
    <circle cx="177" cy="251" r="15" fill="url(#forest-firefly)"/><circle cx="177" cy="251" r="2.2" fill="#FFEDB2"/>
    <circle cx="496" cy="266" r="13" fill="url(#forest-firefly)"/><circle cx="496" cy="266" r="2" fill="#FFF0BB"/>
    <circle cx="541" cy="202" r="12" fill="url(#forest-firefly)"/><circle cx="541" cy="202" r="1.8" fill="#FFF0BB"/>
    <circle cx="143" cy="323" r="12" fill="url(#forest-firefly)"/><circle cx="143" cy="323" r="1.8" fill="#FFEDB2"/>
    <circle cx="471" cy="362" r="10" fill="url(#forest-firefly)"/><circle cx="471" cy="362" r="1.8" fill="#FFEDB2"/>
  </g>
  <path d="M0 431Q67 413 132 429T271 432Q416 424 514 433T720 423V440H0Z" fill="#365B45"/>
  <g stroke="#91A46B" stroke-width="2" stroke-linecap="round">
    <path d="m154 433-4-8m8 7 4-11m335 14-3-8m8 9 5-12m-289 10 1-6"/>
  </g>`,
)

export const bigfootBodyArtwork = svg(
  200,
  220,
  `<defs>
    <linearGradient id="bigfoot-fur" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#A57549"/><stop offset=".5" stop-color="#8A5838"/><stop offset="1" stop-color="#69452F"/></linearGradient>
    <linearGradient id="bigfoot-chest" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#BE8B55"/><stop offset="1" stop-color="#A16B41"/></linearGradient>
  </defs>
  <ellipse cx="101" cy="214" rx="67" ry="5" fill="#294C39" opacity=".16"/>
  <path d="m63 33 10-13 9 8 10-15 9 12 13-8 6 14 12-2 2 13c12 7 18 18 18 34l10 2-3 10 13 10-5 8 8 13-7 7c5 22-1 40-14 54l4 9-12 3-7 17-31 4-10-17-10 18-34-4-6-16-13-3 4-11c-12-13-16-33-12-52l-7-7 8-12-5-9 13-10-2-10 11-2c0-17 6-30 16-38Z" fill="url(#bigfoot-fur)" stroke="#543C2B" stroke-width="3.4" stroke-linejoin="round"/>
  <path d="M61 116c8-16 18-22 39-22s35 9 41 26l-6 5 6 15-10 2 1 16-12-2-9 12-11-6-13 6-9-11-12 1 2-15-9-5 9-12Z" fill="url(#bigfoot-chest)"/>
  <path d="m74 112 10 5 9-7 10 7 11-7 11 6m-51 21 10 4 9-6 10 6 13-4m-31 17 10-4 10 4" fill="none" stroke="#D1A36A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>
  <path d="m50 111-4 11m6 8-4 10m104-29 4 11m-6 7 5 11m-94 28 7 5m61-5-7 5" fill="none" stroke="#BE8954" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="57" cy="64" rx="9" ry="13" fill="#9F7048" stroke="#65452F" stroke-width="2"/>
  <ellipse cx="145" cy="64" rx="9" ry="13" fill="#9F7048" stroke="#65452F" stroke-width="2"/>
  <ellipse cx="58" cy="64" rx="4.5" ry="7" fill="#C59665"/><ellipse cx="144" cy="64" rx="4.5" ry="7" fill="#C59665"/>
  <path d="M65 48q16-15 35-6 19-9 36 6l4 26c-1 18-15 29-39 29S63 92 62 75Z" fill="#D2A36B"/>
  <path d="M68 48q15-10 31-4m7 0q14-6 27 4" fill="none" stroke="#E5BD84" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="82" cy="63" rx="8.5" ry="10" fill="#FFFAE9"/>
  <ellipse cx="119" cy="63" rx="8.5" ry="10" fill="#FFFAE9"/>
  <ellipse cx="84" cy="64" rx="4.3" ry="6.2" fill="#2D4135"/>
  <ellipse cx="117" cy="64" rx="4.3" ry="6.2" fill="#2D4135"/>
  <circle cx="85.4" cy="61.8" r="1.7" fill="#FFFDF2"/><circle cx="118.4" cy="61.8" r="1.7" fill="#FFFDF2"/>
  <path d="M73 49q9-5 18 0m18 0q9-5 18 0" fill="none" stroke="#65432E" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="100" cy="87" rx="25" ry="17" fill="#E7BE87"/>
  <ellipse cx="100" cy="76" rx="11.5" ry="7" fill="#714B32"/>
  <path d="M94 74q6-3 12 0" fill="none" stroke="#A0764E" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="72" cy="80" rx="6.5" ry="3.6" fill="#BB785D" opacity=".42"/><ellipse cx="129" cy="80" rx="6.5" ry="3.6" fill="#BB785D" opacity=".42"/>
  <path d="M85 89q15 15 30 0" fill="#845237" stroke="#61442F" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M94 97q6-3 12 0" fill="none" stroke="#CA9470" stroke-width="2.4" stroke-linecap="round"/>
  <path d="m88 30 5 7 7-5 8 4m-40 59 7 7m51-6 7-5" fill="none" stroke="#BA8851" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M57 184c-14 0-23 9-22 19 1 8 17 10 34 10s29-2 29-11c0-10-9-20-23-20Z" fill="#855835" stroke="#543C2B" stroke-width="3"/>
  <path d="M127 182c-14 0-24 9-24 20 0 8 13 11 30 11s31-3 32-11c1-10-8-18-22-18Z" fill="#855835" stroke="#543C2B" stroke-width="3"/>
  <g fill="#B38250">
    <ellipse cx="47" cy="201" rx="7" ry="5.2"/><ellipse cx="62" cy="204" rx="7.3" ry="5.5"/><ellipse cx="78" cy="203" rx="7.1" ry="5.2"/>
    <ellipse cx="119" cy="203" rx="7.1" ry="5.2"/><ellipse cx="135" cy="204" rx="7.3" ry="5.5"/><ellipse cx="151" cy="201" rx="7" ry="5.2"/>
  </g>
  <path d="m47 192 4-5m95 5-4-5" stroke="#C59B63" stroke-width="2" stroke-linecap="round"/>`,
)

function armArtwork(id: string, mirror: boolean): string {
  return svg(
    60,
    110,
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#A57549"/><stop offset="1" stop-color="#704B31"/></linearGradient></defs>
    <g${mirror ? ' transform="translate(60 0) scale(-1 1)"' : ''}>
      <path d="M27 6C14 10 10 24 9 39l-4 5 3 8-5 10 4 8c-5 11-1 22 9 26l2 7c3 6 8 6 12 2 6 4 11 1 12-4 7 0 10-6 7-12l-5-16c-3-12-2-24 2-36l4-16C51 10 39 2 27 6Z" fill="url(#${id})" stroke="#543C2B" stroke-width="3" stroke-linejoin="round"/>
      <path d="M23 20c-5 8-5 20-5 28m4 8-4 9m12-33-2 12" fill="none" stroke="#BE8A54" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M19 84c-6 4-7 12-2 16l6 4 6-1 6 1 7-8-1-9-10-5Z" fill="#B98654"/>
      <path d="m22 94 1 8m9-7 1 7m8-12 1 7" fill="none" stroke="#805436" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M12 83q-5 10 2 14" fill="none" stroke="#543C2B" stroke-width="2" stroke-linecap="round"/>
    </g>`,
  )
}

export const bigfootLeftArmArtwork = armArtwork('bigfoot-left-arm', false)
export const bigfootRightArmArtwork = armArtwork('bigfoot-right-arm', true)

export const skunkArtwork = svg(
  112,
  104,
  `<defs><linearGradient id="skunk-coat" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#42534B"/><stop offset="1" stop-color="#263B34"/></linearGradient></defs>
  <ellipse cx="55" cy="99" rx="40" ry="4" fill="#254B36" opacity=".16"/>
  <path d="M62 72c29 7 47-12 44-38C104 13 87 2 74 13 62 23 66 40 78 41c9 1 13-7 8-13 12 6 11 22 0 29-7 5-14 4-21 2Z" fill="url(#skunk-coat)" stroke="#23392F" stroke-width="2.5"/>
  <path d="M69 67c24 0 34-18 28-35-4-12-14-17-19-9-4 6 0 11 5 10" fill="none" stroke="#F6F0D7" stroke-width="10" stroke-linecap="round"/>
  <path d="M65 72c9-1 17-4 22-9" fill="none" stroke="#D6DFC8" stroke-width="2" stroke-linecap="round"/>
  <path d="M30 89c-3 2-7 6-5 9 2 2 11 3 16 0l4-10m13 2c-1 5 0 9 5 9h12c5-1 4-5 1-8" fill="#2A3C32" stroke="#23392F" stroke-width="2"/>
  <ellipse cx="55" cy="74" rx="31" ry="23" fill="url(#skunk-coat)" stroke="#23392F" stroke-width="2.5"/>
  <path d="M51 53q14-2 23 12l-9 4-8-7-12 1Z" fill="#F6F0D7"/>
  <ellipse cx="32" cy="43" rx="10" ry="12" fill="#364C40" stroke="#23392F" stroke-width="2"/>
  <ellipse cx="32" cy="42" rx="5" ry="6.5" fill="#BC9785"/>
  <path d="M49 51c-3-12-21-16-30-7S7 65 15 76c7 11 26 11 35 1l7-9-8-6Z" fill="url(#skunk-coat)" stroke="#23392F" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M32 40c4 7 4 13-1 20l-8 7-5-5c11-5 13-11 10-20Z" fill="#F6F0D7"/>
  <ellipse cx="22" cy="68" rx="13" ry="9" fill="#E6DDC2"/>
  <ellipse cx="14" cy="63" rx="6" ry="4" fill="#253B33"/>
  <ellipse cx="34" cy="58" rx="5.5" ry="6.5" fill="#FFF9E7"/><ellipse cx="33" cy="59" rx="2.8" ry="4" fill="#273C32"/>
  <circle cx="34" cy="57.5" r="1.2" fill="#FFFDF3"/>
  <path d="M17 71q6 6 13 1" fill="none" stroke="#52604B" stroke-width="1.7" stroke-linecap="round"/>
  <path d="m44 78 5 5m8 2 4 4" fill="none" stroke="#687663" stroke-width="2" stroke-linecap="round"/>`,
)

export const footprintArtwork = svg(
  56,
  72,
  `<g fill="#E6BB71" stroke="#B88642" stroke-width="1.5">
    <path d="M15 29c-8 5-10 15-6 23l6 12c3 6 13 7 20 3 7-5 6-12 8-19 3-8 2-16-4-20-7-5-17-4-24 1Z"/>
    <ellipse cx="7" cy="23" rx="5" ry="7" transform="rotate(-22 7 23)"/>
    <ellipse cx="16" cy="12" rx="6" ry="8" transform="rotate(-13 16 12)"/>
    <ellipse cx="29" cy="9" rx="6.5" ry="8"/>
    <ellipse cx="42" cy="14" rx="5.7" ry="7.2" transform="rotate(15 42 14)"/>
    <ellipse cx="50" cy="25" rx="4.5" ry="6" transform="rotate(25 50 25)"/>
  </g>
  <path d="M16 39q7-7 17-4m-14 23 3 4" fill="none" stroke="#F6DC9F" stroke-width="2.5" stroke-linecap="round"/>`,
)

export const sparkleArtwork = svg(
  40,
  40,
  `<path d="M20 2c1 12 5 16 17 18-12 2-16 6-17 18-2-12-6-16-18-18C14 18 18 14 20 2Z" fill="#F1CD7C"/>
  <path d="M20 10c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z" fill="#FFF4CF"/>
  <path d="m33 2 1.4 4.6L39 8l-4.6 1.4L33 14l-1.4-4.6L27 8l4.6-1.4Z" fill="#FFE7A7"/>
  <circle cx="6" cy="34" r="2.2" fill="#FFE7A7"/>`,
)
