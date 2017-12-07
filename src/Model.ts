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

import { Group, Alt } from "./Dropdown"
import * as Dropdown from "./Dropdown"

import { Store, Lens, Undo, Requests } from "reactive-lens"
import { PosDict } from "./Positions"
import { log, debug, debug_table } from "./dev"

export interface GraphState {
  /** The parallel corpus */
  readonly graph: Undo<Graph>,
  /** Index in target text for the sentence */
  readonly cursor_index: number,
  /** Index we are currently labelling: selected index in the diff (todo: change to selected edge id?) */
  readonly selected_index: number | null,
  /** The drag state */
  readonly drag_state: Partial<DragState>
}

export interface DragState {
  readonly drag_start: string,
  readonly drag_start_end: string,
  readonly drag_over: string,
  readonly drag_type: 'merge' | 'rearrange',
  readonly drag_over_last: string[]
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
  /** Error messages */
  readonly messages: string[]
  /** Current dropdown */
  readonly dropdown: Dropdown.State,


  // For slides
  readonly slide: number,
}

export type Request =
    'prev' | 'next' // Moving between sentences
  | 'revert' | 'connect' | 'disconnect'
  | 'undo' | 'redo'
  | { kind: 'revert_at', at: string }
  | { kind: 'disconnect_at', at: string }
  | { kind: 'connect_two', one: string, two: string }
  | { kind: 'select_index', index: number | null }
  | { kind: 'rearrange', begin: string, end: string, dest: string }

export const RequestMaker = (store: Store<AppState>) =>
  (x: Request) => {
    console.log('Request: ' + JSON.stringify(x))
    Requests.request_maker(store.at('requests'))(x)
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
          },
          (error_str, code) => {
            const mp = Store.arr(store.at('messages'), 'push')
            try {
              const error = JSON.parse(error_str)
              console.log(error)
              mp(error.error.message)
            } catch (e) {
              mp('Error in error handling code: ' + e.toString())
            }
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
    drag_state: {}
  }
}


export const solved_graph_state: GraphState = {
  graph: Undo.init(
    {"source":[{"text":"Examples ","id":"s0"},{"text":"here ","id":"s1"},{"text":"high ","id":"s2"},{"text":"light ","id":"s3"},{"text":"lotsof ","id":"s4"},{"text":"futures ","id":"s5"},{"text":". ","id":"s6"}],"target":[{"text":"Examples ","id":"t0"},{"text":"highlight ","id":"t7"},{"text":"lots ","id":"t8"},{"text":"of ","id":"t9"},{"text":"features ","id":"t11"},{"text":"here ","id":"t1"},{"text":". ","id":"t6"}],"edges":{"e-s0-t0":{"id":"e-s0-t0","ids":["s0","t0"],"labels":[]},"e-s1-t1":{"id":"e-s1-t1","ids":["s1","t1"],"labels":[]},"e-s6-t6":{"id":"e-s6-t6","ids":["s6","t6"],"labels":[]},"e-t7-s2-s3":{"id":"e-t7-s2-s3","ids":["t7","s2","s3"],"labels":[]},"e-t8-t9-s4":{"id":"e-t8-t9-s4","ids":["t8","t9","s4"],"labels":[]},"e-t11-s5":{"id":"e-t11-s5","ids":["t11","s5"],"labels":[]}}}
  ),
  cursor_index: 0,
  selected_index: null,
  drag_state: {}
}


export function init(text?: string): AppState {
  return {
    graphs: {
      example: init_graph_state(text || ''),
      examplesHere: init_graph_state('Examples here high light lotsof futures . '),
      solved: solved_graph_state,
      sentences: init_graph_state('I went to the store went my mum was there . '),
      dont_dare: init_graph_state('Do you not dare ! '),
      together_apart: init_graph_state('to getherapart '),
      together_aparto: init_graph_state('to getheraparto getheraparto getheraparto '),
    },
    current: 'solved',
    needs_full_update: true,
    positions: {},
    taxonomy,
    login: {user: '', password: ''},
    login_state: 'out',
    sync_request: false,
    synced: false,
    ro_source: true,
    requests: [],
    messages: [],
    dropdown: Dropdown.init,
    slide: 0
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

export function state_diffs(state: AppState): Diffs {
  const st = current_state(state)
  return calculate_diffs(st.graph.now, st.cursor_index)
}

export function calculate_diffs(g: Graph, cursor_index: number): Diffs {
  const graph = G.subgraph(g, G.sentence(g, cursor_index))
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

function entry(value: string, label: string): Alt {
  return {value, label}
}

function group(label: string, ...choices: Alt[]): Group {
  return {label, choices}
}

export type Taxonomy = Group[]

// https://spraakbanken.gu.se/eng/swell/swell_codebook
export const taxonomy: Taxonomy = [
  group('Lexical',
    entry('W', 'Wrong word or punctuation'),
    entry('W-REF', 'Reference error'),
    entry('ORT', 'Orthographic/spelling error'),
    entry('PART', 'Overcompounding'),
    entry('SPL', 'Oversplitting'),
    entry('DER', 'Deviant derivational affix used'),
    entry('CAP', 'Deviant letter case (upper/lower)'),
    entry('ID', 'Idiomaticity'),
    entry('FL', 'Non-Swedish word')
  ),
  group('Morphological',
    entry('F', 'Deviant selection of morphosyntactic category'),
    entry('F-DEF', 'Deviation in definite/indefinite forms'),
    entry('F-TENSE', 'Covers all deviations with verbs and verb groups, incl aspect'),
    entry('F-NUM', 'Deviation in number agreement'),
    entry('F-AGR', 'Agreement error (kongruensfel)'),
    entry('INFL', 'Deviant paradigm selection; overgeneralization'),
  ),
  group('Syntactical',
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
  ),
  group('Intelligibility',
    entry('X', "impossible to interpret writer's intention"),
  ),
  group('Agreement',
    entry('AGR', 'Agreement errors'),
  )
]

