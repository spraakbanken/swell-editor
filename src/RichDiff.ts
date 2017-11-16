import { Diff, Dragged, Dropped } from './Diff'
import * as D from './Diff'
import { Graph } from "./Graph"
import * as G from "./Graph"
import { Token, Span } from './Token'
import * as T from './Token'
import { TokenDiff } from "./Utils"
import * as Utils from "./Utils"

export type RichDiff
  = { edit: 'Edited', source: Token[], target: Token[], id: string, target_diffs: TokenDiff[], source_diffs: TokenDiff[] }
  | { edit: 'Dragged', source: Token, id: string, source_diff: TokenDiff }
  | { edit: 'Dropped', target: Token, id: string, target_diff: TokenDiff }

/** Enrichen a diff with detailed intra-token diffs

  const g = G.init('aporna bepa cepa depa')
  const gr = G.rearrange(g, 1, 2, 0)
  G.target_text(gr) // => 'bepa cepa aporna depa'
  const gm = G.modify(gr, 10, 10, 'h')
  G.target_text(gm) // => 'bepa cepa haporna depa'
  const rd = enrichen(gm, G.calculate_diff(gm))
  rd[0] // => {edit: 'Dragged', source: {text: 'aporna ', id: 's0'}, id: 'e-t4-s0', source_diff: [[1, 'h'], [0, 'aporna ']]}

*/
export function enrichen(g: Graph, diff: Diff[]): RichDiff[] {
  const partition = G.partition_ids(g)
  return diff.map((d: Diff) => {
    switch (d.edit) {
      case 'Edited':
        return {
          ...d,
          source_diffs: Utils.multi_token_diff(T.texts(d.source), T.text(d.target)),
          target_diffs: Utils.multi_token_diff(T.texts(d.target), T.text(d.source)).map(Utils.invert_token_diff)
        }

      case 'Dragged': {
        const {source, target} = partition(g.edges[d.id])
        const source_diff = Utils.multi_token_diff(T.texts(source), T.text(target))
        const i = source.findIndex(s => s.id == d.source.id)
        return {
          ...d,
          source_diff: source_diff[i],
        }
      }

      case 'Dropped': {
        const {source, target} = partition(g.edges[d.id])
        const target_diff = Utils.multi_token_diff(T.texts(target), T.text(source)).map(Utils.invert_token_diff)
        const i = target.findIndex(t => t.id == d.target.id)
        return {
          ...d,
          target_diff: target_diff[i],
        }
      }
    }
  })
}
