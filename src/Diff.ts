/*
  Wanted: a pass that transforms a dragged-edited-dropped to dragged-dropped-dragged-dropped
*/

import * as R from 'ramda'
import * as Utils from './Utils'
import {TokenDiff} from './Utils'
import {Token} from './Token'
import * as T from './Token'
import {KV} from './Utils'
import * as record from './record'

const dnd = Utils.ADT('edit')
  .alt('Dropped')<{target: Token; id: string; manual: boolean}>()
  .alt('Dragged')<{source: Token; id: string; manual: boolean}>()
const diff = dnd.alt('Edited')<{source: Token[]; target: Token[]; id: string; manual: boolean}>()

export type Dropped = typeof diff.Cons.Dropped

export const Dropped = (target: Token, id: string, manual: boolean) =>
  diff.cons.Dropped({target, id, manual})

export type Dragged = typeof diff.Cons.Dragged

export const Dragged = (source: Token, id: string, manual: boolean): Dragged =>
  diff.cons.Dragged({source, id, manual})

export type Edited = typeof diff.Cons.Edited

export const Edited = (source: Token[], target: Token[], id: string, manual: boolean): Edited =>
  diff.cons.Edited({source, target, id, manual})

export type Diff = typeof diff.Ty

export const {cons, match} = diff

export const dnd_match = dnd.match

export const source = match({
  Edited: d => T.text(d.source),
  Dragged: d => d.source.text,
  Dropped: d => '',
})

export const target = match({
  Edited: d => T.text(d.target),
  Dragged: d => '',
  Dropped: d => d.target.text,
})

export function partition(diff: (Dropped | Dragged)[]) {
  const dropped = [] as Dropped[]
  const dragged = [] as Dragged[]
  diff.forEach(
    dnd_match({
      Dragged: d => dragged.push(d),
      Dropped: d => dropped.push(d),
    })
  )
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
    record.traverse(
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
