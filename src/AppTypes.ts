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
  readonly selected_group: string | null,
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
    selected_group: null,
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
  ['FL', 'Non-Norwegian word'],

  ['F', 'deviant selection of morphosyntactic category'],
  ['CAP', 'deviant letter case (upper/lower)'],
  ['PUNC', 'wrong selection of punctuation mark'],
  ['PUNCM', 'punctuation mark missing'],
  ['PUNCR', 'punctuation mark redundant'],

  ['F-AGR', 'deviant selection of morphosyntactic category: “agreement errors,” i.e. errors following logically from, and triggered by, previous errors, the agreement itself being in accordance with the target language norm'],
  ['CAP-AGR', 'deviant letter case (upper/lower): “agreement errors,” i.e. errors following logically from, and triggered by, previous errors, the agreement itself being in accordance with the target language norm'],
  ['PUNC-AGR', 'wrong selection of punctuation mark: “agreement errors,” i.e. errors following logically from, and triggered by, previous errors, the agreement itself being in accordance with the target language norm'],
  ['PUNCM-AGR', 'punctuation mark missing: “agreement errors,” i.e. errors following logically from, and triggered by, previous errors, the agreement itself being in accordance with the target language norm'],
  ['PUNCR-AGR', 'punctuation mark redundant: “agreement errors,” i.e. errors following logically from, and triggered by, previous errors, the agreement itself being in accordance with the target language norm'],

  ['INFL', 'deviant paradigm selection, but interpreted to be in accordance with the morphosyntactical form in Norwegian'],

  ['M', 'word or phrase missing'],
  ['R', 'word or phrase redundant'],

  ['O', 'word or phrase order'],

  ['O-INV', 'word or phrase order: non-application of subject/verb inversion'],
  ['O-OINV', 'word or phrase order: application of subject/verb inversion in inappropriate contexts'],
  ['O-MCA', 'word or phrase order: incorrect position for main clause adverbial'],
  ['O-SCA', 'word or phrase order: incorrect position for subsidiary clause adverbial'],

  ['X', 'impossible to interpret the writer’s intention with the passage)'],
].map(([code, description]: [string, string]) => ({code, description}))
