import { Store, Lens, Undo } from "reactive-lens"
import * as Spans from "./Spans"
import { PosDict } from "./Positions"
import { log, debug, debug_table } from "./dev"

export interface EditorState {
  readonly spans: Spans.Span[],
  readonly tokens: string[]
}

export interface AppState {
  readonly editor_state: Undo<EditorState>,
  /** if the last edit was into the main editor itself */
  readonly needs_full_update: boolean,
  readonly positions: PosDict,
  /** Index we are currently labelling */
  readonly selected_index: number | null,
  readonly current_prefix: string,
  readonly taxonomy: Taxonomy,
  readonly show_xml: boolean,
}

export function WithoutHistory(store: Store<AppState>) {
  return store
    .omit('editor_state')
    .merge(
      store.relabel({
        editor_state: store.at('editor_state').at('now')
      }))
}

export function init(original: string): AppState {
  const tokens = Spans.tokenize(original)
  const spans = Spans.init(tokens)
  return {
    editor_state: Undo.init({tokens, spans}),
    needs_full_update: true,
    positions: {},
    selected_index: null,
    current_prefix: '',
    taxonomy,
    show_xml: false,
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

export function advance_spans(es: Store<Undo<EditorState>>, new_spans: Spans.Span[], new_tokens?: string[]) {
  if (new_spans.length == 0) {
    log('not updating to empty spans')
    // full_view_update will be run on('change')
    return
  }
  if (debug) {
    const errors = Spans.check_invariant(new_spans)
    if (errors.length > 0) {
      console.error(new_spans)
      console.error(errors)
      throw errors
    }
  }

  const es_now = es.at('now')
  const spans_store = es_now.at('spans')
  const tokens_store = es_now.at('tokens')

  es.transaction(() => {
    es.modify(Undo.advance)
    spans_store.set(new_spans)
    if (new_tokens) {
      tokens_store.set(new_tokens)
    }
  })
}

export function modify_spans(es: Store<Undo<EditorState>>, f: (spans: Spans.Span[], tokens: string[]) => Spans.Span[]) {
  const es_now = es.at('now')
  const {spans, tokens} = es_now.get()
  const new_spans = f(spans, tokens)
  if (spans !== new_spans) {
    advance_spans(es, new_spans)
  }
}

export function select_index(store: Store<AppState>, selected_index: number | null) {
  store.update({selected_index})
}
