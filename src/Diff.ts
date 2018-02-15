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

export interface ProtoLine {
  from: number
  to: number
}

export type IndexedDiff = Diff & {index: number}
export function Index(ds: Diff[]): IndexedDiff[] {
  return ds.map((d, index) => ({...d, index}))
}

export type Grid = Line[][]

export function DiffToGrid(diff: Diff[]): {upper: Grid; lower: Grid} {
  return {
    upper: Grid(ProtoLines(diff, 'Dragged'), diff.length),
    lower: VFlip(Grid(ProtoLines(diff, 'Dropped'), diff.length)),
  }
}

export type ProtoLines = {id: string; center_of_mass: number; lines: ProtoLine[]}[]

export function ProtoLines(diff: Diff[], keep: 'Dragged' | 'Dropped'): ProtoLines {
  return R.sortBy(
    r => r.lines.length,
    Utils.record_traverse(
      R.groupBy(d => d.id, Index(diff)) as Record<string, IndexedDiff[]>,
      (ds, id) => {
        // try to move to a source position close to the center of mass of all involved positions
        const proto_center_of_mass = Utils.sum(ds.map(d => d.index)) / ds.length
        // snap-to-grid center of mass calculated only from source positions
        // actually, let's skip that for now:
        const dragged = ds // .filter(d => d.edit != 'Dropped')
        // if there are any
        const morally_dragged = dragged.length > 0 ? dragged : ds
        const center_of_mass = Utils.minimumBy(
          (d: IndexedDiff) => Math.abs(proto_center_of_mass - d.index),
          morally_dragged
        ).index
        const lines = ds
          .filter(d => {
            if (d.edit == 'Edited') {
              return (
                (keep == 'Dragged' && d.source.length > 0) ||
                (keep == 'Dropped' && d.target.length > 0)
              )
            } else {
              return d.edit == keep
            }
          })
          .map(d => ({from: d.index, to: center_of_mass}))
        return {id, center_of_mass, lines}
      }
    )
  )
}

export interface Line {
  x0: number
  x1: number
  y0: number
  y1: number
  id: string
}

export function Grid(proto_lines: ProtoLines, width: number): Grid {
  const heights: number[] = new Array(width).fill(0)
  const out_lines: Line[][] = heights.map(_ => [] as Line[])
  const postponed: ((final_height: number) => void)[] = []
  proto_lines.forEach(({id, lines}) => {
    if (lines.length == 0) {
      return
    }
    const poses = Utils.flatMap(lines, pl => [pl.from, pl.to])
    const lo = Utils.minimum(poses)
    const hi = Utils.maximum(poses)
    const range = R.range(lo, hi + 1)
    const vertical = lines.length == 1 && lines[0].from == lines[0].to
    const h = Utils.maximum(range.map(i => heights[i])) + (vertical ? 0 : 1)
    range.map(i => (heights[i] = h))
    postponed.push(final_height =>
      lines.map(line => {
        if (line.from == line.to) {
          out_lines[line.from].push({
            x0: 0.5,
            y0: 0,
            x1: 0.5,
            y1: 1,
            id,
          })
        } else {
          const dir = line.to > line.from ? 'right' : 'left'
          const x0 = dir == 'left' ? 1 : 0
          const x1 = dir == 'left' ? 0 : 1
          const y = h / final_height
          out_lines[line.from].push({
            x0: 0.5,
            y0: 0,
            x1,
            y1: y,
            id,
          })
          const dx = dir == 'left' ? -1 : 1
          let x = line.from + dx
          while (x != line.to) {
            out_lines[x].push({
              x0,
              y0: y,
              x1,
              y1: y,
              id,
            })
            x += dx
          }
          out_lines[line.to].push({
            x0,
            y0: y,
            x1: 0.5,
            y1: 1,
            id,
          })
        }
      })
    )
  })
  const height = Utils.maximum(heights) + 1
  postponed.map(k => k(height))
  return out_lines
}

export function VFlip(grid: Line[][]): Line[][] {
  return grid.map(column =>
    column.map(line => ({
      ...line,
      y0: 1 - line.y0,
      y1: 1 - line.y1,
    }))
  )
}
