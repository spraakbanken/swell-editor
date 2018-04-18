import * as R from 'ramda'
import {Token} from './Token'
import * as T from './Token'

import * as Utils from '../Utils'
import {TokenDiff} from '../Utils'
import * as record from '../record'

export interface Dropped {
  edit: 'Dropped'
  target: Token
  id: string
  manual: boolean
}

export const Dropped = (target: Token, id: string, manual: boolean): Dropped => ({
  edit: 'Dropped',
  target,
  id,
  manual,
})

export interface Dragged {
  edit: 'Dragged'
  source: Token
  id: string
  manual: boolean
}

export const Dragged = (source: Token, id: string, manual: boolean): Dragged => ({
  edit: 'Dragged',
  source,
  id,
  manual,
})

export interface Edited {
  edit: 'Edited'
  source: Token[]
  target: Token[]
  id: string
  manual: boolean
}

export const Edited = (source: Token[], target: Token[], id: string, manual: boolean): Edited => ({
  edit: 'Edited',
  source,
  target,
  id,
  manual,
})

export type Diff = Dropped | Dragged | Edited

export interface DiffCases {
  Dropped: Dropped
  Dragged: Dragged
  Edited: Edited
}

export interface DndCases {
  Dropped: Dropped
  Dragged: Dragged
}

export function match<R>(
  cases:
    | {[K in keyof DiffCases]: (a: DiffCases[K]) => R}
    | {[K in keyof DiffCases]?: (a: DiffCases[K]) => R} & {default: (d: Diff) => R}
): (d: Diff) => R {
  return d => ((cases as any)[d.edit] || (cases as any).default)(d)
}

export function dnd_match<R>(
  cases:
    | {[K in keyof DndCases]: (a: DndCases[K]) => R}
    | {[K in keyof DndCases]?: (a: DndCases[K]) => R} & {default: (d: Diff) => R}
): (d: Diff) => R {
  return d => ((cases as any)[d.edit] || (cases as any).default)(d)
}

export const tokens = match({
  Edited: d => [...d.source, ...d.target],
  Dragged: d => [d.source],
  Dropped: d => [d.target],
})

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

export type IndexedDiff = Diff & {index: number}
export function Index(ds: Diff[]): IndexedDiff[] {
  return ds.map((d, index) => ({...d, index}))
}