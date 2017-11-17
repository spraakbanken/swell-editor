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

export interface AppState {
  /** The parallel corpus */
  readonly graph: Undo<Graph>,
  /** If the last edit was into the main editor itself */
  readonly needs_full_update: boolean,
  /** Positions of divs in the ladder graph diagram */
  readonly positions: PosDict,
  /** Index we are currently labelling: selected index in the diff (todo: change to selected edge id?) */
  readonly selected_edge: number | null,
  /** The whole taxonomy */
  readonly taxonomy: Taxonomy,
  /** Login information */
  readonly login_state: 'out' | 'anonymous' | 'in'
  /** Login information */
  readonly login: Login
}

export interface Login {
  readonly user: string,
  readonly password: string
}

export function ForLocalStorage(store: Store<AppState>): Store<AppState['login']> {
  return store.at('login')
}

export function Essentials(store: Store<AppState>) {
  return store
    .pick('selected_index', 'taxonomy')
    .merge(
      store.relabel({
        graph: store.at('graph').at('now')
      }))
}

export function init(original: string): AppState {
  const graph = G.init(original)
  return {
    graph: Undo.init(graph),
    needs_full_update: true,
    positions: {},
    selected_index: null,
    taxonomy,
    login: {user: '', password: ''},
    login_state: 'out'
  }
}

export interface Diffs {
  /** Current diff (calculated from the graph) */
  readonly diff: Diff[],
  /** Current rich diff (calculated from the graph) */
  readonly rich_diff: RichDiff[],
}

export function calculate_diffs(store: Store<AppState>): Diffs {
  const graph = store.get().graph.now
  const diff = G.calculate_diff(graph)
  return {diff, rich_diff: R.enrichen(graph, diff)}
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

export function select_index(store: Store<AppState>, selected_index: number | null) {
  store.update({selected_index})
}

/*
export function ladder_keydown(store: Store<AppState>, semi_rich_diff: Spans.SemiRichDiff[], key: string) {
  const state = store.get()
  const res = ladder_keydown_helper(key, state)
  if (res.new_prefix != undefined) {
    store.update({current_prefix: res.new_prefix})
  }
  if (res.new_spans != undefined) {
    advance_spans(store.at('editor_state'), res.new_spans)
  }
  console.log(key)
  if (state.selected_index) {
    if (key == 'Escape') {
      store.update({selected_index: -1}) // TODO: fix this ugly hax
    }
    if (key == 'Enter' || key == 'ArrowRight') {
      let x
      store.update({selected_index: x = Spans.next_group(state.selected_index, semi_rich_diff)})
      console.log({x})
    }
    if (key == 'ArrowLeft') {
      store.update({selected_index: Spans.prev_group(state.selected_index, semi_rich_diff)})
    }
  }
}

function ladder_keydown_helper(evt_key: string, state: AppState): { new_prefix?: string, new_spans?: Spans.Span[] } {
  if (state.selected_index != null) {
    const {current_prefix} = state

    const spacelike = evt_key == " " || evt_key == ","

    const new_prefix = (function () {
      if (evt_key.length == 1 && !spacelike) {
        return current_prefix + evt_key
      } else if (evt_key == 'Backspace') {
        return current_prefix.slice(0, current_prefix.length - 1)
      } else {
        return current_prefix
      }
    })()

    log({evt_key, current_prefix, new_prefix, spacelike})

    // if key is enter then we should advance the selected group

    if (new_prefix == '') {
      return { new_prefix }
    } else {
      const filter = (spacelike || evt_key == "Enter") ? exactMatches : prefixMatches
      const matches = filter(new_prefix, state.taxonomy)
      log('matches:', matches)
      if (matches.length == 1) {
        if (state.selected_index) {
          return {
            new_prefix: '',
            new_spans:
              Spans.modify_label_state(
                state.editor_state.now.spans,
                state.selected_index,
                matches[0].code,
                v => !v)
          }
        } else {
          console.error('group index out of bounds')
          return { new_prefix: '' }
        }
      } else if (matches.length == 0) {
        // don't allow inserting this
        return {}
      } else {
        return { new_prefix }
      }
    }
  }
  return {}
}

export function toggle_code(store: Store<AppState>, code: string) {
  const state = store.get()
  if (state.selected_index != null) {
    advance_spans(store.at('editor_state'),
      Spans.modify_label_state(
        state.editor_state.now.spans,
        state.selected_index,
        code,
        v => !v))
  }
}
*/
