import * as Spans from "./Spans"
import { Editor } from "codemirror"

export interface EditorState {
  readonly spans: Spans.Span[],
  readonly tokens: string[]
}

export interface Undoable<S> {
  readonly past: S[],
  readonly now: S,
  readonly future: S[]
}

export function undo<S>(state: Undoable<S>): Undoable<S> {
  const past = state.past.slice()
  const now = past.pop()
  if (now) {
    return {past, now, future: state.future.concat([state.now])}
  } else {
    return state
  }
}

export function redo<S>(state: Undoable<S>): Undoable<S> {
  const future = state.future.slice()
  const now = future.pop()
  if (now) {
    return {past: state.past.concat([state.now]), now, future}
  } else {
    return state
  }
}

export function advance<S>(state: Undoable<S>, to: S): Undoable<S> {
  return {past: state.past.concat([state.now]), now: to, future: []}
}

export function init_undoable<S>(now: S): Undoable<S> {
  return {past: [], now, future: []}
}

export interface AppState {
  readonly editor_state: Undoable<EditorState>,
  readonly show_xml: boolean,
  readonly selected_index: number | null,
  readonly current_prefix: string,
  readonly taxonomy: Taxonomy,
}

export const on_editor_state =
  (f: (x: Undoable<EditorState>) => Undoable<EditorState>) =>
  (state: AppState) =>
  ({...state, editor_state: f(state.editor_state)})


export function init_app(original: string): AppState {
  const tokens = Spans.tokenize(original)
  const spans = Spans.init(tokens)
  return {
    editor_state: init_undoable({tokens, spans}),
    show_xml: false,
    selected_index: null,
    current_prefix: '',
    taxonomy
  }
}

export interface TaxonomyEntry {
  code: string,
  description: string
}

export type Taxonomy = TaxonomyEntry[]

export const taxonomy: Taxonomy = [
  ['W', 'wrong word'],
  ['ORT', 'orthographic error'],
  ['PART', 'overcompounding'],
  ['SPL', 'oversplitting'],
  ['DER', 'deviant derivational affix used'],
  //['FL', 'Non-Norwegian word'],

  ['F', 'deviant selection of morphosyntactic category'],
  ['CAP', 'deviant letter case (upper/lower)'],
  ['PUNC', 'wrong selection of punctuation mark'],
  //['PUNCM', 'punctuation mark missing'],
  //['PUNCR', 'punctuation mark redundant'],

  ['INFL', 'deviant paradigm selection'],

  ['M', 'word or phrase missing'],
  ['R', 'word or phrase redundant'],

  ['O', 'word or phrase order'],

  ['O-INV', 'non-application of subject/verb inversion'],
  ['O-OINV', 'inappropriate subject/verb inversion'],
  ['O-MCA', 'deviant position for main clause adverbial'],
  ['O-SCA', 'deviant position for subsidiary clause adverbial'],

  ['X', 'impossible to interpret'],
].map(([code, description]: [string, string]) => ({code, description}))

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
