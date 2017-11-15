import * as Utils from "./Utils"
import { Token } from './Token'

export interface Dropped {
  edit: 'Dropped',
  target: Token,
  id: string,
  labels: string[]
}

export function Dropped(target: Token, id: string, labels: string[]): Dropped {
  return {edit: 'Dropped', target, id, labels}
}

export interface Dragged {
  edit: 'Dragged',
  source: Token,
  id: string,
  labels: string[]
}

export function Dragged(source: Token, id: string, labels: string[]): Dragged {
  return {edit: 'Dragged', source, id, labels}
}

export interface Edited {
  edit: 'Edited',
  source: Token[],
  target: Token[],
  id: string,
  labels: string[]
}

export function Edited(source: Token[], target: Token[], id: string, labels: string[]): Edited {
  return {edit: 'Edited', source, target, id, labels}
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

