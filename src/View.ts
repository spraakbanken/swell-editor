import * as typestyle from "typestyle"
import { ViewDiff } from "./ViewDiff"
import { C, c } from './Classes'
import { VNode } from "snabbdom/vnode"
import { AppState, Diffs } from './Model'
import * as Positions from './Positions'
import * as Model from './Model'
import * as Utils from './Utils'
import { tag, s, tags, TagData } from "snabbis"
const { div, span, table, tbody, tr, td, th, option } = tags
const { button, input, select } = s

import { Store, Lens } from "reactive-lens"

export interface CodeMirrors {
  vn_orig: VNode,
  vn_main: VNode,
}

export function View(store: Store<AppState>, cms: CodeMirrors): VNode {
  const Request = Model.RequestMaker(store)
  const n = store.at('slide').get()
  let i = 0
  let p = -1
  function slide_do(act: () => void, ...data: TagData[]): VNode | undefined {
    const p_now = p
    p = i
    const yes = n <= i++ && n > p_now
    return yes ? (act(), tag('div', C.Slide, ...data)) : undefined
  }
  function slide(...data: TagData[]): VNode | undefined {
    return slide_do(() => { return }, ...data)
  }
  function pause(vn: VNode): VNode | undefined {
    return (n > i++) ? vn : undefined
  }
  function hide(vn: VNode): VNode {
    return (n > i++) ? vn : div(vn, s.css({visibility: 'hidden'}))
  }
  function css_hide(): TagData | true {
    return (n > i++) ? true : s.css({visibility: 'hidden'})
  }

  const slides = [

    slide(
      div(C.Title,
        span(
          span('The SweLL '),
          span('normalization',
            s.classes({[c.LineThrough]: n != i}),
            s.css({position: 'relative'}),
            span('error correction',
              css_hide(),
              s.classes({[c.LineThrough]: n != i}),
              s.css({
                position: 'absolute',
                top: '9rem',
                left: '3rem',
                width: '90rem',
                background: '#fff',
                border: '1rem solid red',
                padding: '1rem 2rem',
                borderRadius: '4rem'
              })),
            span('norm deviation',
              css_hide(),
              s.classes({[c.LineThrough]: n != i}),
              s.css({
                position: 'absolute',
                top: '21rem',
                left: '6rem',
                width: '85rem',
                background: '#fff',
                border: '1rem solid red',
                padding: '1rem 2rem',
                borderRadius: '4rem'
              })),
            span('learner phenomena',
              css_hide(),
              s.classes({[c.LineThrough]: n != i}),
              s.css({
                position: 'absolute',
                top: '33rem',
                left: '9rem',
                width: '100rem',
                background: '#fff',
                border: '1rem solid red',
                padding: '1rem 2rem',
                borderRadius: '4rem'
              })),
            span('parallel corpus',
              css_hide(),
              s.classes({[c.LineThrough]: n != i}),
              s.css({
                position: 'absolute',
                top: '45rem',
                left: '12rem',
                width: '80rem',
                background: '#fff',
                border: '1rem solid red',
                padding: '1rem 2rem',
                borderRadius: '4rem'
              }))
          ),
          span(' editor for learner texts')
        )
      ),
      div(C.Subtitle, 'Dan Rosén'),
      div(C.Subtitle, 'Språkbanken'),
      div(C.Subtitle, 'CLT Retreat 2017'),
      div(
        tag('img', s.attrs({src: 'talk/hws/logo_gu.png'}), s.css({padding: '3rem', height: '29rem'})),
        tag('img', s.attrs({src: 'talk/hws/logo_sb.jpg'}), s.css({padding: '5rem', height: '25rem'}), s.css({float: 'right'})),
      )
    ),

    slide(
      div(C.Header, 'Example learner sentences'),
      div(C.Bullet, 'Den väder var inte fint.'),
      div(C.Bullet, 'Jag åt två broad.'),
      div(C.Bullet, 'Vi gick dit för jag skulle få person nummer.'),
    ),
    slide(
      div(C.Header, 'Example running sentence'),
      div(C.Bullet, 'Examples here high light lotsof futures')
    ),

    (function() {
      const source = 'Examples here high light lotsof futures \u200b'.split(' ')
      const targets = [
        "Examples here high light lotsof futures \u200b".split(' '),
        "Examples here high light lotsof 'features \u200b".split(' '),
        "Examples here 'highlight \u200b lotsof features \u200b".split(' '),
        "Examples here highlight '?! lotsof features \u200b".split(' '),
        "Examples here highlight ?! 'lots\u00a0of features \u200b".split(' '),
        "Examples \u200b highlight ?! lots\u00a0of features 'here".split(' '),
        "Examples 'here(6) highlight ?! lots\u00a0of features \u200b".split(' '),
      ]
      const tables = targets.map(row => [source].concat([row]))

      return tables.map((data, j) =>
        slide(
          div(C.Header, 'Idea: Annotate learner tokens'),
          div(C.Bullet, 'Examples here high light lotsof futures'),
          table(s.css({borderSpacing: '2rem', fontSize: '6.5rem'}),
            tbody(
              tr(
                th('source'),
                data[0].map(x => td(x)),
              ),
              tr(
                th('target'),
                data[1].map(x => x[0] == "'" ? td(x.slice(1), s.css({color: 'red'})) : td(x)),
              )
            )
          ),
          (j == tables.length - 1) && pause(div(
            div(C.Bullet, "doesn't work, cannot satisfiably express:"),
            div(C.Underbullet, "token merging ", tags.i("(light)")),
            div(C.Underbullet, "token splitting ", tags.i("(of)")),
            div(C.Underbullet, "token movement ", tags.i("(here)")),
          ))
        )
      )
    })(),

    slide_do(() => {
        if (store.get().current != 'solved') {
          store.update({current: 'solved'})
        }
      },
      div(C.Header, 'Idea 2: this is a parallel corpus'),
      tag('center',
        ViewDiff(
          Model.current(store).pick('graph', 'selected_index').merge(store.pick('positions', 'dropdown')),
          Request,
          Model.calculate_diffs(store.get()).rich_diff,
          store.get().taxonomy
        ),
      ),
      pause(div(
        div(C.Bullet, "works, can satisfiably express:"),
        div(C.Underbullet, "token merging ", tags.i("(highlight)")),
        div(C.Underbullet, "token splitting ", tags.i("(lots of)")),
        div(C.Underbullet, "token movement ", tags.i("(here)")),
      ))
    ),

    slide_do(() => {
        if (store.get().current != 'examplesHere') {
          store.update({current: 'examplesHere'})
        }
      },
      ViewDiff(
        Model.current(store).pick('graph', 'selected_index').merge(store.pick('positions', 'dropdown')),
        Request,
        Model.calculate_diffs(store.get()).rich_diff,
        store.get().taxonomy
      ),
      div(
        tag('div', cms.vn_main, C.TextEditor, C.Editor),
        button('undo (ctrl-z)',       () => Request('undo'),       s.css({marginRight: '1rem', fontSize: '3rem'})),
        button('redo (ctrl-y)',       () => Request('redo'),       s.css({marginRight: '1rem', fontSize: '3rem'})),
        button('connect (ctrl-c)',    () => Request('connect'),    s.css({marginRight: '1rem', fontSize: '3rem'})),
        button('disconnect (ctrl-d)', () => Request('disconnect'), s.css({marginRight: '1rem', fontSize: '3rem'})),
        button('revert (ctrl-r)',     () => Request('revert'),     s.css({marginRight: '1rem', fontSize: '3rem'})),
      )
    )
  ]

  return Positions.posid('root', store.at('positions'), div(
    s.css({height: '100%', width: '100%', overflow: 'hidden'}),
    ...slides,
    s.on('click')((e: MouseEvent) => {
      Request({kind: 'select_index', index: null})
    }),
    C.SlideRoot,
    s.attrs({tabindex: '-1'}),
    s.hook('insert')((vn: VNode) => vn.elm && (vn.elm as HTMLElement).focus()),
    s.on('keydown')((e: KeyboardEvent) => {
      console.log(e.key)
      if (e.key == 'ArrowDown') {
        store.at('slide').modify(x => Math.min(i - 1, x + 1))
      } else if (e.key == 'ArrowUp') {
        store.at('slide').modify(x => Math.max(0, x - 1))
      }
    }),
  ))
  /*
  const login = store.at('login')
  const login_state = store.at('login_state')
  const msg_store = store.at('messages')
  const msg = msg_store.get()

  const header = div(
    tag('h3', 'Normaliseringseditorsprototyp'),
    msg.length > 0 &&
    tag('div',
      C.PadButtons,
      tag('div', msg),
       button('logout', () => { msg_store.set([]); login_state.set('out') }),
       button('dismiss', () => { msg_store.set([]) })
    )
  )
  if (login_state.get() == 'out') {
    const set_in = () => login_state.set('in')
    return div(
      C.MainStyle,
      s.classed(typestyle.style({padding: '10px'})),
      header,
      'you need to login',
      input(login.at('user'), set_in),
      input(login.at('password'), set_in, s.attrs({'type': 'password'})),
      button('login', set_in),
      tag('hr'),
      button('try an example anyway', () => {
        login_state.set('anonymous')
      })
    )
  } else {
    return div(
      s.on('click')(() => {
        Request({kind: 'select_index', index: null})
      }),
      C.PadButtons,
      C.MainStyle,
      s.classed(typestyle.style({padding: '10px'})),
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
          (k: string) => option(k)),
        button('logout', () => login_state.set('out')),
        button('sync', () => store.at('sync_request').set(true)),
      ],
    )
  }
  */
}
