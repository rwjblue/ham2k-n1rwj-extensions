import type { SvgSceneControl, SvgSceneLayer } from '@ham2k/extension-sdk'

type FixedSceneRect = Pick<SvgSceneLayer, 'x' | 'y' | 'width' | 'height'>

/** Reception uses drawn controls with explicit rectangles, not native layout nodes. */
export function assertFixedSceneRect<T extends SvgSceneControl | SvgSceneLayer>(
  item: T,
): asserts item is T & FixedSceneRect {
  if (
    typeof item.x !== 'number' ||
    typeof item.y !== 'number' ||
    typeof item.width !== 'number' ||
    typeof item.height !== 'number' ||
    !Number.isFinite(item.x) ||
    !Number.isFinite(item.y) ||
    !Number.isFinite(item.width) ||
    !Number.isFinite(item.height)
  ) {
    throw new Error(`Scene item ${item.id} must have a finite, fixed rectangle`)
  }
}
