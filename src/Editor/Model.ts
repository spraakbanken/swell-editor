import {Store, Lens, Undo} from 'reactive-lens'

import {Graph} from '../Graph'
import * as G from '../Graph'

import * as Utils from '../Utils'
import * as record from '../record'

import * as Manual from './Manual'

import {Taxonomy, config} from './Config'
import {validateState} from './Validate'
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
  /** warnings are like errors but should not prevent actions */
  readonly warnings: Record<string, true>

  /** for hot module reloading, bumped at each reload and used to make sure thunked components get updated */
  readonly generation: number

  readonly show: Partial<Record<Show, true>>

  /** are we reading the user manual? */
  readonly manual?: string

  readonly backurl?: string
  readonly backend?: string
  readonly essay?: string

  readonly start_mode?: Mode

  readonly version?: number

  readonly done?: boolean
}

export function disconnectBackend(store: Store<State>, k: () => void) {
  store.transaction(() => {
    store.update({
      backend: undefined,
      essay: undefined,
      start_mode: undefined,
      version: undefined,
    })
    k()
  })
}

export function initialBackendFetch(store: Store<State>) {
  const state = store.get()
  if (state.backend && state.essay) {
    function get(last_route: string, h: (res: any) => void) {
      Utils.GET(
        `${state.backend}${state.essay}${last_route}`,
        res_str => {
          try {
            h(JSON.parse(res_str))
          } catch (e) {
            flagError(store, `Error ${e.toString} when extracting state from ${res_str}`)
          }
        },
        (err, code) => flagError(store, `${code}: ${Utils.show(err)}`)
      )
    }

    get('', res => {
      const version = res.version
      if (version !== undefined && typeof version === 'number') {
        function try_raw(raw: any) {
          if (raw !== undefined && typeof raw === 'string') {
            return G.init(raw)
          }
        }
        let state
        const graph =
          try_raw(res.raw) || ((state = JSON.parse(res.state)), try_raw(state.raw) || state)
        console.log({version})
        store.update({
          graph: Undo.init(graph),
          version,
        })
        get('/status', res => {
          const done = res.done
          if (done !== undefined && typeof done == 'boolean') {
            store.update({done})
          } else {
            flagError(store, `Invalid status in ${Utils.show(res)}`)
          }
        })
      } else {
        flagError(store, `Invalid state in ${Utils.show(res)}`)
      }
    })
  }
}

export function savePeriodicallyToBackend(store: Store<State>) {
  const save = Utils.debounce(1000, () => {
    validateState(store)
    const state = store.get()
    const graph = store.get().mode == 'anonymization' ? visibleGraph(store) : state.graph.now
    if (
      state.version !== undefined &&
      state.backend &&
      state.essay &&
      Object.keys(state.errors).length == 0
    ) {
      console.log('saving...')
      store.update({version: undefined})
      Utils.POST(
        `${state.backend}${state.essay}/${state.version + 1}`,
        graph,
        res_str => {
          try {
            const res = JSON.parse(res_str)
            const version = res.version
            if (version !== undefined && typeof version === 'number') {
              console.log({version})
              store.update({version})
            } else {
              flagError(store, `No version confirmation in ${Utils.show(res)}`)
            }
          } catch (e) {
            flagError(store, `Error ${e.toString} when responding to ${res_str}`)
          }
        },
        (err, code) => flagError(store, `Error ${code} when saving: ${Utils.show(err)}`)
      )
    }
  })
  store
    .at('graph')
    .at('now')
    .ondiff((g1, g2) => G.equal(g1, g2) || save())
  store.at('done').ondiff(done => {
    validateState(store)
    const state = store.get()
    if (state.backend && state.essay && Object.keys(state.errors).length == 0) {
      Utils.POST(
        `${state.backend}${state.essay}/status`,
        {done},
        () => void 0,
        (err, code) =>
          flagError(store, `Error ${code} when setting done status: ${Utils.show(err)}`)
      )
    }
  })
}

export type Show = 'graph' | 'diff' | 'image_link' | 'examples' | 'source_text' | 'options'

export const shows = ['graph', 'diff', 'image_link', 'examples', 'source_text'] as Show[]

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
  warnings: {},
  mode: modes.normalization,
  taxonomy: config.taxonomy,
  show: {},
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
      flagError(store, msg)
      store.at('graph').set(Undo.init(G.init('x')))
    }
  }
}

export function flagError(store: Store<State>, msg: string) {
  store.at('errors').update({[msg]: true})
}

export function flagWarning(store: Store<State>, msg: string) {
  store.at('warnings').update({[msg]: true})
}

export function setManualTo(store: Store<State>, slug: string | undefined) {
  if (slug === undefined) {
    store.at('manual').set(undefined)
  } else {
    const page = Manual.manual[slug] || {graph: G.init(''), mode: modes.normalization}
    disconnectBackend(store, () =>
      store.update({
        manual: slug,
        graph: Undo.init(page.graph),
        mode: page.mode,
        selected: {},
      })
    )
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

export function isHovering(store: Store<State>) {
  const state = store.get()
  return state.hover_id !== undefined && Object.keys(state.selected).length == 0
}

export function inAnonMode(store: Store<State>) {
  return store.get().mode === modes.anonymization
}

export function history(store: Store<State>) {
  return {
    undo: () => store.at('graph').modify(Undo.undo),
    redo: () => store.at('graph').modify(Undo.redo),
    canUndo: () => Undo.can_undo(store.get().graph),
    canRedo: () => Undo.can_redo(store.get().graph),
  }
}

export function graphStore(store: Store<State>): Store<Graph> {
  return store.at('graph').at('now')
}

export function currentGraph(store: Store<State>) {
  return graphStore(store).get()
}

export function compactStore(store: Store<State>): Store<G.SourceTarget<string>> {
  return graphStore(store).via(
    Lens.iso(
      g => G.mapSides(G.graph_to_units(g), us => G.units_to_string(us)),
      state => {
        const s = G.parse(state.source)
        const t = G.parse(state.target)
        return G.units_to_graph(s, t)
      }
    )
  )
}

export function visibleGraph(store: Store<State>) {
  const state = store.get()
  const g = currentGraph(store)
  if (inAnonMode(store)) {
    return G.anonymize(G.sort_edge_labels(g, config.anonymization_label_order))
  } else if (state.subspan) {
    return G.subgraph(g, state.subspan)
  } else {
    return g
  }
}

export function onSelect(store: Store<State>, ids: string[], only: boolean) {
  const g = currentGraph(store)
  const visible_graph = visibleGraph(store)
  const tmg = G.token_map(g)
  const tmv = G.token_map(visible_graph)
  const emv = G.edge_map(visible_graph)
  const involved_ids = Utils.flatMap(ids, id => {
    if (inAnonMode(store)) {
      const t = tmv.get(id)
      if (t && t.side == 'target') {
        return visible_graph.edges[Utils.getUnsafe(emv, id).id].ids.filter(
          id => Utils.getUnsafe(tmv, id).side === 'source'
        )
      } else {
        return [id]
      }
    } else {
      return [id]
    }
  })
  if (only) {
    setSelection(store, involved_ids)
  } else {
    const selected = store.get().selected
    const b = involved_ids.every(id => selected[id]) ? undefined : true
    modifySelection(store, involved_ids, b)
  }
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
  | 'orphan'
  | 'merge'
  | 'group'
  | 'deselect'
  | 'next'
  | 'prev'
  | 'next_mod'
  | 'prev_mod'

export const actionButtons: Record<Mode, ActionOnSelected[]> = {
  normalization: [
    'prev',
    'next',
    'prev_mod',
    'next_mod',
    'group',
    'orphan',
    // 'merge',
    'auto',
    'revert',
    // 'deselect',
  ],
  anonymization: ['prev', 'next', 'prev_mod', 'next_mod'],
}

export const actionDescriptions: Record<ActionOnSelected, string> = {
  revert: 'Local undo on the selected tokens. Restores them to the source text.',
  auto:
    'Makes the selected tokens stop being manually linked and falls back to the automatic aligner.',
  orphan: 'Makes each of the selected tokens be orphaned: only linked to themselves.',
  merge: 'Connects the selected tokens and the tokens they are linked to.',
  group:
    'Makes a group of the selected words. (Any words they in turn are connected that are not selected will not be part of the group.)',
  deselect: 'Deselects the current group',
  next: 'Select next group',
  prev: 'Select previous group',
  next_mod: 'Select the next group which has modifications',
  prev_mod: 'Select the previous group which has modifications',
}

export const actionButtonNames: Record<ActionOnSelected, string> = {
  revert: 'revert',
  auto: 'auto',
  orphan: 'orphan',
  merge: 'merge',
  group: 'group',
  deselect: 'deselect',
  next: 'next',
  prev: 'previous',
  next_mod: 'next mod',
  prev_mod: 'prev mod',
}

// Alt-{q,w,t,n} are blocked on mac
// Alt is called Cmd (kringlan) on mac
export const actionKeyboard: Record<ActionOnSelected, string> = {
  revert: 'Alt-r',
  auto: 'Alt-a',
  orphan: 'Alt-o',
  merge: 'Alt-m',
  group: 'Alt-g',
  deselect: 'Escape',
  next: 'Alt-ArrowRight',
  prev: 'Alt-ArrowLeft',
  next_mod: 'Alt-Shift-ArrowRight',
  prev_mod: 'Alt-Shift-ArrowLeft',
}

function navigate(direction: 'next' | 'prev', kind: G.NavigationKind) {
  return ({graph, selected}: {graph: Graph; selected: string[]}) => {
    return {
      type: 'selection' as 'selection',
      selected:
        G.navigate_token_ids(
          graph,
          selected,
          direction,
          kind,
          i => config.order_changing_labels[i]
        ) || selected,
    }
  }
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
  orphan({graph, selected}) {
    return G.disconnect(graph, selected)
  },
  merge({graph, selected}) {
    return G.connect(graph, G.token_ids_to_edge_ids(graph, selected))
  },
  group({graph, selected}) {
    return this.merge({graph: G.disconnect(graph, selected), selected})
  },
  deselect() {
    return {type: 'selection', selected: []}
  },
  next: navigate('next', 'boring'),
  prev: navigate('prev', 'boring'),
  next_mod: navigate('next', 'interesting'),
  prev_mod: navigate('prev', 'interesting'),
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

const subkeys = <K extends string>(...ks: K[]): K[] => ks
const location_keys = subkeys('manual', 'backurl', 'backend', 'essay', 'start_mode')
const base64_keys = subkeys('backurl', 'backend')
const id = (s: string) => s

export function locationStore(store: Store<State>): Store<string> {
  const encode = (k: string) => (base64_keys.some(o => o == k) ? btoa : id)
  const decode = (k: string) => (base64_keys.some(o => o == k) ? atob : id)
  const substore = store.pick(...location_keys)
  return substore.via(
    Lens.iso(
      (state: Record<string, string | undefined>) =>
        record
          .traverse(state, (v, k) => (v === undefined ? '' : `${k}=${encode(k)(v)}`))
          .filter(s => s)
          .join('&'),
      str => {
        const obj = record.flatten(
          str.split('&').map(s => {
            const i = s.indexOf('=')
            if (i) {
              const k = s.slice(0, i)
              const v = s.slice(i + 1)
              return {[k]: v}
            } else {
              return {}
            }
          })
        )
        const r = {} as Record<string, string | undefined>
        location_keys.map(k => {
          if (k in obj) {
            try {
              r[k] = decode(k)(obj[k])
            } catch (e) {
              //pass
            }
          }
        })
        return r as any
      }
    )
  )
}
