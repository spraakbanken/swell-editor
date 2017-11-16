/*
  Wanted: a pass that transforms a dragged-edited-dropped to dragged-dropped-dragged-dropped
*/


import * as Utils from "./Utils"
import { TokenDiff } from "./Utils"
import { Token } from './Token'

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

export function next(diff: Diff[], i: number): number {
  if (i >= diff.length) {
    return 0
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
  return 0
}

export function prev(diff: Diff[], i: number): number {
  if (i <= 0) {
    return diff.length - 1
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
  return diff.length - 1
}

