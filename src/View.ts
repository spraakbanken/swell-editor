import * as typestyle from "typestyle"
import { ViewDiff } from "./ViewDiff"
import { C, c } from './Classes'
import { VNode } from "snabbdom/vnode"
import { AppState, Diffs } from './Model'
import * as Positions from './Positions'
import * as G from "./Graph"
import * as Model from './Model'
import * as Utils from './Utils'
import { tag, s, tags, TagData } from "snabbis"
const { div, span, table, tbody, tr, td, th, option, pre } = tags
const { button, input, select } = s
import { log } from "./dev"

import { Store, Lens } from "reactive-lens"

var stringify = require("json-stringify-pretty-compact")


export interface CodeMirrors {
  vn_orig: VNode,
  vn_main: VNode,
}

export function View(store: Store<AppState>, cms: CodeMirrors): VNode {
  const Request = Model.RequestMaker(store)
  const n = store.at('slide').get()
  let i = 0
  let p = -1
  function slide_on(current: string, ...data: TagData[]) {
    return slide_do(
      () => {
        if (store.get().current != current) {
          store.update({current})
        }
      },
      ...data
    )
  }
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
  function oneslide(vn: VNode): VNode | undefined {
    return (n == ++i) ? vn : undefined
  }
  function hide(vn: VNode): VNode {
    return (n > i++) ? vn : div(vn, s.css({visibility: 'hidden'}))
  }
  function css_hide(): TagData | true {
    return (n > i++) ? true : s.css({visibility: 'hidden'})
  }

  function ViewGraph(): VNode {
    const {graph, cursor_index, drag_state} = Model.current(store).get()
    let calc_diff = () => Model.calculate_diffs(graph.now, cursor_index)
    if (drag_state) {
      const {drag_start, drag_start_end, drag_over, drag_type} = drag_state
      if (drag_start && drag_start_end && drag_over && drag_type == 'rearrange') {
        const tm = G.target_map(graph.now)
        let begin: number | undefined = tm.get(drag_start)
        let end: number | undefined = tm.get(drag_start_end)
        let dest: number | undefined = tm.get(drag_over)
        if (begin !== undefined && end !== undefined && dest !== undefined) {
          const diff = Model.calculate_diffs(G.rearrange(graph.now, begin, end, dest), cursor_index)
          log('Drawing with a current drag and drop: ', {begin, end, dest})
          calc_diff = () => diff
        }
      }
    }

    return div(
      C.MainStyle,
      ViewDiff(
        Model.current(store).pick('graph', 'selected_index', 'drag_state').merge(store.pick('positions', 'dropdown')),
        Request,
        calc_diff().rich_diff,
        store.get().taxonomy
      )
    )
  }

  function ViewEditor(): VNode {
    return div(
      C.PadButtons,
      C.MainStyle,
      ViewGraph(),
      s.css({padding: '3rem'}),
      div(C.LH,
        tag('div', cms.vn_main, C.TextEditor, C.Editor),
        button('undo (ctrl-z)',       () => Request('undo'),       s.css({marginRight: '1rem', fontSize: '3rem'})),
        button('redo (ctrl-y)',       () => Request('redo'),       s.css({marginRight: '1rem', fontSize: '3rem'})),
        button('connect (ctrl-c)',    () => Request('connect'),    s.css({marginRight: '1rem', fontSize: '3rem'})),
        button('disconnect (ctrl-d)', () => Request('disconnect'), s.css({marginRight: '1rem', fontSize: '3rem'})),
        button('revert (ctrl-r)',     () => Request('revert'),     s.css({marginRight: '1rem', fontSize: '3rem'})),
      )
    )
  }

  const slides = [
    slide(
      div(C.LH, C.Title,
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
      div(C.LH, C.Subtitle, 'Dan Rosén'),
      div(C.LH, C.Subtitle, 'Språkbanken, University of Gothenburg'),
      div(C.LH, C.Subtitle, 'Elena Volodina, Julia Prentice, Mats Wirén, '),
      div(C.LH, C.Subtitle, 'Gunlög Sundberg, Beata Megyesi, Lena Granstedt'),
      // div(C.LH, C.Subtitle, `Malin Ahlberg, Carl-Johan Schenström, Maria Öhrman, Johan Roxendal, Anne Schumacher`),
      div(C.LH,
        tag('img', s.attrs({src: 'talk/hws/logo_gu.png'}), s.css({padding: '3rem', height: '29rem'})),
        tag('img', s.attrs({src: 'talk/hws/logo_sb.jpg'}), s.css({padding: '5rem', height: '25rem'}), s.css({float: 'right'})),
      )
    ),
    slide(
      div(C.LH, C.Header, 'Observation from one early pre-pilot'),
      div(C.LH, C.Bullet, 'When annotating the target hypothesis needs to be constructed'),
      div(C.LH, C.Bullet, 'An annotation tool should then aid to write this normalized text'),
      div(C.LH, C.Bullet, 'Then this text could and thus probably should be stored with the corpus'),
    ),
    slide(
      div(C.LH, C.Header, 'Example running sentence'),
      div(C.LH, C.Bullet, 'Examples here high light lotsof futures')
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
          div(C.LH, C.Header, 'Idea: Annotate the tokens directly'),
          div(C.LH, C.Bullet, 'Examples here high light lotsof futures'),
          table(s.css({borderSpacing: '3rem', fontSize: '5rem'}),
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
            div(C.LH, C.Bullet, "doesn't work, cannot satisfiably express:"),
            div(C.LH, C.Underbullet, "token merging ", tags.i("(light)")),
            div(C.LH, C.Underbullet, "token splitting ", tags.i("(of)")),
            div(C.LH, C.Underbullet, "token movement ", tags.i("(here)")),
          ))
        )
      )
    })(),

    slide_on(
      'solved',
      div(C.LH, C.Header, 'Idea 2: this is a parallel corpus'),
      tag('center',
        div(C.InlineBlock, ViewGraph()),
      ),
      oneslide(div(
        div(C.LH, C.Bullet, "works, can satisfiably express:"),
        div(C.LH, C.Underbullet, "token merging ", tags.i("(highlight)")),
        div(C.LH, C.Underbullet, "token splitting ", tags.i("(lots of)")),
        div(C.LH, C.Underbullet, "token movement ", tags.i("(here)")),
      )),
      oneslide(div(
        div(C.LH, C.Bullet, "how do we make an editor for this?"),
        div(C.LH, C.Underbullet, '"just" calculate a diff'),
        div(C.LH, C.Underbullet, "- too many disambiguities around word movement"),
        div(C.LH, C.Underbullet, '- need some way to manually fix errors anyway'),
      )),
      pause(div(
        div(C.LH, C.Bullet, "how do we make an editor for this?"),
        div(C.LH, C.Underbullet, "text area with impaired operations?"),
        div(C.LH, C.Underbullet, "disable copy paste etc "),
        div(C.LH, C.Underbullet, "restrict word boundary fiddling"),
      ))
    ),

    slide_on(
      'examplesHere',
      div(C.LH, C.Header, 'Demo of editor prototype'),
      ViewEditor()
    ),

    slide_on(
      'dont_dare',
      div(C.LH, C.Header, 'Token movement'),
      ViewEditor()
    ),

    slide_on(
      'dont_dare',
      div(C.LH, C.Header, 'Internal representation'),
      ViewEditor(),
      tag('pre',
        s.css({
          position: 'absolute',
          left: '50rem',
          top: '10rem',
          width: '120rem',
          height: '80rem',
          border: '1rem #ccc solid',
          padding: '1rem',
          background: 'white',
          zIndex: '1000',
          fontSize: '3.0rem'
        }),
        (function ({source, target, edges}: G.Graph): string {
          return stringify({
            source: source.map(x => ({id:x.id, text:x.text})),
            target: target.map(x => ({id:x.id, text:x.text})),
            edges: Utils.record_traverse(edges, x => ({ids:x.ids, labels:x.labels}))
          })
        })(Model.current(store).get().graph.now)
      )
    ),

    slide_on(
      'dont_dare',
      div(C.LH, C.Header, 'Derived annotations'),
      ViewEditor(),
      tag('pre',
        s.css({
          position: 'absolute',
          left: '50rem',
          top: '10rem',
          width: '120rem',
          height: '80rem',
          border: '1rem #ccc solid',
          padding: '1rem',
          background: 'white',
          zIndex: '1000',
          fontSize: '3.0rem'
        }),
        (function (): string {
          const d = Model.state_diffs(store.get())
          return stringify(d.rich_diff.slice(0, 3))
        })()
      )
    ),

    slide(
      div(C.LH, C.Header, 'Export'),
      div(C.LH, C.Bullet, 'Extensions of ConLL for parallel corpora'),
      div(C.LH, C.Bullet, 'XML format for parallel corpora'),
    ),

    slide(
      div(C.LH, C.Header, 'Limitations: token centric'),
      div(C.LH, C.Bullet, 'Cannot label morphemes: instead label the token'),
      div(C.LH, C.Bullet, 'Phrases: no immediate way to label a range'),
    ),

    slide_on(
      'together_apart',
      div(C.LH, C.Header, 'Limitations: labelling overlapping errors'),
      ViewEditor()
    ),

    slide_on(
      'together_aparto',
      div(C.LH, C.Header, 'Limitations: labelling overlapping errors'),
      ViewEditor()
    ),

    slide(
      div(C.LH, C.Header, 'Addressing the limitations'),
      div(C.LH, C.Bullet, 'Several layers of changes'),
      div(C.LH, C.Bullet, 'Add secondary edges'),
      div(C.LH, C.Bullet, 'Multiple aligments per component'),
      pause(
        div(
          div(C.LH, C.Bullet, 'Always a balance:'),
          div(C.LH, C.Underbullet, "Data complexity vs expressivity"),
          div(C.LH, C.Underbullet, 'Time to annotate (and how to search in the corpus)'),
          div(C.LH, C.Underbullet, 'Possibility of visualising it in a user interface'),
        )
      )
    ),


    slide(
      div(C.LH, C.Header, 'Conclusions'),
      div(C.LH, C.Bullet, 'Hypothesis: parallel corpus is a good representation for a learner corpus'),
      div(C.LH, C.Bullet, 'The edges in the graph are a natural place to put labels'),
      // div(C.LH, C.Bullet, 'Corpus can be constructed with an augmented an off-the-shelf text editor'),
      div(C.LH, C.Bullet, 'Many design decisions about labelling'),
      div(css_hide(),
        div(C.LH, C.Bullet, 'Hypothesis: we have a good compromise between simplicity and expressivity'),
        div(css_hide(),
          div(C.LH, C.Bullet, 'Free libre open source software: MIT-license, bring-your-own-taxonomy ',
          tag('center', pre(C.LH, 'https://github.com/spraakbanken/swell-editor'))),
        )
      )
    ),
  ]

  return Positions.posid('root', store.at('positions'), div(
    s.css({height: '100%', width: '100%', overflow: 'hidden'}),
    ...slides,
    s.on('click')((e: MouseEvent) => {
      Request({kind: 'select_index', index: null})
    }),
    s.on('dragend')(() => {
      console.log('dragend from root div')
      const {drag_start, drag_over, drag_type} = Model.current(store).get().drag_state
      store.transaction(() => {
        if (drag_type == 'rearrange' && drag_start && drag_over) {
          Request({
            kind: 'rearrange',
            begin: drag_start,
            end: drag_start,
            dest: drag_over
          })
        }
        Model.current(store).at('drag_state').set({})
      })
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
}
