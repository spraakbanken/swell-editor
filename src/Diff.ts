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

export type RichDiff
  = { edit: 'Edited', source: Token[], target: Token[], id: string, target_diffs: TokenDiff[], source_diffs: TokenDiff[] }
  | { edit: 'Dragged', source: Token, id: string, source_diff: TokenDiff }
  | { edit: 'Dropped', target: Token, id: string, target_diff: TokenDiff }

/*
export function enrichen(diff: Diff[]): RichDiff[] {
  diff.map((d: Diff) => {
    switch (d.edit) {
      case 'Edited':
        return {
          ...d,
          source_diffs: Utils.multi_token_diff(Utilsd.source, d.target.join('')),
          target_diffs: Utils.multi_token_diff(Utilsd.target, d.source.join('')).map(Utils.invert_token_diff)
        }

      case 'Dragged': {
        const ji = join_id[d.id]
        return {
          ...d,
          source_diff: source_diffs[ji][join_ids[ji].indexOf(d.id)],
          join_id: join_id[d.id],
          rev_ids: join_target[ji].map((_, i) => ji + '_' + i)
        }
      }

      case 'Dropped': {
        const ji = Utils.pipesep(d.ids)
        return {
          ...d,
          target_diff: target_diffs[ji].shift() || [[0, "?"]],
          join_id: ji,
          rev_id: ji + '_' + join_seen[ji]++
        }
      }
    }
  })
  return []
}
*/
