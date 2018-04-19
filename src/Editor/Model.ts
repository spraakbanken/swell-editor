import {Store, Lens, Undo} from 'reactive-lens'

import {Graph} from '../Graph'
import * as G from '../Graph'

import * as Utils from '../Utils'
import * as record from '../record'

import {Taxonomy, config} from './Config'
export {Taxonomy} from './Config'

export interface State {
  readonly graph: Undo<Graph>
  readonly hover_id?: string
  readonly selected: Record<string, true>
  readonly subspan?: G.Subspan
  readonly side_restriction?: G.Side
  /** for hot module reloading, bumped at each reload and used to make sure thunked components get updated */
  readonly generation: number
  /** error messages */
  readonly errors: Record<string, true>

  readonly mode: Mode
  /* where should the taxonomy be stored? */
  readonly taxonomy: Record<Mode, Taxonomy>
}

export type Mode = 'anonymization' | 'normalization'

export const modes: Record<Mode, Mode> = {
  anonymization: 'anonymization',
  normalization: 'normalization',
}

export function nextMode(m: Mode) {
  return m === modes.anonymization ? modes.normalization : modes.anonymization
}

export const init: State = {
  graph: Undo.init(G.init('')),
  hover_id: undefined,
  selected: {},
  subspan: undefined,
  side_restriction: undefined,
  generation: 0,
  errors: {},
  mode: modes.normalization,
  taxonomy: config.taxonomy,
}

export function check_invariant(store: Store<State>): (g: Graph) => void {
  return g => {
    const inv = G.check_invariant(g)
    if (inv !== 'ok') {
      Utils.stderr(inv)
      const msg = [
        `Internal invariant violated:`,
        inv.violation,
        '',
        `Please report this as a bug, describe what you did and include the current graph:`,
        Utils.show(inv.g),
      ].join('\n')
      store.at('errors').update({[msg]: true})
      store.at('graph').set(Undo.init(G.init('x')))
    }
  }
}

export function deselect(store: Store<State>) {
  store.update({selected: {}, hover_id: undefined})
}

export function deselect_removed_ids(graph: Graph, selected0: Record<string, true>) {
  const em = G.edge_map(graph)
  const present = (s: string) => em.has(s)
  const selected = record.filter(selected0, (_, id) => present(id))
  const n_keys = (o: Object) => Object.keys(o).length
  if (n_keys(selected) < n_keys(selected0)) {
    return {selected}
  }
}

export function make_history_advance_function(store: Store<State>) {
  const graph = store.at('graph')
  const now = graph.at('now')
  return (k: () => void) =>
    store.transaction(() => {
      const g0 = now.get()
      k()
      const g1 = now.get()
      if (!G.equal(g0, g1)) {
        now.set(g0)
        graph.modify(Undo.advance_to(g1))
      }
    })
}

export type ActionOnSelected = 'revert' | 'auto' | 'disconnect' | 'connect' | 'isolate'

export const onSelectedActions: ActionOnSelected[] = [
  'revert',
  'auto',
  'disconnect',
  'connect',
  'isolate',
]

export const act_on_selected: {
  [K in ActionOnSelected]: (graph: Graph, selected: string[]) => Graph
} = {
  revert(graph, selected) {
    const edge_ids = G.token_ids_to_edge_ids(graph, selected)
    const edges = G.token_ids_to_edges(graph, selected)
    return G.revert(graph, edge_ids)
  },
  auto(graph, selected) {
    const edge_ids = G.token_ids_to_edge_ids(graph, selected)
    return G.align({
      ...graph,
      edges: record.map(graph.edges, e => {
        if (edge_ids.some(id => id == e.id)) {
          return G.Edge(e.ids, e.labels, false)
        } else {
          return e
        }
      }),
    })
  },
  disconnect: G.disconnect,
  connect(graph, selected) {
    return G.connect(graph, G.token_ids_to_edge_ids(graph, selected))
  },
  isolate(graph, selected) {
    return this.connect(this.disconnect(graph, selected), selected)
  },
}
