/*
  Wanted: a pass that transforms a dragged-edited-dropped to dragged-dropped-dragged-dropped
*/

import * as R from 'ramda'
import * as Utils from './Utils'
import {TokenDiff} from './Utils'
import {Token} from './Token'
import * as T from './Token'
import {KV} from './Utils'

export interface Dropped {
  edit: 'Dropped'
  target: Token
  /** The edge id */
  id: string
}

export function Dropped(target: Token, id: string): Dropped {
  return {edit: 'Dropped', target, id}
}

export interface Dragged {
  edit: 'Dragged'
  source: Token
  /** The edge id */
  id: string
}

export function Dragged(source: Token, id: string): Dragged {
  return {edit: 'Dragged', source, id}
}

export interface Edited {
  edit: 'Edited'
  source: Token[]
  target: Token[]
  /** The edge id */
  id: string
}

export function Edited(source: Token[], target: Token[], id: string): Edited {
  return {edit: 'Edited', source, target, id}
}

export type Diff = Dropped | Dragged | Edited

export function partition(diff: (Dropped | Dragged)[]) {
  const dropped = [] as Dropped[]
  const dragged = [] as Dragged[]
  diff.forEach(d => {
    if (d.edit == 'Dragged') {
      dragged.push(d)
    } else {
      dropped.push(d)
    }
  })
  return {dropped, dragged}
}

// should these take an edge id instead ?
export function next(diff: Diff[], i: number): number | null {
  if (i >= diff.length) {
    return null
  }
  const visit = Utils.unique_check<string>()
  for (let j = 0; j <= i; j++) {
    visit(diff[j].id)
  }
  for (; i < diff.length; i++) {
    if (visit(diff[i].id)) {
      return i
    }
  }
  return null
}

export function prev(diff: Diff[], i: number): number | null {
  if (i <= 0) {
    return null
  }
  const visit = Utils.unique_check<string>()
  for (let j = diff.length - 1; j >= i; j--) {
    visit(diff[j].id)
  }
  for (; i >= 0; i--) {
    if (visit(diff[i].id)) {
      return i
    }
  }
  return null
}

export type Dir = 'Up' | 'Left' | 'Down' | 'Right'

export const up: Dir = 'Up'
export const left: Dir = 'Left'
export const down: Dir = 'Down'
export const right: Dir = 'Right'

export const opposite: Record<Dir, Dir> = {
  Up: down,
  Down: up,
  Left: right,
  Right: left,
}

export const vflip: Record<Dir, Dir> = {
  Up: down,
  Down: up,
  Left: left,
  Right: right,
}

export interface ProtoLine {
  from: number
  to: number
  id: string
}

export interface Box {
  enter: Dir
  exit: Dir
  id: string
}

const ascii = KV<Dir[], string>(dirs => dirs.sort().join('-'))
ascii.batch([
  {value: '╵', key: [up]},
  {value: '╴', key: [left]},
  {value: '╷', key: [down]},
  {value: '╶', key: [right]},

  {value: '│', key: [up, down]},
  {value: '─', key: [left, right]},

  {value: '┘', key: [up, left]},
  {value: '┐', key: [left, down]},
  {value: '┌', key: [down, right]},
  {value: '└', key: [right, up]},

  {value: '┬', key: [left, right, down]},
  {value: '├', key: [up, down, right]},
  {value: '┴', key: [left, right, up]},
  {value: '┤', key: [up, down, left]},

  {value: '┼', key: [left, right, up, down]},
  {value: ' ', key: []},
])

export type IndexedDiff = Diff & {index: number}
export function Index(ds: Diff[]): IndexedDiff[] {
  return ds.map((d, index) => ({...d, index}))
}

export function DiffToGrid(diff: Diff[]): {upper: Grid; lower: Grid} {
  return {
    upper: Grid(Line(ProtoLines(diff, 'Dragged'), diff.length).boxes),
    lower: VFlip(Grid(Line(ProtoLines(diff, 'Dropped'), diff.length).boxes)),
  }
}

export function ProtoLines(diff: Diff[], keep: 'Dragged' | 'Dropped'): ProtoLine[][] {
  return R.sortBy(
    (pl: ProtoLine[]) => pl.length,
    Utils.record_traverse(
      R.groupBy(d => d.id, Index(diff)) as Record<string, IndexedDiff[]>,
      (ds, id) => {
        // try to move to a source position close to the center of mass of all involved positions
        const center_of_mass = Utils.sum(ds.map(d => d.index)) / ds.length
        const dragged = ds.filter(d => d.edit != 'Dropped')
        const to = Utils.minimumBy(
          (d: IndexedDiff) => Math.abs(center_of_mass - d.index),
          dragged.length > 0 ? dragged : ds
        ).index
        return ds
          .filter(d => d.edit == 'Edited' || d.edit == keep)
          .map(d => ({from: d.index, to, id}))
      }
    )
  )
}

export type Pos = [number, number]
export function Pos(x: number, y: number): Pos {
  return [x, y]
}

export type Grid = Box[][][]

export function Grid(m: KV<Pos, Box[]>): Grid {
  const poses: Pos[] = []
  m.forEach((_, pos) => poses.push(pos))
  const ym = Utils.maximum(poses.map(pos => pos[1]))
  const xm = Utils.maximum(poses.map(pos => pos[0]))
  return R.range(0, ym + 1).map(y => R.range(0, xm + 1).map(x => m.get(Pos(x, y)) || []))
}

export function VFlip(grid: Grid): Grid {
  return grid
    .reverse()
    .map(row =>
      row.map(boxes =>
        boxes.map(box => ({enter: vflip[box.enter], exit: vflip[box.exit], id: box.id}))
      )
    )
}

export function Asciibox(grid: Grid): string {
  return grid
    .map(row =>
      row
        .map(boxes => ascii.get(Utils.uniq(Utils.flatMap(boxes, b => [b.enter, b.exit]))) || ' ')
        .join('')
    )
    .join('\n')
}

export function Line(lines: ProtoLine[][], width: number): {boxes: KV<Pos, Box[]>; height: number} {
  const heights: number[] = new Array(width).fill(0)
  const postponed: ((final_height: number) => void)[] = []
  const canvas = Canvas()
  lines.forEach(pls => {
    const poses = Utils.flatMap(pls, pl => [pl.from, pl.to])
    const lo = Utils.minimum(poses)
    const hi = Utils.maximum(poses)
    const range = R.range(lo, hi + 1)
    const vertical = pls.length == 1 && pls[0].from == pls[0].to
    const h = Utils.maximum(range.map(i => heights[i])) + (vertical ? 0 : 1)
    range.map(i => (heights[i] = h))
    postponed.push(final_height =>
      pls.map(pl =>
        canvas
          .at(pl.id, pl.from, 0)
          .y(h)
          .x(pl.to)
          .y(final_height)
          .end()
      )
    )
  })
  const height = Utils.maximum(heights) + 1
  postponed.map(k => k(height))
  return {boxes: canvas.boxes, height}
}

export type CanvasAPI = {
  x(x1: number): CanvasAPI
  y(y1: number): CanvasAPI
  end(): void
}

export function Canvas() {
  const boxes = KV<Pos, Box[]>()
  const paint = (p: Pos, b: Box) => {
    let ref = boxes.get(p) || []
    boxes.set(p, ref)
    ref.push(b)
  }
  function at(id: string, x: number, y: number) {
    const state = {x, y, pending: null as null | Dir}
    const move = (dx: number, dy: number) => {
      const dir = ((): Dir => {
        if (dx == 0 && dy == 0) {
          if (state.pending == null) {
            throw 'Cannot exit without having drawn anything'
          } else {
            return state.pending
          }
        } else if (dx != 0 && dy != 0) {
          throw 'Both dx and dy changed'
        } else if (dx == -1) {
          return left
        } else if (dx == 1) {
          return right
        } else if (dy == -1) {
          return up
        } else {
          return down
        }
      })()
      const prev = opposite[state.pending || dir]
      paint(Pos(state.x, state.y), {enter: prev, exit: dir, id})
      state.x += dx
      state.y += dy
      state.pending = dir
    }
    const api: CanvasAPI = {
      x(x1) {
        while (state.x != x1) {
          move(state.x > x1 ? -1 : 1, 0)
        }
        return api
      },
      y(y1) {
        while (state.y != y1) {
          move(0, state.y > y1 ? -1 : 1)
        }
        return api
      },
      end() {
        move(0, 0)
      },
    }
    return api
  }
  return {at, boxes}
}
