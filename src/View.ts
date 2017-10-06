import * as CodeMirror from "codemirror"
import * as Spans from "./Spans"
import * as Classes from './Classes'
import * as ViewDiff from "./ViewDiff"
import * as Positions from "./Positions"
import * as Snabbdom from "./Snabbdom"
import * as typestyle from "typestyle"

import { div, span, checkbox, wrapCM } from "./Snabbdom"
import { VNode } from "snabbdom/vnode"
import { AppState } from './AppTypes'

export interface ViewParts {
  cm_orig: CodeMirror.Editor,
  cm_main: CodeMirror.Editor,
  cm_diff: CodeMirror.Editor,
  cm_xml: CodeMirror.Editor,
  semi_rich_diff: Spans.SemiRichDiff[],
  state: AppState,
  set_state: (to: AppState) => void,
}

const view = (parts: ViewParts, ladder: VNode) =>
  div(Classes.MainStyle)(
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
    div()(
      div(Classes.Caption)('Alignment of source text and normalised text'),
      ladder
    ),
    div(Classes.Vertical)(
      span(Classes.FlushRight)(
        checkbox(parts.state.show_xml, b => parts.set_state({...parts.state, show_xml: b})),
        span()('Show XML')
      ),
      (parts.state.show_xml || null) &&
      div('cm_xml')(
        div(Classes.Caption)('XML representation'),
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
      const ladder = ViewDiff.ladder_diff(parts.semi_rich_diff, pos_dict)
      vnode = Snabbdom.patch(vnode, view(parts, ladder))
    } while (pos_dict.modified)
  }
}

