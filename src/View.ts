import * as typestyle from "typestyle"
import { ViewDiff } from "./ViewDiff"
import { C, c } from './Classes'
import { VNode } from "snabbdom/vnode"
import { AppState, Diffs } from './Model'
import * as Model from './Model'
import * as Utils from './Utils'
import { tag, Content as S } from "snabbis"
import { CatchSubmit, InputField, button, div, span, table, tbody, tr, td, select } from "./Snabbdom"


import { Store, Lens } from "reactive-lens"

export interface CodeMirrors {
  vn_orig: VNode,
  vn_main: VNode,
  // vn_diff: VNode,
  // vn_xml:  VNode,
}

export const View = (store: Store<AppState>, diffs: Diffs, cms: CodeMirrors): VNode => {
  const Request = Model.ActionMaker(store)
  const login = store.at('login')
  const login_state = store.at('login_state')
  const msg_store = store.at('messages')
  const msg = msg_store.get()
  const st = Store.init([] as string[])
  st.on(x => console.log(Utils.show(x)))
  const header = div(
    tag('h3',
      'Normaliseringseditorsprototyp',
      S.on('click')(_ => store.set(Model.init())),
      C.Pointer
    ),
    /*
    Dropdown(st, [
      { label: 'x1',
        choices: [
          { value: 'apa', label: 'apa heheh' },
          { value: 'bepa', label: 'xlr' },
        ]
      },
      { label: 'x2',
        choices: [
          { value: 'cepa', label: 'urk' },
          { value: 'depa', label: 'hasnoetuhasnoethu ' },
        ]
      }
    ]),
      */
    msg.length > 0 &&
    tag('div',
      C.PadButtons,
      tag('div', msg),
       button('logout', () => { msg_store.set([]); login_state.set('out') }),
       button('dismiss', () => { msg_store.set([]) })
    )
  )
  if (login_state.get() == 'out') {
    return div(
      C.MainStyle,
      S.classed(typestyle.style({padding: '10px'})),
      header,
      'you need to login',
      CatchSubmit(
        () => login_state.set('in'),
        InputField(login.at('user')),
        InputField(login.at('password'), S.attrs({'type': 'password'})),
        button('login', () => login_state.set('in'))
      ),
      tag('hr'),
      button('try an example anyway', () => {
        login_state.set('anonymous')
      })
    )
  } else {
    return div(
      S.on('click')(() => {
        Request({kind: 'select_index', index: null})
      }),
      C.PadButtons,
      C.MainStyle,
      S.classed(typestyle.style({padding: '10px'})),
      header,
      ViewDiff(
        Model.current(store).pick('graph', 'selected_index').merge(store.pick('positions', 'dropdown')),
        Request,
        diffs.rich_diff,
        store.get().taxonomy
      ),
      div(C.SideBySideToTheLeft,
        tag('div', cms.vn_orig, C.TextEditor, C.Editor),
        div(
          tag('div', cms.vn_main, C.TextEditor, C.Editor),
          button('undo (ctrl-z)', () => Request('undo')),
          button('redo (ctrl-y)', () => Request('redo')),
          button('connect (ctrl-c)', () => Request('connect')),
          button('disconnect (ctrl-d)', () => Request('disconnect')),
          button('revert (ctrl-r)', () => Request('revert')),
        )
      ),
      tag('hr'),
      login_state.get() == 'anonymous'
      ?
      [
        button('back to login menu', () => login_state.set('out')),
      ]
      :
      [
        select(
          store.at('current'),
          store.at('graphs').via(Lens.lens(o => Object.keys(o).sort(), (s, t) => Utils.raise('getter'))),
          (k: string) => tag('option', k)),
        button('logout', () => login_state.set('out')),
        button('sync', () => store.at('sync_request').set(true)),
      ],
    )
  }
}
