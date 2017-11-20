import { Diff, Dragged, Dropped } from './Diff'
import * as D from './Diff'
import { RichDiff } from './RichDiff'
import * as R from './RichDiff'
import { Graph } from "./Graph"
import * as G from "./Graph"
import { Token, Span } from './Token'
import * as T from './Token'
import { TokenDiff } from "./Utils"
import * as Utils from "./Utils"

import { Store, Lens, Undo } from "reactive-lens"
import { PosDict } from "./Positions"
import { log, debug, debug_table } from "./dev"

export interface GraphState {
  /** The parallel corpus */
  readonly graph: Undo<Graph>,
  /** Index in target text for the sentence */
  readonly cursor_index: number,
  /** Index we are currently labelling: selected index in the diff (todo: change to selected edge id?) */
  readonly selected_index: number | null,
}

export interface AppState {
  /** The parallel corpus */
  readonly graphs: Record<string, GraphState>,
  /** The current graph */
  readonly current: string,
  /** If the last target text edit wasn't into the main editor itself */
  readonly needs_full_update: boolean,
  /** Positions of divs in the ladder graph diagram */
  readonly positions: PosDict,
  /** The whole taxonomy */
  readonly taxonomy: Taxonomy,
  /** Login information */
  readonly login_state: 'out' | 'anonymous' | 'in'
  /** Login information */
  readonly login: Login,
  /** Sync request */
  readonly sync_request: boolean
  /** Synced */
  readonly synced: boolean,
  /** Edit source text */
  readonly ro_source: boolean,
  /** Requests */
  readonly requests: Request[],
}

export type Request = 'prev' | 'next' | 'unselect' | 'revert' | 'connect' | 'disconnect' | 'undo' | 'redo'

export type Action = (r: Request) => void

export function ActionMaker(store: Store<AppState>): Action {
  return Store.arr(store.at('requests'), 'push')
}

export function Request(store: Store<AppState>, r: Request): void {
  ActionMaker(store)(r)
}


const backend = 'https://ws.spraakbanken.gu.se/ws/sparv/swell/'
// const backend = 'http://127.0.0.1:8000/'

let reloads = 0

export function setup_sync(store: Store<AppState>): (() => void)[] {
  const i = reloads++
  const post = Utils.debounce(1000, () => {
    const {login_state, login, synced} = store.get()
    if (login_state == 'in' && synced) {
      Utils.POST(
        backend + 'set',
        {
          user: login.user,
          pw: login.password,
          state: StrippedEssentials(store)
        },
        (r: any) => console.log({i}))
     }
  })
  return [
    Essentials(store).ondiff(post),
    store.at('login_state').ondiff(login_state => {
      console.log({login_state})
      if (login_state == 'in') {
        store.update({synced: false, sync_request: true})
      }
      if (login_state == 'out') {
        store.set(init(''))
      }
    }),
    store.at('sync_request').ondiff(sync_request => {
      store.at('sync_request').set(false)
      const {login_state, login} = store.get()
      console.log('sync_request', {sync_request, login_state})
      if (sync_request && login_state == 'in') {
        Utils.POST(
          backend + 'get',
          {
            user: login.user,
            pw: login.password
          },
          essentials => {
            const e = JSON.parse(essentials)
            store.transaction(() => {
              Essentials(store).set(e)
              store.at('needs_full_update').set(true)
              store.at('synced').set(true)
            })
          }
        )
       }
    })
  ]
}

export type Navigation = 'prev' | 'next' | 'stay'

export interface Login {
  readonly user: string,
  readonly password: string
}

export function ForLocalStorage(store: Store<AppState>) {
  return store.pick('login', 'login_state')
}

export function Essentials(store: Store<AppState>) {
  return store.pick('graphs', 'current')
}

export function StripGraphState(gs: GraphState) {
  return {
    ...gs,
    graph: Undo.init(gs.graph.now)
  }
}

export function StrippedEssentials(store: Store<AppState>) {
  const e = Essentials(store).get()
  return {
    ...e,
    graphs: Utils.record_map(e.graphs, StripGraphState)
  }
}

export function init_graph_state(text?: string): GraphState {
  return {
    graph: Undo.init(G.init(text || '')),
    cursor_index: 0,
    selected_index: null,
  }
}


export function init(text?: string): AppState {
  return {
    graphs: {
      example: init_graph_state(text || '')
    },
    current: 'example',
    needs_full_update: true,
    positions: {},
    taxonomy,
    login: {user: '', password: ''},
    login_state: 'out',
    sync_request: false,
    synced: false,
    ro_source: true,
    requests: []
  }
}

export interface Diffs {
  /** Current diff (calculated from the graph) */
  readonly diff: Diff[],
  /** Current rich diff (calculated from the graph) */
  readonly rich_diff: RichDiff[],
}

export const current_lens: Lens<AppState, GraphState> =
  Lens.lens(
    state => state.graphs[state.current],
    (state, st) => ({...state, graphs: {...state.graphs, [state.current]: st}}))

export function current(store: Store<AppState>): Store<GraphState> {
  return store.via(current_lens)
}

export function current_state(state: AppState): GraphState {
  return current_lens.get(state)
}

export function calculate_diffs(state: AppState): Diffs {
  const st = current_state(state)
  const g = st.graph.now
  const graph = G.subgraph(g, G.sentence(g, st.cursor_index))
  const diff = G.calculate_diff(graph)
  return {diff, rich_diff: R.enrichen(graph, diff)}
}

// TODO: set example sentences from the code book
export const example_sentence = 'Jag har en katt . En hund och en häst . '

export function load_example(store: Store<Undo<Graph>>, example?: string) {
  const ex = example || 'Jag har en katt . En hund och en häst . '
  store.set(Undo.init(G.init(ex)))
}

////////////////////////////////////////////////////////////////////////////////
// Normalizing

export function advance_graph(gs: Store<Undo<Graph>>, new_graph: Graph) {
  if (debug) {
    const inv = G.check_invariant(new_graph)
    if (inv != 'ok') {
      console.error(inv.violation)
      console.error(inv.g)
      throw inv.violation
    }
  }

  gs.modify(Undo.advance_to(new_graph))
}

export function modify_graph(gs: Store<Undo<Graph>>, f: (g: Graph) => Graph) {
  const gs_now = gs.at('now')
  const graph = gs_now.get()
  const new_graph = f(graph)
  if (graph !== new_graph) {
    advance_graph(gs, new_graph)
  }
}

////////////////////////////////////////////////////////////////////////////////
// Labelling

export interface TaxonomyEntry {
  code: string,
  description: string
}

function entry(code: string, description: string): TaxonomyEntry {
  return {code, description}
}

export type Taxonomy = TaxonomyEntry[]

// https://spraakbanken.gu.se/eng/swell/swell_codebook
export const taxonomy: Taxonomy = [
  entry('W', 'Wrong word or punctuation'),
  entry('W-REF', 'Reference error'),
  entry('ORT', 'Orthographic/spelling error'),
  entry('PART', 'Overcompounding'),
  entry('SPL', 'Oversplitting'),
  entry('DER', 'Deviant derivational affix used'),
  entry('CAP', 'Deviant letter case (upper/lower)'),
  entry('ID', 'Idiomaticity'),
  entry('FL', 'Non-Swedish word'),
  entry('F', 'Deviant selection of morphosyntactic category'),
  entry('F-DEF', 'Deviation in definite/indefinite forms, may apply to groups of words'),
  entry('F-TENSE', 'Covers all deviations with verbs and verb groups, incl aspect'),
  entry('F-NUM', 'Deviation in number agreement'),
  entry('F-AGR', 'Agreement error (kongruensfel), e.g. between adjective and noun; pronoun and noun, etc.'),
  entry('INFL', 'Deviant paradigm selection, but interpreted to be in accordance with the morphosyntactical form in Swedish; overgeneralization'),
  entry('M', 'Word, phrase or punctuation missing'),
  entry('M-SUBJ', 'Subject missing'),
  entry('R', 'Word or phrase redundant'),
  entry('R-PREP', 'Preposition redundant'),
  entry('R-PUNC', 'Punctuation mark redundant'),
  entry('O', 'Word or phrase order'),
  entry('INV', 'Non-application of subject/verb inversion '),
  entry('OINV', 'Application of subject/verb inversion in inappropriate contexts'),
  entry('MCA', 'Incorrect position for main clause adverbial'),
  entry('SCA', 'Incorrect position for subsidiary clause adverbial'),
  entry('X', 'impossible to interpret the writer’s intention with a word, phrase or sentence.'),
  entry('AGR', 'Agreement errors'),
]

export const prefixOf =
  (prefix: string, s: string) =>
  0 == s.toLowerCase().indexOf(prefix.toLowerCase())

export const exactMatch =
  (prefix: string, s: string) =>
  s.toLowerCase() == prefix.toLowerCase()

export const prefixMatches =
  (prefix: string, t: Taxonomy) =>
  t.filter(e => prefixOf(prefix, e.code))

export const exactMatches =
  (prefix: string, t: Taxonomy) =>
  t.filter(e => exactMatch(prefix, e.code))

