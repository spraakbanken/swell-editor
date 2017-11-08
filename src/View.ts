import * as CodeMirror from "codemirror"
import * as Spans from "./Spans"
import * as Model from "./Model"
import * as Classes from './Classes'
import * as ViewDiff from "./ViewDiff"
import * as Positions from "./Positions"
import * as Snabbdom from "./Snabbdom"
import * as typestyle from "typestyle"

import { checkbox } from "./Snabbdom"
import { VNode } from "snabbdom/vnode"
import { AppState } from './Model'
import { tag, Content as S } from "snabbis"

import { Store, Lens, Undo } from "reactive-lens"

export interface CodeMirrors {
  vn_orig: VNode, // CodeMirror.Editor,
  vn_main: VNode, // CodeMirror.Editor,
  vn_diff: VNode, // CodeMirror.Editor,
  vn_xml:  VNode, // CodeMirror.Editor,
}

// no @types for prettify-xml
declare function require(module_name: string): any
const format: (xml_string: string) => string = require('prettify-xml')

/*
  state: AppState,
  selected_labels: string[],
  set_show_xml: (b: boolean) => void,
  select_index: (span_index: number | null) => void,
  ladder_keydown: (evt: KeyboardEvent) => void,
  toggle_code: (code: string) => void
}
*/

export const InputField = (store: Store<string>, ...bs: S[]) =>
  tag('input',
    S.props({ value: store.get() }),
    S.on('input')((e: Event) => store.set((e.target as HTMLInputElement).value)),
    ...bs)

const noborderfocus = typestyle.style({outline: '0px solid transparent'})

export const mktag = (name: string) => (...bs: S[]) => tag(name, ...bs)

export const div = mktag('div')
export const span = mktag('span')
export const table = mktag('table')
export const tbody = mktag('tbody')
export const tr = mktag('tr')
export const td = mktag('td')

export const view = (store: Store<AppState>, cms: CodeMirrors) => {
  const {spans, tokens} = store.get().editor_state.now
  const diff = Spans.calculate_diff(spans, tokens)
  const rich_diff = Spans.enrichen_diff(diff)
  const semi_rich_diff = Spans.semirich(rich_diff)

/*
  const pretty_xml = format(new XMLSerializer().serializeToString(Spans.diff_to_xml(diff)))
  if (pretty_xml != cms.vn_xml.getDoc().getValue()) {
    const cursor = cms.vn_xml.getDoc().getCursor()
    cms.vn_xml.getDoc().setValue(pretty_xml)
    cms.vn_xml.getDoc().setSelection(cursor, cursor)
  }
  */

  const state = store.get()

  let selected_labels = [] as string[]
  if (state.selected_index && state.selected_index in spans) {
    //const i = Spans.lookup_group(state.selected_index, semi_rich_diff)
    selected_labels = spans[state.selected_index].labels
  }

  typestyle.forceRenderStyles()

  // ViewDiff.draw_diff(semi_rich_diff, cms.vn_diff)

  const ladder = ViewDiff.ladder_diff(
    store.at('positions'),
    semi_rich_diff,
    state.selected_index,
    (span_index: number) => Model.select_index(store, span_index)
  )
  const spans_store = store.at('editor_state').at('now').at('spans')

  return div(
    S.classed(Classes.MainStyle, typestyle.style({padding: '10px'})),
    tag('h3', 'Normaliseringseditorsprototyp'),
    tag('div', S.classed(Classes.TextEditor, Classes.Editor), cms.vn_orig),
    div(
      S.classed(Classes.Vertical, noborderfocus),
      S.on('keydown')((e: KeyboardEvent) => Model.ladder_keydown(store, semi_rich_diff, e.key)),
      S.attrs({ tabIndex: -1 }),
      // div(Classes.Caption)('Alignment of source text and normalised text'),
      ladder
    ),
    (state.selected_index == null || state.selected_index == -1)
    ?
    tag('div', S.classed(Classes.TextEditor, Classes.Editor), cms.vn_main)
    :
    div(
      S.on('keydown')((evt: KeyboardEvent) => Model.ladder_keydown(store, semi_rich_diff, evt.key)),
      S.classed(Classes.FitContent),
      S.attrs({ tabIndex: 1 }),
      table(
        S.classed(
          Classes.Vertical,
          typestyle.style({'background': '#333'})),
        tbody(
          tr(S.attrs({colspan: 2}),
            td(S.classed(typestyle.style({'color': '#eee'})),
              span(state.current_prefix + '|'))),
          ...state.taxonomy.map(e => {
            const cls = [] as string[]
            const active = selected_labels.some(l => l == e.code)
            if (active) {
              cls.push(typestyle.style({'color': 'orange'}))
            } else {
              cls.push(typestyle.style({'color': '#ccc'}))
            }

            if (state.current_prefix.length > 0) {
              if (Model.prefixOf(state.current_prefix, e.code)) {
                cls.push(typestyle.style({'color': 'yellow !important'}))
              } else {
                if (active) {
                  cls.push(typestyle.style({'color': '#ddd !important'}))
                } else {
                  cls.push(typestyle.style({'color': '#999 !important'}))
                }
              }
            } else {
            }
            return tr(
              S.classed(Classes.Pointer, ...cls),
              S.on('keydown')((evt: KeyboardEvent) => Model.ladder_keydown(store, semi_rich_diff, evt.key)),
              S.on('click')((_: MouseEvent) => Model.toggle_code(store, e.code)),
              td(e.code),
              td(e.description))
          })
        )
      )
    ),
    /*
    div()(
      span(Classes.FlushRight)(
        checkbox(state.show_xml, set_show_xml),
        span()('Show XML')
      ),
      (state.show_xml || null) &&
      div('cms.vn_xml')(
        div(Classes.Caption)('XML representation'),
        // someone else has put the right XML into the editor:
        wrapCM(cms.vn_xml, Classes.CodeEditor, Classes.Editor)
      )
    )
    */
  )
}


/*
    document.getElementsByTagName('body')[0].onkeydown = parts.ladder_keydown
*/
