import * as Spans from "./Spans"
import { Editor } from "codemirror"

export interface Editors {
  readonly cm_orig: Editor,
  readonly cm_main: Editor,
  readonly cm_diff: Editor
}

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
  readonly editor_state: Undoable<EditorState>
  readonly show_xml: boolean
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
    show_xml: false
  }
}

