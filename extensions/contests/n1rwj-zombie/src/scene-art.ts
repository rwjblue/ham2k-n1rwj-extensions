// Copyright © 2026 Robert Jackson, N1RWJ
// SPDX-License-Identifier: MPL-2.0

// Original vector illustrations. The scene supplies accessible native labels
// and animates independent layers; the artwork itself is static and font-free.
function svg(width: number, height: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`
}

function pumpkin(x: number, y: number, scale: number): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="26" cy="41" rx="26" ry="5" fill="#181B31" opacity=".3"/>
    <path d="M24 12q-5-10 4-14l5 4q-7 2-5 11" fill="#799673" stroke="#3F5F54" stroke-width="2" stroke-linejoin="round"/>
    <path d="M25 11C5 3-5 17 2 32c3 8 11 12 23 11 13 2 23-4 25-14C54 15 43 4 25 11Z" fill="#D7783C" stroke="#7B493E" stroke-width="2.2"/>
    <ellipse cx="25" cy="26" rx="13" ry="17" fill="#F29A4A"/>
    <path d="M17 12q-10 14-2 29m20-29q9 13 1 29" fill="none" stroke="#F5B75F" stroke-width="2" opacity=".7"/>
    <path d="m11 23 5-6 4 7m10 0 5-7 4 6" fill="#FFE9A0" stroke="#96503C" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M15 30q11 13 22-1-3 12-13 11-6 0-9-10Z" fill="#FFE9A0" stroke="#96503C" stroke-width="1.5" stroke-linejoin="round"/>
  </g>`
}

function distantStone(x: number, y: number, scale: number, tilt = 0): string {
  return `<g transform="translate(${x} ${y}) rotate(${tilt}) scale(${scale})">
    <path d="M0 58V23C0-8 43-8 43 23v35Z" fill="#666581" stroke="#85829B" stroke-width="1.5"/>
    <path d="M8 58V25C8 6 35 6 35 25" fill="none" stroke="#B1A2B7" stroke-width="1.8" opacity=".5"/>
    <path d="M14 29h15m-12 6h10" stroke="#383F5E" stroke-width="2.3" stroke-linecap="round"/>
    <ellipse cx="22" cy="59" rx="29" ry="4" fill="#303A56" opacity=".6"/>
  </g>`
}

export const graveyardArtwork = svg(
  720,
  440,
  `<defs>
    <linearGradient id="graveyard-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#1E183B"/><stop offset=".57" stop-color="#4D3D6B"/><stop offset="1" stop-color="#80708B"/></linearGradient>
    <linearGradient id="graveyard-ground" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#4C5267"/><stop offset="1" stop-color="#283E4B"/></linearGradient>
    <linearGradient id="graveyard-path" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#A39A98"/><stop offset="1" stop-color="#797889"/></linearGradient>
    <linearGradient id="graveyard-roof" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#53425E"/><stop offset="1" stop-color="#2A2D4A"/></linearGradient>
    <linearGradient id="graveyard-timber" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#725469"/><stop offset="1" stop-color="#483C56"/></linearGradient>
    <linearGradient id="graveyard-window" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFE3A0"/><stop offset="1" stop-color="#DB9A6C"/></linearGradient>
    <radialGradient id="graveyard-moonlight"><stop stop-color="#E3CEF4" stop-opacity=".2"/><stop offset=".6" stop-color="#CDBCE8" stop-opacity=".07"/><stop offset="1" stop-color="#CDBCE8" stop-opacity="0"/></radialGradient>
    <radialGradient id="graveyard-lamplight"><stop stop-color="#FFCA7A" stop-opacity=".5"/><stop offset="1" stop-color="#FFCA7A" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="720" height="440" fill="url(#graveyard-sky)"/>
  <ellipse cx="144" cy="81" rx="142" ry="111" fill="url(#graveyard-moonlight)"/>
  <circle cx="144" cy="79" r="32" fill="#EEDFD0"/>
  <path d="M125 91a32 32 0 0 1 34-42 32 32 0 1 0 11 57q-30 10-45-15Z" fill="#D7C6CD"/>
  <ellipse cx="152" cy="65" rx="6" ry="4" fill="#C9B8C6" opacity=".7"/>
  <circle cx="137" cy="89" r="4.5" fill="#C9B8C6" opacity=".65"/>
  <circle cx="159" cy="85" r="2.7" fill="#C9B8C6" opacity=".6"/>
  <g fill="#E9DBDC">
    ${[
      [63, 46, 1.4],
      [219, 39, 1.3],
      [267, 91, 1.7],
      [316, 42, 1.2],
      [366, 94, 1.4],
      [411, 35, 1.7],
      [451, 119, 1.2],
      [488, 64, 1.4],
      [555, 32, 1.2],
      [627, 50, 1.6],
      [669, 114, 1.2],
      [83, 138, 1.3],
      [232, 159, 1.2],
      [332, 137, 1.1],
      [397, 159, 1.4],
      [599, 104, 1.1],
    ]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity=".65"/>`)
      .join('')}
    <path d="m302 75 1.4 4.6 4.6 1.4-4.6 1.4-1.4 4.6-1.4-4.6-4.6-1.4 4.6-1.4Z"/>
    <path d="m589 60 1.5 5.5 5.5 1.5-5.5 1.5-1.5 5.5-1.5-5.5-5.5-1.5 5.5-1.5Z" opacity=".75"/>
  </g>
  <g fill="none" stroke="#A28BAA" stroke-linecap="round" opacity=".12">
    <path d="M25 114q40-10 86-5m31 5q36 4 65-2" stroke-width="9"/>
    <path d="M390 83q33-7 70-4m20 1q25 5 49 0" stroke-width="7"/>
    <path d="M190 192q95-10 159-2m17 0h82" stroke-width="9"/>
  </g>
  <path d="M0 231Q55 198 106 209T210 215Q265 185 329 209T442 205Q502 177 573 198T720 196V339H0Z" fill="#42435F"/>
  <path d="M0 267Q61 229 127 244T258 243Q331 216 402 245T556 236Q633 216 720 245V349H0Z" fill="#424E64"/>
  <g fill="#33384F">
    <path d="M83 257 71 193l-13-19 4-4 14 14-4-40 6-1 4 43 17-20 4 4-19 29 10 60Z"/>
    <path d="m415 249 5-58-13-18 4-3 11 14 5-38 5 1-4 43 19-18 3 4-22 26-4 50Z"/>
    <path d="m478 248-8-28 4-4 6 16 8-42 4 1-5 41 14-8 3 4-20 15 1 9Z"/>
  </g>
  ${distantStone(114, 229, 0.68, -9)}
  ${distantStone(181, 245, 0.53, 6)}
  ${distantStone(337, 225, 0.59, -4)}
  ${distantStone(390, 246, 0.5, 6)}
  <g fill="none" stroke="#8D7895" stroke-linecap="round" opacity=".45">
    <path d="M204 278V245m22 30v-33m22 31v-33m22 32v-33m22 31v-31m22 30v-30" stroke-width="3"/>
    <path d="M204 252q11-20 22-2 11-20 22-2 11-20 22-1 11-20 22-1 11-20 22 0" stroke-width="2"/>
    <path d="m202 261 114-9" stroke-width="2"/>
  </g>
  <path d="M0 310Q91 269 208 291T412 287Q553 262 720 300V440H0Z" fill="url(#graveyard-ground)"/>
  <path d="M563 289c-27 15-52 26-62 45-11 20 23 29 34 45 9 15-4 36-35 61h158c-15-41-27-61-57-79-24-15-50-18-41-33 7-11 16-23 22-34Z" fill="url(#graveyard-path)" opacity=".9"/>
  <g fill="none" stroke="#C9BAB4" stroke-linecap="round" opacity=".32">
    <path d="m543 320 20 2m-33 16 18 4m20 35 18 8m-51 29 25 4" stroke-width="3"/>
    <path d="m568 349 13 2m17 44 16 4" stroke-width="2"/>
  </g>
  <ellipse cx="569" cy="300" rx="109" ry="64" fill="url(#graveyard-lamplight)" opacity=".45"/>
  <g transform="translate(498 139)">
    <path d="m20 63 58-47 74 49v100H20Z" fill="url(#graveyard-timber)" stroke="#2C2D48" stroke-width="4" stroke-linejoin="round"/>
    <path d="M7 65 75 4l89 61-10 12-77-48-59 48Z" fill="url(#graveyard-roof)" stroke="#2A2D48" stroke-width="4" stroke-linejoin="round"/>
    <path d="m20 66 56-48 76 49" fill="none" stroke="#9C8194" stroke-width="3" stroke-linecap="round" opacity=".65"/>
    <path d="M27 94h115M27 115h116M27 137h116M29 157h112" stroke="#382F4B" stroke-width="2" opacity=".55"/>
    <rect x="34" y="79" width="60" height="57" rx="4" fill="url(#graveyard-window)" stroke="#342C46" stroke-width="5"/>
    <path d="M64 79v57M34 89h60" stroke="#6E495A" stroke-width="3"/>
    <path d="M38 84h21v3H38Z" fill="#FFF3C3" opacity=".8"/>
    <path d="M39 124h50v11H39Z" fill="#584050"/>
    <rect x="44" y="106" width="38" height="20" rx="3" fill="#384657" stroke="#283443" stroke-width="2"/>
    <rect x="48" y="110" width="18" height="7" rx="1" fill="#A6E0C8"/>
    <path d="M50 115h3l2-3 2 3h6" fill="none" stroke="#3A8D85" stroke-width="1"/>
    <circle cx="74" cy="115" r="4" fill="#CEAB7D"/><circle cx="74" cy="115" r="2" fill="#655269"/>
    <path d="M49 123h4m3 0h4m3 0h4" stroke="#A2B6A7" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="108" y="83" width="29" height="79" rx="14" fill="#354A55" stroke="#2E2E46" stroke-width="4"/>
    <path d="M113 101q0-14 19-11v25h-19Z" fill="#E7BC87" opacity=".85"/>
    <path d="M122 91v23" stroke="#705269" stroke-width="2"/>
    <circle cx="130" cy="129" r="2.5" fill="#DBBA87"/>
    <path d="M14 164h143l7 10H6Z" fill="#887080" stroke="#34364B" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="m49 33-3-44m-12 9 25-7m-29 0 30-9m-18 9-3-13" fill="none" stroke="#B5A3B4" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M47-8Q124-4 181-48m0-5v139" fill="none" stroke="#A594AE" stroke-width="1.5"/>
    <path d="m173-52 16-4" stroke="#D3BCC5" stroke-width="2" stroke-linecap="round"/>
  </g>
  <g fill="none" stroke="#232B44" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 371Q48 273 37 158L26 77M40 218 3 180m38 5 43-44m-48 22 35-58M31 122 6 95m55 62 29-4m-24-37 19-24M35 299 2 276" stroke-width="12"/>
    <path d="m37 162-22-22m50-12 7-39M18 206 1 210m38-79 19-39" stroke-width="6"/>
    <path d="M705 357q-17-99 0-191l11-59m-15 117-37-44m40 6 16-21m-38 34-15-2m33 80 20-26" stroke-width="11"/>
    <path d="m670 186-3-26m37 68 17 5" stroke-width="5"/>
  </g>
  <path d="M0 365q58-32 122-3l36 78H0Zm610 36q50-55 110-31v70H585Z" fill="#253D49"/>
  <g fill="none" stroke="#789285" stroke-width="2" stroke-linecap="round" opacity=".7">
    <path d="M76 387q-9-26-24-33m13 16-16-1m25 12 11-11m-17-8 2-13M654 412q10-30 27-39m-14 20 16-3m-23 14-11-11m23-10-1-13"/>
  </g>
  ${pumpkin(89, 344, 1)}
  ${pumpkin(131, 368, 0.65)}
  ${pumpkin(613, 323, 0.74)}
  <g fill="#D6B2AA" opacity=".7">
    <ellipse cx="207" cy="354" rx="7" ry="2"/><ellipse cx="447" cy="329" rx="9" ry="2.4"/><ellipse cx="379" cy="409" rx="9" ry="2.3"/>
  </g>
  <g fill="#F2CE8C">
    <circle cx="188" cy="287" r="1.7" opacity=".8"/><circle cx="451" cy="256" r="1.9" opacity=".65"/><circle cx="478" cy="366" r="1.4" opacity=".8"/>
    <circle cx="97" cy="308" r="1.3" opacity=".6"/><circle cx="402" cy="300" r="1.3" opacity=".75"/>
  </g>
  <path d="M0 430q88-15 158 1t150 0q84-13 174 2t238-7v14H0Z" fill="#203642"/>
  <g fill="none" stroke="#708A7A" stroke-width="2" stroke-linecap="round">
    <path d="m171 435-3-10m7 9 4-13m272 15-3-10m8 10 6-12m-234 10 2-7m384 8-3-7"/>
  </g>`,
)

// Body coordinates: shoulder centers near (58, 122) and (142, 122).
// Place the arms behind the body and pivot each around (30, 12).
export const zombieBodyArtwork = svg(
  200,
  228,
  `<defs>
    <linearGradient id="zombie-skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#B5D5A0"/><stop offset=".55" stop-color="#93BF91"/><stop offset="1" stop-color="#73A78C"/></linearGradient>
    <linearGradient id="zombie-coat" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#85749D"/><stop offset="1" stop-color="#594E77"/></linearGradient>
    <linearGradient id="zombie-scarf" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E9B371"/><stop offset="1" stop-color="#CF8055"/></linearGradient>
    <linearGradient id="zombie-boots" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#756075"/><stop offset="1" stop-color="#454052"/></linearGradient>
  </defs>
  <ellipse cx="100" cy="221" rx="65" ry="5" fill="#171E34" opacity=".25"/>
  <path d="m61 161 7 46 24 3 8-28 8 29 27-3 7-47Z" fill="#3D4F61" stroke="#30344C" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="m78 178 5 22m40-23-6 23" fill="none" stroke="#65778A" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M63 197c-10 1-17 10-16 18 1 6 16 8 30 7 15 0 22-3 21-10l-7-15Z" fill="url(#zombie-boots)" stroke="#32364D" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M109 197c-4 5-7 12-7 16 0 7 13 10 27 9 15 0 25-3 25-8-1-8-10-15-18-17Z" fill="url(#zombie-boots)" stroke="#32364D" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M51 215q19 6 43 0m12 1q22 5 44-1" fill="none" stroke="#A08A98" stroke-width="2.5" stroke-linecap="round"/>
  <path d="m65 204 13 1m-14 5 14 1m44-7 13-1m-13 6 14-1" stroke="#D1BCB4" stroke-width="2" stroke-linecap="round"/>
  <path d="M63 104c-11 2-18 13-18 26l7 42q21 12 48 10 30 2 49-10l7-42c0-13-8-23-20-26l-19-7H82Z" fill="url(#zombie-coat)" stroke="#3C3C59" stroke-width="3.8" stroke-linejoin="round"/>
  <path d="m85 104 15 18 17-18 6 65q-23 8-45 0Z" fill="#B1B69B"/>
  <path d="m82 111 18 17 19-17m-19 18v43" fill="none" stroke="#607A78" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="m67 115 9 21-9 10 16 29m49-60-9 21 9 10-15 29" fill="none" stroke="#B2A0BA" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
  <circle cx="101" cy="145" r="2.5" fill="#F0D5A5"/><circle cx="101" cy="161" r="2.5" fill="#F0D5A5"/>
  <path d="m120 148 16-2 1 17-16 2Z" fill="#514960" stroke="#C3A5AE" stroke-width="1.7" stroke-linejoin="round"/>
  <path d="m125 151 6 7m0-8-5 9" stroke="#DAC1B8" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M61 154h16v15H61Z" fill="#465B67" stroke="#B7B0A6" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M65 158h7m-7 4h7" stroke="#8AD8BD" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M79 94q20 7 42-1l3 12q-26 18-48 0Z" fill="url(#zombie-scarf)" stroke="#8D635E" stroke-width="2.4"/>
  <path d="m110 103 12 5-6 35-15-4Z" fill="url(#zombie-scarf)" stroke="#8D635E" stroke-width="2" stroke-linejoin="round"/>
  <path d="m108 123 10 3m-13 8 11 3m-9 3-1 6m5-5-1 6m5-4-1 5" stroke="#F4CC91" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M48 53c-9-3-15 4-14 13 0 10 7 15 15 11m102-25c9-4 16 3 16 12 0 11-8 16-16 12" fill="#89B48D" stroke="#3F6F6C" stroke-width="3"/>
  <path d="M43 61q-6-2-5 7m120-8q6-2 5 7" fill="none" stroke="#B3CD9E" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M48 39q3-20 30-20h44q29 1 31 24l-1 35q-2 27-29 30l-39-1q-33-1-36-28Z" fill="url(#zombie-skin)" stroke="#3F6F6C" stroke-width="3.7" stroke-linejoin="round"/>
  <path d="M53 42q3-15 23-16h45q18 0 23 12" fill="none" stroke="#C8DEAD" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M47 49c-3-20 13-34 32-31l3-10 14 9 10-9 8 12c18-4 36 8 37 25l-10-9-7 8-8-10-10 7-9-10-10 7-12-7-9 12-10-6-9 13Z" fill="#3B495D" stroke="#30394F" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="m70 27 8 3m17-9 7 6m20-1 7 4" stroke="#637488" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M43 56c-2-27 12-43 34-46q30-7 57 3 25 9 24 40" fill="none" stroke="#31364F" stroke-width="9" stroke-linecap="round"/>
  <path d="M44 43q3-24 26-29 31-9 57 0" fill="none" stroke="#8E82A2" stroke-width="2.8" stroke-linecap="round"/>
  <rect x="33" y="51" width="16" height="30" rx="7" fill="#E0AC70" stroke="#4E4660" stroke-width="3"/>
  <rect x="151" y="50" width="16" height="31" rx="7" fill="#E0AC70" stroke="#4E4660" stroke-width="3"/>
  <rect x="37" y="56" width="7" height="20" rx="3.5" fill="#806F87"/><rect x="156" y="55" width="7" height="21" rx="3.5" fill="#806F87"/>
  <path d="m49 75 3 8m98-8-2 8" stroke="#456E70" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="77" cy="62" rx="10" ry="11.5" fill="#FAF3DA"/>
  <ellipse cx="123" cy="62" rx="10" ry="11.5" fill="#FAF3DA"/>
  <ellipse cx="79" cy="63" rx="4.4" ry="6.4" fill="#354B50"/><ellipse cx="121" cy="63" rx="4.4" ry="6.4" fill="#354B50"/>
  <circle cx="80" cy="60.8" r="1.7" fill="#FFFFFF"/><circle cx="122" cy="60.8" r="1.7" fill="#FFFFFF"/>
  <path d="M66 49q10-5 20-1m27 0q9-4 18 2" fill="none" stroke="#537A6E" stroke-width="3.3" stroke-linecap="round"/>
  <path d="m98 66-4 10q4 3 9 0" fill="#7EAC88" stroke="#537F73" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="65" cy="81" rx="8" ry="4" fill="#D9AE89" opacity=".6"/><ellipse cx="137" cy="81" rx="8" ry="4" fill="#D9AE89" opacity=".6"/>
  <path d="M79 86q20 18 42-1-4 18-21 18-15 0-21-17Z" fill="#465663" stroke="#47756D" stroke-width="2.3" stroke-linejoin="round"/>
  <path d="m87 91 9 3-1 8-7-3Zm19 3 8-3-1 8-7 3Z" fill="#FFF3D5"/>
  <path d="M95 100q6-3 12 0" stroke="#BFA59D" stroke-width="2" stroke-linecap="round"/>
  <path d="m57 91 9 3m-6-7-2 10m6-8-2 9" fill="none" stroke="#649286" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="136" cy="42" r="2" fill="#CAE0AD" opacity=".8"/>
  <path d="M162 77q4 20-18 21" fill="none" stroke="#4C4660" stroke-width="3" stroke-linecap="round"/>
  <rect x="132" y="93" width="14" height="7" rx="3.5" fill="#665C76" stroke="#3F3E55" stroke-width="1.7"/>`,
)

function zombieArm(id: string, mirror: boolean): string {
  return svg(
    60,
    112,
    `<defs>
      <linearGradient id="${id}-skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ACCF9C"/><stop offset="1" stop-color="#7DAC8D"/></linearGradient>
      <linearGradient id="${id}-sleeve" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8D7AA2"/><stop offset="1" stop-color="#65577E"/></linearGradient>
    </defs>
    <g${mirror ? ' transform="translate(60 0) scale(-1 1)"' : ''}>
      <path d="M25 8c-11 1-17 13-15 25l5 26 27-5 3-29C46 14 36 6 25 8Z" fill="url(#${id}-sleeve)" stroke="#42445E" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="m18 22 4 23m15-26-3 22" stroke="#B1A0BA" stroke-width="2" stroke-linecap="round" opacity=".75"/>
      <path d="m15 49 29-4 1 12-29 5Z" fill="#A28DAD" stroke="#4D4C67" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M18 61c2 8 6 14 7 21l-4 10c-2 7 1 12 5 12 3 0 4-2 5-6l1 7c1 5 6 5 8 1l1-7 1 4c2 5 7 3 7-2l-1-13-4-15-4-15Z" fill="url(#${id}-skin)" stroke="#466F6C" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M27 82c-7-8-12-5-10 0l6 11" fill="url(#${id}-skin)" stroke="#466F6C" stroke-width="2.5" stroke-linecap="round"/>
      <path d="m31 89 1 8m7-9 2 9m-14-27 4 4m-7-1 4-4" fill="none" stroke="#6E9B7F" stroke-width="1.7" stroke-linecap="round"/>
      <path d="m21 51 15-2" stroke="#CEBAC7" stroke-width="1.8" stroke-linecap="round"/>
    </g>`,
  )
}

export const zombieLeftArmArtwork = zombieArm('zombie-left-arm', false)
export const zombieRightArmArtwork = zombieArm('zombie-right-arm', true)

export const lanternArtwork = svg(
  64,
  88,
  `<defs>
    <radialGradient id="zombie-lantern-glow"><stop stop-color="#FFD58C" stop-opacity=".6"/><stop offset="1" stop-color="#FFD58C" stop-opacity="0"/></radialGradient>
    <linearGradient id="zombie-lantern-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFE5A7"/><stop offset="1" stop-color="#EBA969"/></linearGradient>
  </defs>
  <ellipse cx="32" cy="53" rx="32" ry="35" fill="url(#zombie-lantern-glow)"/>
  <ellipse cx="32" cy="82" rx="19" ry="3" fill="#19253B" opacity=".2"/>
  <path d="M24 22V13a8 8 0 0 1 16 0v9" fill="none" stroke="#A894A7" stroke-width="4"/>
  <path d="m20 29-4 42 7 8h19l7-8-4-42Z" fill="url(#zombie-lantern-glass)" stroke="#554760" stroke-width="3" stroke-linejoin="round"/>
  <path d="M24 32 21 70m20-38 3 38" stroke="#FFF1C5" stroke-width="2" opacity=".8"/>
  <path d="M32 43c-1 8-10 12-7 20 2 6 13 7 16 0 4-8-5-13-9-20Z" fill="#FFF3C6"/>
  <path d="M32 57c-1 4-4 6-3 9 1 3 6 3 7 0 2-4-2-6-4-9Z" fill="#F8B66A"/>
  <path d="M31 31v43m-12-2h27" fill="none" stroke="#8C6C78" stroke-width="3"/>
  <path d="M15 29 24 20h16l10 9Z" fill="#897087" stroke="#554760" stroke-width="3" stroke-linejoin="round"/>
  <path d="M17 77h29l3 5H14Z" fill="#6B5C76" stroke="#4C435C" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="m24 24 15 1" stroke="#C4A9B4" stroke-width="1.8" stroke-linecap="round"/>`,
)

export const sparkleArtwork = svg(
  48,
  48,
  `<path d="M24 4c2 12 6 16 20 20-14 3-18 7-20 20C21 31 17 27 4 24c13-4 17-8 20-20Z" fill="#D6ECD0"/>
  <path d="M24 12c1 7 4 10 12 12-8 2-11 5-12 12-2-7-5-10-12-12 7-2 10-5 12-12Z" fill="#FFF2C5"/>
  <path d="m39 1 1.6 5.4L46 8l-5.4 1.6L39 15l-1.6-5.4L32 8l5.4-1.6Z" fill="#F5C17C"/>
  <circle cx="8" cy="39" r="2.3" fill="#F5C17C"/>
  <circle cx="42" cy="37" r="1.5" fill="#B6D6BE"/>`,
)

export const tombstoneArtwork = svg(
  110,
  140,
  `<defs>
    <linearGradient id="zombie-stone" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#AA9EB8"/><stop offset="1" stop-color="#777D97"/></linearGradient>
    <linearGradient id="zombie-stone-inset" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#958DA8"/><stop offset="1" stop-color="#8188A0"/></linearGradient>
  </defs>
  <ellipse cx="55" cy="131" rx="48" ry="6" fill="#1F2A41" opacity=".25"/>
  <path d="M17 125V47C17-8 94-8 94 47v78Z" fill="url(#zombie-stone)" stroke="#4C506C" stroke-width="4" stroke-linejoin="round"/>
  <path d="M25 120V47c0-41 61-41 61 0v73Z" fill="url(#zombie-stone-inset)" stroke="#C5B6C7" stroke-width="2"/>
  <path d="M18 41q5-30 35-32" fill="none" stroke="#D3C4D0" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M43 36a15 15 0 1 0 23-18 12 12 0 0 1-23 18Z" fill="#DCD3D1" stroke="#79768E" stroke-width="1.5"/>
  <path d="m72 43 1.2 3.8 3.8 1.2-3.8 1.2-1.2 3.8-1.2-3.8-3.8-1.2 3.8-1.2Z" fill="#DCD3D1"/>
  <path d="M39 61h33M45 68h22" stroke="#656A86" stroke-width="3" stroke-linecap="round"/>
  <path d="m77 104-3 7 6 3-4 8" fill="none" stroke="#656A86" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 124h88l3 9H8Z" fill="#6C768E" stroke="#4C506C" stroke-width="3" stroke-linejoin="round"/>
  <g fill="none" stroke="#7FA38D" stroke-width="2.5" stroke-linecap="round">
    <path d="m21 130-6-14m7 9 3-13m64 17 6-14m-6 10-2-14"/>
  </g>
  <path d="M15 121q14-6 22 3m48 0 10-3" fill="none" stroke="#90A38F" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
)

export const bonusHatArtwork = svg(
  100,
  76,
  `<defs><linearGradient id="zombie-bonus-hat" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E5B575"/><stop offset="1" stop-color="#C88663"/></linearGradient></defs>
  <path d="M31 49Q37 20 49 5q9 19 22 45Z" fill="url(#zombie-bonus-hat)" stroke="#7A5765" stroke-width="3" stroke-linejoin="round"/>
  <path d="m35 42 32 1 4 10-38-1Z" fill="#7D6B93" stroke="#695C7D" stroke-width="1.5"/>
  <path d="M29 49Q12 51 8 60c21 11 63 12 85 0-6-9-20-10-25-10Z" fill="#DCA76F" stroke="#7A5765" stroke-width="3" stroke-linejoin="round"/>
  <path d="M17 59q30 9 65 0" fill="none" stroke="#F6D4A0" stroke-width="2.5" stroke-linecap="round"/>
  <path d="m52 20 2.3 6.8 7.2.1-5.8 4.3 2.2 6.8-5.9-4.2-5.8 4.2 2.2-6.8-5.8-4.3 7.2-.1Z" fill="#FFF0B7" stroke="#A67864" stroke-width="1"/>
  <path d="m80 7 1.7 5.3 5.3 1.7-5.3 1.7-1.7 5.3-1.7-5.3-5.3-1.7 5.3-1.7Z" fill="#D8E8C7"/>
  <circle cx="19" cy="29" r="2.5" fill="#D8E8C7"/>`,
)

export const pumpkinArtwork = svg(64, 60, pumpkin(6, 8, 1))
