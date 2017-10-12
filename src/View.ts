import * as CodeMirror from "codemirror"
import * as Spans from "./Spans"
import * as AppTypes from "./AppTypes"
import * as Classes from './Classes'
import * as ViewDiff from "./ViewDiff"
import * as Positions from "./Positions"
import * as Snabbdom from "./Snabbdom"
import * as typestyle from "typestyle"

import { tag, div, span, checkbox, wrapCM } from "./Snabbdom"
import { VNode } from "snabbdom/vnode"
import { AppState } from './AppTypes'

export interface ViewParts {
  cm_orig: CodeMirror.Editor,
  cm_main: CodeMirror.Editor,
  cm_diff: CodeMirror.Editor,
  cm_xml: CodeMirror.Editor,
  semi_rich_diff: Spans.SemiRichDiff[],
  state: AppState,
  selected_labels: string[],
  set_show_xml: (b: boolean) => void,
  select_index: (span_index: number | null) => void,
  ladder_keydown: (evt: KeyboardEvent) => void,
}

const noborderfocus = typestyle.style({outline: '0px solid transparent'})

const table = tag('table')
const tbody = tag('tbody')
const tr = tag('tr')
const td = tag('td')

const view = (parts: ViewParts, ladder: VNode) =>
  div(Classes.MainStyle, {}, typestyle.style({padding: '10px'}))(
    div(Classes.SideBySide)(
      div('cm_orig')(
        div(Classes.Caption)('Source text'),
        wrapCM(parts.cm_orig, Classes.TextEditor, Classes.Editor),
      ),
      div('cm_main')(
        div(Classes.Caption)('Normalised text'),
        wrapCM(parts.cm_main, Classes.TextEditor, Classes.Editor),
      ),
      div('cm_diff')(
        div(Classes.Caption)('Changes'),
        wrapCM(parts.cm_diff, Classes.TextEditor, Classes.Editor),
      ),
    ),
    div(Classes.Vertical, {
      on: {
        keydown: parts.ladder_keydown,
        blur: (_: Event) => {
          console.log('blur')
          parts.select_index(-1)
        }
      },
      attrs: {
        tabIndex: -1
      }
    }, noborderfocus)(
      div(Classes.Caption)('Alignment of source text and normalised text'),
      ladder
    ),
    parts.state.selected_index == null ? null :
    table(Classes.Vertical, {}, typestyle.style({'background': '#333'}))(
      tbody()(
        tr('', {attrs: {colspan: 2}})(
          td(typestyle.style({'color': '#eee'}))(
            span()(parts.state.current_prefix + '|'))),
        ...parts.state.taxonomy.map(e => {
          const cls = [] as string[]
          const active = parts.selected_labels.some(l => l == e.code)
          if (active) {
            cls.push(typestyle.style({'color': 'orange'}))
          } else {
            cls.push(typestyle.style({'color': '#ccc'}))
          }

          if (parts.state.current_prefix.length > 0) {
            if (AppTypes.prefixOf(parts.state.current_prefix, e.code)) {
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
          return tr('', {}, ...cls)(td()(e.code), td()(e.description))
        })
      )
    ),
    div()(
      span(Classes.FlushRight)(
        checkbox(parts.state.show_xml, parts.set_show_xml),
        span()('Show XML')
      ),
      (parts.state.show_xml || null) &&
      div('cm_xml')(
        div(Classes.Caption)('XML representation'),
        // someone else has put the right XML into the editor:
        wrapCM(parts.cm_xml, Classes.CodeEditor, Classes.Editor)
      )
    )
  )


export function setup(root_element: HTMLElement): (parts: ViewParts) => void {
  while (root_element.lastChild) {
    root_element.removeChild(root_element.lastChild)
  }

  const container = document.createElement('div')
  root_element.appendChild(container)
  let vnode = Snabbdom.patch(container, div()())
  let pos_dict = Positions.init_pos_dict()

  return (parts: ViewParts) => {
    ViewDiff.draw_diff(parts.semi_rich_diff, parts.cm_diff)
    typestyle.forceRenderStyles()
    do {
      pos_dict.modified = false
      const ladder = ViewDiff.ladder_diff(parts.semi_rich_diff, pos_dict, parts.state.selected_index, parts.select_index)
      vnode = Snabbdom.patch(vnode, view(parts, ladder))
    } while (pos_dict.modified)
  }
}

