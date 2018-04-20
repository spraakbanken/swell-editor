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
  readonly mode: Mode
  readonly taxonomy: Record<Mode, Taxonomy>

  /** error messages */
  readonly errors: Record<string, true>

  /** for hot module reloading, bumped at each reload and used to make sure thunked components get updated */
  readonly generation: number
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

export function modifySelection(store: Store<State>, ids: string[], value: boolean | undefined) {
  store.transaction(() =>
    ids.forEach(id =>
      store
        .at('selected')
        .via(Lens.key(id))
        .set(value == false ? undefined : value)
    )
  )
}

export function setSelection(store: Store<State>, ids: string[]) {
  store.transaction(() => {
    store.update({selected: record.create<string, true>(ids, () => true)})
    const subspan = store.get().subspan
    setSubspanIncluding(store, (subspan && G.subspan_to_indicies(subspan)) || [])
  })
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

export function setSubspanIncluding(store: Store<State>, indicies: G.SidedIndex[]) {
  const g = store.get().graph.now
  const tm = G.token_map(g)
  const selected = Object.keys(store.get().selected).map(token_id => Utils.getUnsafe(tm, token_id))
  Utils.setIfChanged(store.at('subspan'), G.sentences_around(g, [...indicies, ...selected]))
}

export function make_history_advance_function(store: Store<State>) {
  const graph = store.at('graph')
  const now = graph.at('now')
  return (k: (g0: Graph) => void) =>
    store.transaction(() => {
      const g0 = now.get()
      k(g0)
      const g1 = now.get()
      if (!G.equal(g0, g1)) {
        now.set(g0)
        graph.modify(Undo.advance_to(g1))
      }
    })
}

export type ActionOnSelected =
  | 'revert'
  | 'auto'
  | 'disconnect'
  | 'connect'
  | 'isolate'
  | 'deselect'
  | 'next'
  | 'prev'
  | 'next_mod'
  | 'prev_mod'

export const onSelectedActions: ActionOnSelected[] = [
  'prev',
  'next',
  'prev_mod',
  'next_mod',
  'auto',
  'isolate',
  'connect',
  'disconnect',
  'revert',
  'deselect',
]

export const actionDescriptions: Record<ActionOnSelected, string> = {
  revert: 'Local undo on the selected tokens. Restores them to the source text.',
  auto:
    'Makes the selected tokens stop being manually linked and falls back to the automatic aligner.',
  disconnect: 'Makes each of the selected token be disconnected and only connected to itself.',
  connect: 'Connects the selected tokens and the tokens they are linked to.',
  isolate:
    'Connects the selected tokens only: the tokens they are connected to will not be part of the group.',
  deselect: 'Deselects the current group',
  next: 'Select next group',
  prev: 'Select previous group',
  next_mod: 'Select the next group which has modifications',
  prev_mod: 'Select the previous group which has modifications',
}

export const actionButtonNames: Record<ActionOnSelected, string> = {
  revert: 'revert',
  auto: 'auto',
  disconnect: 'disconnect',
  connect: 'connect',
  isolate: 'isolate',
  deselect: 'deselect',
  next: 'next',
  prev: 'previous',
  next_mod: 'next mod',
  prev_mod: 'prev mod',
}

export const actionKeyboard: Record<ActionOnSelected, string> = {
  revert: 'Alt-r',
  auto: 'Alt-a',
  disconnect: 'Alt-u',
  connect: 'Alt-c',
  isolate: 'Alt-i',
  deselect: 'Escape',
  next: 'Alt-n',
  prev: 'Alt-p',
  next_mod: 'Alt-N',
  prev_mod: 'Alt-P',
}

const act_on_selected: {
  [K in ActionOnSelected]: (
    gs: {graph: Graph; selected: string[]}
  ) => Graph | {type: 'selection'; selected: string[]}
} = {
  revert({graph, selected}) {
    const edge_ids = G.token_ids_to_edge_ids(graph, selected)
    const edges = G.token_ids_to_edges(graph, selected)
    return G.revert(graph, edge_ids)
  },
  auto({graph, selected}) {
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
  disconnect({graph, selected}) {
    return G.disconnect(graph, selected)
  },
  connect({graph, selected}) {
    return G.connect(graph, G.token_ids_to_edge_ids(graph, selected))
  },
  isolate({graph, selected}) {
    return this.connect({graph: G.disconnect(graph, selected), selected})
  },
  deselect() {
    return {type: 'selection', selected: []}
  },
  next({graph, selected}) {
    return {
      type: 'selection',
      selected:
        G.navigate_token_ids(
          graph,
          selected,
          'next',
          'boring',
          i => config.order_changing_labels[i]
        ) || selected,
    }
  },
  prev({graph, selected}) {
    return {
      type: 'selection',
      selected:
        G.navigate_token_ids(
          graph,
          selected,
          'prev',
          'boring',
          i => config.order_changing_labels[i]
        ) || selected,
    }
  },
  next_mod({graph, selected}) {
    return {
      type: 'selection',
      selected:
        G.navigate_token_ids(
          graph,
          selected,
          'next',
          'interesting',
          i => config.order_changing_labels[i]
        ) || selected,
    }
  },
  prev_mod({graph, selected}) {
    return {
      type: 'selection',
      selected:
        G.navigate_token_ids(
          graph,
          selected,
          'prev',
          'interesting',
          i => config.order_changing_labels[i]
        ) || selected,
    }
  },
}

export function performAction(store: Store<State>, action: ActionOnSelected) {
  const graph_store = store.at('graph').at('now')
  const graph = graph_store.get()
  const selected = Object.keys(store.get().selected)
  const res = act_on_selected[action]({graph, selected})
  if ('type' in res) {
    setSelection(store, res.selected)
  } else {
    const advance = make_history_advance_function(store)
    advance(() => graph_store.set(res))
  }
}
