import {Diff, Edited, Dragged, Dropped} from './Diff'
import * as D from './Diff'
import {Graph} from './Graph'
import * as G from './Graph'
import {Token, Span} from './Token'
import * as T from './Token'
import {TokenDiff} from '../Utils'
import * as Utils from '../Utils'

export type RichDiff =
  | Edited & {index: number} & {target_diffs: TokenDiff[]; source_diffs: TokenDiff[]}
  | Dragged & {index: number} & {source_diff: TokenDiff}
  | Dropped & {index: number} & {target_diff: TokenDiff}

/** Enrichen a diff with detailed intra-token diffs

  const g = G.init('aporna bepa cepa depa', true)
  const gr = G.rearrange(g, 1, 2, 0)
  G.target_text(gr) // => 'bepa cepa aporna depa '
  const gm = G.modify(gr, 10, 10, 'h')
  G.target_text(gm) // => 'bepa cepa haporna depa '
  const rd = enrichen(gm)
  const expected_rd0 = {
    edit: 'Dragged',
    source: {text: 'aporna ', id: 's0'},
    id: 'e-s0-t4',
    source_diff: [[1, 'h'], [0, 'aporna ']],
    index: 0,
    manual: true
  }
  rd[0] // => expected_rd0

*/
export function enrichen(
  g: Graph,
  order_changing_label: (s: string) => boolean = () => false
): RichDiff[] {
  const diff = G.calculate_diff(g, order_changing_label)
  const partition = G.partition_ids(g)
  return D.Index(diff).map((d: D.IndexedDiff) => {
    switch (d.edit) {
      case 'Edited':
        return {
          ...d,
          source_diffs: Utils.multi_token_diff(T.texts(d.source), T.text(d.target)),
          target_diffs: Utils.multi_token_diff(T.texts(d.target), T.text(d.source)).map(
            Utils.invert_token_diff
          ),
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
        const target_diff = Utils.multi_token_diff(T.texts(target), T.text(source)).map(
          Utils.invert_token_diff
        )
        const i = target.findIndex(t => t.id == d.target.id)
        return {
          ...d,
          target_diff: target_diff[i],
        }
      }
    }
  })
}

export function restrict_to_side(rd: RichDiff[], side?: G.Side): RichDiff[] {
  if (side === 'source') {
    return rd
      .filter(d => d.edit != 'Dropped')
      .map(d => (d.edit == 'Edited' ? {...d, target: [], target_diffs: []} : d))
  } else if (side === 'target') {
    return rd
      .filter(d => d.edit != 'Dragged')
      .map(d => (d.edit == 'Edited' ? {...d, source: [], source_diffs: []} : d))
  } else {
    return rd
  }
}
