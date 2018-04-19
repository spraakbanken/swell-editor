import * as R from 'ramda'
import {Diff, Dragged, Dropped} from './Diff'
import {Graph} from './Graph'
import * as D from './Diff'
import * as G from './Graph'
import * as L from './Lines'

import * as Utils from '../Utils'
import * as record from '../record'

export type NavigationKind = 'boring' | 'interesting'

export function navigate(
  g: Graph,
  selected_edges: string[],
  dir: 'next' | 'prev',
  kind: NavigationKind,
  order_changing_label?: (s: string) => boolean
) {
  const diff = G.calculate_diff(g, order_changing_label)
  const interesting = new Set(
    diff.filter(d => d.edit != 'Edited' || D.target(d) != D.source(d)).map(d => d.id)
  )
  const centers = R.sortBy(
    i => (dir == 'next' ? i.center : -i.center),
    record.traverse(D.mass_centers(diff), (center, id) => ({id, center}))
  )
  for (let i = 0; i < centers.length; ++i) {
    if (selected_edges.some(id => id == centers[i].id)) {
      for (; i < centers.length; ++i) {
        const next = centers[i + 1]
        if (!next) return
        if (kind == 'boring' || interesting.has(next.id)) {
          return next.id
        }
      }
    }
  }
}

export function navigate_token_ids(
  g: Graph,
  selected_ids: string[],
  dir: 'next' | 'prev',
  kind: NavigationKind,
  order_changing_label?: (s: string) => boolean
) {
  const edge_ids = G.token_ids_to_edge_ids(g, selected_ids)
  const new_edge_id = navigate(g, edge_ids, dir, kind, order_changing_label)
  return new_edge_id && g.edges[new_edge_id].ids
}
