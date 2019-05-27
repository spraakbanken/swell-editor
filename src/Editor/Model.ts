import {Store, Lens, Undo} from 'reactive-lens'

import * as G from '../Graph'

import * as Utils from '../Utils'
import * as record from '../record'

import * as Manual from '../Doc/Manual'

import {Taxonomy, config, label_order, LabelOrder, taxonomy_has_label, label_args} from './Config'
import {Severity, Rule, edge_check} from './Validate'
import {init_pstore, anonymize, Pseudonyms, is_anon_label} from './Anonymization'

export interface State {
  readonly graph: Undo<G.Graph>
  readonly rich_diff?: G.RichDiff[]
  readonly hover_id?: string
  readonly selected: Record<string, true>
  readonly subspan?: G.Subspan
  readonly side_restriction?: G.Side
  readonly mode: Mode
  readonly taxonomy: Record<Mode, Taxonomy>

  /** Error messages stay until manually closed. */
  readonly errors: Record<string, true>

  /** Validation messages are transient, they are updated dynamically. */
  readonly validation_messages: Message[]

  /** for hot module reloading, bumped at each reload and used to make sure thunked components get updated */
  readonly generation: number

  readonly show: Partial<Record<Show, true>>
  readonly doc?: string
  readonly doc_node?: Element

  /** are we reading the user manual? */
  readonly manual?: string

  /** Pseudonyms are remembered by label combination, e.g. "city 2" => "Zürich". */
  readonly pseudonyms: Pseudonyms
  /** Extra arguments for pseudonymization, which are not labels. */
  readonly pseudonym_args: Record<string, string[]>

  readonly backurl?: string
  readonly backend?: string
  readonly essay?: string
  readonly user?: number

  readonly start_mode?: Mode
  readonly readonly?: boolean
  readonly version?: number

  readonly done?: boolean
}

export interface Message {
  message: string
  subject?: any
  severity: Severity
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

const essay_url = (state: State, endpoint = '') =>
  `${state.backend}${state.essay}${state.user ? '/' + state.user : ''}${endpoint}`

export const can_modify = (state: State) => ({
  state: !state.readonly && !state.done,
  done: !state.readonly,
})

export function initialBackendFetch(store: Store<State>, then: () => void) {
  const state = store.get()
  if (state.backend && state.essay) {
    function get(last_route: string, h: (res: any) => void) {
      Utils.GET(
        essay_url(state, last_route),
        res_str => {
          try {
            h(JSON.parse(res_str))
          } catch (e) {
            flagError(store, `Error ${e.toString()} when extracting state from ${res_str}`)
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
        store.update({
          graph: Undo.init(graph),
          version,
        })
        store.update({readonly: !res.access_write})
        get('/status', res => {
          const done = res.done
          if (done !== undefined && typeof done == 'boolean') {
            store.update({done})
            then()
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

export function save(store: Store<State>) {
  const state = store.get()
  const graph = store.get().mode == 'anonymization' ? visibleGraph(store) : state.graph.now
  if (
    state.version !== undefined &&
    state.backend &&
    state.essay &&
    record.size(state.errors) == 0
  ) {
    console.log('saving...')
    store.update({version: undefined})
    Utils.POST(
      essay_url(state, `/version/${state.version + 1}`),
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
}

/** Report an exception to the backend message log. */
export function report(store: Store<State>, message: string) {
  const state = store.get()
  Utils.POST(
    essay_url(state, '/report'),
    {message},
    () => {},
    (err, code) => flagError(store, `Error ${code} when reporting "${message}": ${Utils.show(err)}`)
  )
}

export function savePeriodicallyToBackend(store: Store<State>) {
  const debounced_save = Utils.debounce(1000, () => {
    !inAnonfixMode(store.get()) && !store.get().readonly && save(store)
  })
  store
    .at('graph')
    .at('now')
    .ondiff((g1, g2) => G.equal(g1, g2) || debounced_save())
  store.at('done').ondiff(done => {
    done && validateState(store)
    const state = store.get()
    if (state.backend && state.essay && record.size(state.errors) == 0 && !inAnonfixMode(state)) {
      Utils.POST(
        essay_url(state, '/status'),
        {done},
        res_str => {
          const res = JSON.parse(res_str)
          store.update({readonly: !res.access_write})
        },
        (err, code) => {
          flagError(store, `Error ${code} when setting done status: ${Utils.show(err)}`)
          store.at('done').set(!done)
        }
      )
    }
  })
}

export type Show =
  | 'graph'
  | 'diff'
  | 'image_link'
  | 'examples'
  | 'validation'
  | 'source_text'
  | 'target_text'
  | 'options'

export type Mode = 'anonymization' | 'normalization' | 'correctannot'

export const modes: Record<Mode, Mode> = {
  anonymization: 'anonymization',
  normalization: 'normalization',
  correctannot: 'correctannot',
}

export function mode_label(mode: Mode): string {
  return {
    [modes.anonymization]: 'pseudonymization',
    [modes.normalization]: 'normalization',
    [modes.correctannot]: 'correction annotation',
  }[mode]
}

/** Are we limited to tagging, and not allowed to edit target text? */
export function is_target_readonly(mode: Mode): boolean {
  return [modes.anonymization, modes.correctannot].includes(mode)
}

export const init: State = {
  graph: Undo.init(G.init('')),
  rich_diff: undefined,
  hover_id: undefined,
  selected: {},
  subspan: undefined,
  side_restriction: undefined,
  generation: 0,
  errors: {},
  validation_messages: [],
  mode: modes.normalization,
  taxonomy: config.taxonomy,
  show: {
    target_text: true,
  },
  pseudonyms: {},
  pseudonym_args: {},
}

export function check_invariant(store: Store<State>): (g: G.Graph) => void {
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

/** Validation rules for app state.

  const graph = G.modify_labels(G.init('x'), 'e-s0-t0', () => ['OBS!'])
  validationRules[0].check({graph, state: {...init, mode: 'anonymization', done: true}}) // => [{severity: Severity.ERROR, message: '"x"'}]
  validationRules[0].check({graph, state: {...init, mode: 'normalization', done: true}}) // => [{severity: Severity.ERROR, message: '"x"'}]
  validationRules[0].check({graph, state: {...init, mode: 'anonymization', done: false}}) // => []

  const graph = G.unaligned_modify_tokens(G.init('x'), 0, 1, 'y ')
  validationRules[1].check({graph, state: {...init, mode: 'correctannot'}}) // => [{severity: Severity.WARNING, message: '"x"'}]

  const graph = G.modify_labels(G.init('x'), 'e-s0-t0', () => ['firstname:female', 'region', 'OBS!', 'gen', 'ort'])
  validationRules[2].check({graph, state: {...init, mode: 'anonymization'}}) // => [{severity: Severity.ERROR, message: '"x"'}]

  const g0 = G.init('x y')
  const g1 = G.modify_labels(g0, 'e-s0-t0', () => ['firstname:female'])
  const graph = G.modify_labels(g1, 'e-s1-t1', () => ['firstname:female', '1'])
  validationRules[3].check({graph, state: {...init, mode: 'anonymization', done: true}}) // => [{severity: Severity.ERROR, message: '"x"'}]
  validationRules[3].check({graph, state: {...init, mode: 'anonymization'}}) // => []
  validationRules[3].check({graph, state: {...init, done: true}}) // => []

  const g0 = G.init('x y')
  const g1 = G.modify_labels(g0, 'e-s0-t0', () => ['1'])
  const graph = G.modify_labels(g1, 'e-s1-t1', () => ['firstname:female', '1'])
  validationRules[4].check({graph, state: {...init, mode: 'anonymization', done: true}}) // => [{severity: Severity.ERROR, message: '"x"'}]
  validationRules[4].check({graph, state: {...init, done: true}}) // => []
  validationRules[4].check({graph, state: {...init, mode: 'anonymization'}}) // => []

*/
const validationRules: Rule<{state: State; graph: G.Graph}>[] = [
  Rule(
    'Temporary tags not allowed when done',
    edge_check(
      state => !!state.done && !inAnonfixMode(state),
      edge => edge.labels.filter(l => label_order(l) == LabelOrder.TEMP).length > 0
    )
  ),
  Rule(
    'Normalization missing a label',
    edge_check(
      state => state.mode == modes.correctannot,
      (edge, source, target) => G.text(source) != G.text(target) && edge.labels.length == 0,
      Severity.WARNING
    )
  ),
  Rule(
    'Too many main labels',
    edge_check(
      state => state.mode == modes.anonymization,
      edge =>
        edge.labels.filter(l => is_anon_label(l) && label_order(l) == LabelOrder.BASE).length > 1
    )
  ),
  Rule(
    'Running number missing',
    edge_check(
      state => state.mode == modes.anonymization && !!state.done,
      edge =>
        edge.labels.filter(l => is_anon_label(l) && label_order(l) == LabelOrder.BASE).length > 0 &&
        edge.labels.filter(l => label_order(l) == LabelOrder.NUM).length == 0
    )
  ),
  Rule(
    'Running number used alone',
    edge_check<State>(
      state => state.mode == modes.anonymization && !!state.done,
      edge =>
        edge.labels.filter(l => label_order(l) == LabelOrder.NUM).length > 0 &&
        edge.labels.filter(l => is_anon_label(l) && label_order(l) == LabelOrder.BASE).length == 0
    )
  ),
]

/** Go through our rules and flag errors for any invalidations. */
export function validateState(store: Store<State>, show?: boolean) {
  clearValidationMessages(store)
  const state = store.get()
  const graph = state.graph.now
  validationRules.forEach(rule => {
    rule.check({state, graph}).forEach(result => {
      flagValidationMessage(store, rule.name, result.severity, result.subject)
    })
  })
  show !== undefined && store.at('show').update({validation: show ? true : undefined})
}

/** Make changes, validate new state and revert changes if the result is invalid, returns whether it is valid. */
export function validation_transaction(store: Store<State>, f: (s: Store<State>) => void): boolean {
  // Avoid triggering listeners until we're done.
  return store.transaction(() => {
    // Remember ingoing state.
    const prev = store.get()
    // Perform changes.
    f(store)
    // Validate new state.
    validateState(store)
    const validation_messages = store.at('validation_messages').get()
    const errors = validation_messages.filter(msg => msg.severity == Severity.ERROR)
    // If the changes result in invalid state, revert to ingoing state but with messages added.
    if (errors.length > 0) {
      store.set({...prev, validation_messages})
    }
    return errors.length === 0
  })
}

export function flagError(store: Store<State>, msg: string) {
  store.at('errors').update({[msg]: true})
}

export function flagValidationMessage(
  store: Store<State>,
  message: string,
  severity: Severity,
  subject?: any
) {
  store.at('validation_messages').modify(msgs => [...msgs, {message, severity, subject}])
}

export function clearValidationMessages(store: Store<State>) {
  store.at('validation_messages').set([])
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
    store.at('selected').set(record.create<string, true>(ids, () => true))
  })
}

export function deselect_removed_ids(store: Store<State>, selected0: Record<string, true>) {
  const em = G.edge_map(viewGraph(store))
  const present = (s: string) => em.has(s)
  const selected = record.filter(selected0, (_, id) => present(id))
  if (record.size(selected) < record.size(selected0)) {
    return {selected}
  }
}

/** Updates subspan to include selection as well as any other indices. */
export function setSubspanIncluding(store: Store<State>, indicies: G.SidedIndex[]) {
  const g = viewGraph(store)
  const tm = G.token_map(g)
  const selected = Object.keys(store.get().selected).map(token_id => Utils.getUnsafe(tm, token_id))
  Utils.setIfChanged(store.at('subspan'), G.sentences_around(g, [...indicies, ...selected]))
}

export function isHovering(store: Store<State>) {
  const state = store.get()
  return state.hover_id !== undefined
}

export function inAnonMode(state: State) {
  return state.mode === modes.anonymization
}

export function inAnonfixMode(state: State) {
  const start_mode = state.start_mode as string
  return start_mode && start_mode != modes.anonymization && inAnonMode(state)
}

export function history(store: Store<State>) {
  return {
    undo: () => store.at('graph').modify(Undo.undo),
    redo: () => store.at('graph').modify(Undo.redo),
    canUndo: () => Undo.can_undo(store.get().graph),
    canRedo: () => Undo.can_redo(store.get().graph),
  }
}

export function graphStore(store: Store<State>): Store<G.Graph> {
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

export function initPseudonymizations(store: Store<State>): void {
  store.at('pseudonyms').set(init_pstore(currentGraph(store)))
}

/** The graph, possibly transformed to be viewed (anonymized). */
// TODO Store result in store, to avoid executing often?
export function viewGraph(store: Store<State>) {
  const pmod = (token_id: string, src: string, labels: string[]) => ({
    src,
    labels: labels.concat(store.get().pseudonym_args[token_id] || []),
  })
  return inAnonMode(store.get())
    ? anonymize(G.sort_edge_labels(currentGraph(store), label_order), store.at('pseudonyms'), pmod)
    : currentGraph(store)
}

/** The relevant portion of the graph. */
export function visibleGraph(store: Store<State>) {
  const state = store.get()
  const g = viewGraph(store)

  return state.subspan && state.mode !== modes.anonymization ? G.subgraph(g, state.subspan) : g
}

export function onSelect(store: Store<State>, ids: string[], only: boolean) {
  const emv = G.edge_map(visibleGraph(store))
  const involved_ids = Utils.flatMap(ids, id => {
    if (inAnonMode(store.get())) {
      // Select full edge.
      return Utils.getUnsafe(emv, id).ids
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
  return (k: (g0: G.Graph) => void) =>
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

export function setLabel(store: Store<State>, token_ids: string[], label: string, value: boolean) {
  const edges = G.token_ids_to_edges(currentGraph(store), token_ids)
  const graph = graphStore(store)
  const edge_ids = edges.map(e => e.id)
  const labels = Utils.uniq(Utils.flatMap(edges, e => e.labels))

  // Add/remove label.
  // For numbers and main anon labels, replace existing ones.
  const replace_conds = [
    (x: string) => /^\d+$/.test(x),
    (x: string) => taxonomy_has_label(modes.anonymization, x) && label_order(x) == LabelOrder.BASE,
  ]
  const replace_cond = replace_conds.find(cond => cond(label))
  const single_set_label = (labels: string[]) =>
    replace_cond
      ? labels.filter(l => !replace_cond(l)).concat(value ? [label] : [])
      : Utils.set_modify(labels, label, value)
  edge_ids.forEach(id => graph.modify(g => G.modify_labels(g, id, single_set_label)))

  // Auto-group consecutive tokens in anonymization.
  if (store.get().mode == 'anonymization') {
    if (value && label_order(label) == LabelOrder.BASE) {
      // When adding a main label, also connect the selected tokens.
      graph.modify(g =>
        G.group_consecutive(g, edges, 'source').reduce(
          (g, es) => G.connect(g, es.map(e => e.id)),
          g
        )
      )
      // The selected tokens may have new edges.
      const edges_new = G.token_ids_to_edges(graph.get(), token_ids)

      // Number magic: For each new edge, if the source text matches an already number-labeled
      // source text, use that number, otherwise use the maximum + 1.
      const nem = number_edge_map(graph.get())
      const partition = G.partition_ids(graph.get())
      const edge_source = (e: G.Edge) => G.text(partition(e.ids)['source'])
      const strmax = (xs: string[]) => Utils.maximum([0, ...xs.map(l => Number(l) || 0)])
      let maxnum = strmax(Object.keys(nem))
      edges_new.forEach(e => {
        const match = Object.keys(
          record.filter(nem, nes => nes.some(ne => edge_source(ne) == edge_source(e)))
        )[0]
        label_args[label] ||
          graph.modify(g => G.modify_labels(g, e.id, l => [...l, String(match ? match : ++maxnum)]))
      })
    } else if (!value && labels.length <= 1) {
      // When there was only one label and we are removing it, revert the connection made before.
      graph.modify(g => G.revert(g, edge_ids))
    }
  }
}

/** Map numeric labels to edges where they are used. */
export function number_edge_map(g: G.Graph) {
  return G.label_edge_map(g, l => /^\d+$/.test(l))
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
  normalization: ['prev', 'next', 'prev_mod', 'next_mod', 'group', 'orphan', 'auto', 'revert'],
  correctannot: ['prev', 'next', 'prev_mod', 'next_mod', 'group', 'orphan', 'auto' /*, 'revert'*/],
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
  return ({graph, selected}: {graph: G.Graph; selected: string[]}) => {
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
    gs: {graph: G.Graph; selected: string[]}
  ) => G.Graph | {type: 'selection'; selected: string[]}
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
          return G.Edge(e.ids, e.labels, false, e.comment)
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
const location_keys = subkeys('manual', 'backurl', 'backend', 'essay', 'start_mode', 'user')
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
              const v = decodeURIComponent(s.slice(i + 1))
              return {[k]: v}
            } else {
              return {}
            }
          })
        )
        const r = {} as Record<string, string | undefined>
        location_keys.map(k => {
          if (k in obj) {
            r[k] = decode(k)(obj[k])
          }
        })
        return r as any
      }
    )
  )
}
