import * as typestyle from "typestyle"
import { ViewDiff } from "./ViewDiff"
import * as Classes from './Classes'
import { VNode } from "snabbdom/vnode"
import { AppState } from './Model'
import { tag, Content as S } from "snabbis"
import { div, span, table, tbody, tr, td } from "./Snabbdom"

import { Store } from "reactive-lens"

export interface CodeMirrors {
  vn_orig: VNode,
  vn_main: VNode,
  // vn_diff: VNode,
  // vn_xml:  VNode,
}

export const View = (store: Store<AppState>, cms: CodeMirrors) =>
  div(
    S.classed(Classes.MainStyle, typestyle.style({padding: '10px'})),
    tag('h3', 'Normaliseringseditorsprototyp'),
    tag('div', cms.vn_orig, S.classed(Classes.TextEditor, Classes.Editor)),
    ViewDiff(store.pick('graph', 'selected_index', 'rich_diff', 'positions')),
    tag('div', cms.vn_main, S.classed(Classes.TextEditor, Classes.Editor)),
  )


