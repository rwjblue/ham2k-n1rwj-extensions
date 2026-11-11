// Local types for the exports selected by the vendoring task.
export type NodeProgram = 'AR-Cluster' | 'DXSpider' | 'CC Cluster'

/** Captures the raw spotter, frequency, DX call, comment, UTC minute, and optional tail. */
export const clusterAnnouncementPattern: RegExp
export const clusterFeedCommands: Readonly<Record<NodeProgram, readonly string[]>>
export function isPromptFor(text: string, call: string): boolean
export function nodeProgramFromPrompt(prompt: string): NodeProgram | undefined
export function spotTime(hhmm: string, arrivedAt: number): number
