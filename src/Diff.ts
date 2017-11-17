/*
  Wanted: a pass that transforms a dragged-edited-dropped to dragged-dropped-dragged-dropped
*/


import * as Utils from "./Utils"
import { TokenDiff } from "./Utils"
import { Token } from './Token'
import * as T from './Token'

export interface Dropped {
  edit: 'Dropped',
  target: Token,
  id: string,
}

export function Dropped(target: Token, id: string): Dropped {
  return {edit: 'Dropped', target, id}
}

export interface Dragged {
  edit: 'Dragged',
  source: Token,
  id: string,
}

export function Dragged(source: Token, id: string): Dragged {
  return {edit: 'Dragged', source, id}
}

export interface Edited {
  edit: 'Edited',
  source: Token[],
  target: Token[],
  id: string,
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

