import * as R from 'ramda'
import {Diff, Dragged, Dropped} from './Diff'
import {Graph} from './Graph'
import * as D from './Diff'
import * as G from './Graph'
import * as L from './Lines'

import * as Utils from '../Utils'
import * as record from '../record'

export function navigate(g: Graph, selected_edges: string[], dir: 'next' | 'prev') {
  const centers = R.sortBy(
    i => (dir == 'next' ? i.center : -i.center),
    record.traverse(D.mass_centers(G.calculate_diff(g)), (center, id) => ({id, center}))
  )
  for (let i = 0; i < centers.length; ++i) {
    if (selected_edges.some(id => id == centers[i].id)) {
      const next = centers[i + 1]
      return next && next.id
    }
  }
}

export function navigate_token_ids(g: Graph, selected_ids: string[], dir: 'next' | 'prev') {
  const edge_ids = G.token_ids_to_edge_ids(g, selected_ids)
  const new_edge_id = navigate(g, edge_ids, dir)
  return new_edge_id && g.edges[new_edge_id].ids
}
