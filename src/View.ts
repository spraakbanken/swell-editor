import * as typestyle from "typestyle"
import { ViewDiff } from "./ViewDiff"
import * as Classes from './Classes'
import { VNode } from "snabbdom/vnode"
import { AppState, Diffs } from './Model'
import { tag, Content as S } from "snabbis"
import { CatchSubmit, InputField, button, div, span, table, tbody, tr, td } from "./Snabbdom"

import { Store } from "reactive-lens"

export interface CodeMirrors {
  vn_orig: VNode,
  vn_main: VNode,
  // vn_diff: VNode,
  // vn_xml:  VNode,
}

export const View = (store: Store<AppState>, diffs: Diffs, cms: CodeMirrors): VNode => {
  const login = store.at('login')
  const login_state = store.at('login_state')
  if (login_state.get() == 'out') {
    return div(
      S.classed(Classes.MainStyle, typestyle.style({padding: '10px'})),
      tag('h3', 'Normaliseringseditorsprototyp'),
      'you need to login',
      CatchSubmit(
        () => login_state.set('in'),
        InputField(login.at('user')),
        InputField(login.at('password'), S.attrs({'type': 'password'})),
        button('login', () => login_state.set('in'))
      ),
      tag('hr'),
      button('try an example anyway', () =>
        login_state.set('anonymous')
        // TODO: set example sentences from the code book
      )
    )
  } else {
    return div(
      S.classed(Classes.MainStyle, typestyle.style({padding: '10px'})),
      tag('h3', 'Normaliseringseditorsprototyp'),
      tag('div', cms.vn_orig, S.classed(Classes.TextEditor, Classes.Editor)),
      ViewDiff(
        store.pick('graph', 'selected_index', 'positions'),
        diffs.rich_diff,
        store.get().taxonomy
      ),
      tag('div', cms.vn_main, S.classed(Classes.TextEditor, Classes.Editor)),
      tag('hr'),
      button('logout', () => login_state.set('out'))
    )
  }
}
