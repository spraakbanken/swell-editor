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
const { div, span, table, tbody, tr, td, th, option } = tags
const { button, input, select } = s
import { log } from "./dev"

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

    slide(
      div(C.LH, C.Header, 'Interdisciplinary research'),
      div(C.LH, C.Bullet, 'Researchers in SLA (Second-Language Acquisition)'),
      div(C.LH, C.Bullet, 'Researchers in NLP'),
      pause(
        div(C.LH, C.Bullet, 'System developer with formal verification background'),
      )
    ),

    slide(
      div(C.LH, C.Header, 'Anonymization'),
      oneslide(div(
        div(C.LH, C.Bullet, 'My uncle visited Tehran in 1996'),
        div(C.LH, C.Bullet, tag('code', '_1'), ' visited ', tag('code', '_2'), ' in ', tag('code', '_3')),
      )),
      oneslide(
        div(C.LH,
          div(C.LH, C.Bullet, 'My uncle visited Tehran in 1996'),
          div(C.LH, C.Bullet, tag('code', '_1'), ' visited ', tag('code', '_2'), ' in ', tag('code', '_3')),
          div(C.LH, C.Bullet, tags.i('But the data needs to be searchable')),
          div(C.LH, C.Bullet, tags.i('But the data needs to be taggable')),
          div(C.LH, C.Bullet, tags.i("Use placeholder names from a name supply (Alice, Bob, Paris)")),
          div(C.LH, C.Bullet, tags.i("But from which culture? This is very sensitive")),
        )
      ),
      oneslide(div(
        div(C.LH, C.Bullet, 'Problem: viewing the corpus as something of these types:'),
        div(C.LH, C.Bullet, tag('code', 'corpus: string')),
        div(C.LH, C.Bullet, tag('code', 'corpus: Array<string>')),
      )),
      pause(div(
        // div(C.LH, C.Bullet, 'Solution:'),
        div(C.LH, C.Bullet, tag('code', 'corpus: Array<string | AnonymizationRecord>')),
        tags.pre(s.css({padding: '0 6rem'}), `interface AnonymizationRecord {
  unique_number: int,
  kind:    unknown | person | place | event | ...
  gender:  unknown | m | f | ...
  culture: unknown | L1 | L2 | ...
}`),
      )),
      pause(
        div(C.LH, C.Bullet, 'Establishes a common abstract ground')
      ),
      div(css_hide(),
        div(C.LH, C.Bullet, 'What is needed for the different linearizations?'),
        div(C.LH, C.Bullet, 'How difficult are they to annotate manually? Automatically?',
          tag('code', 'PRE REC', css_hide(),
            s.css({
              border: '1rem solid red',
              padding: '1rem 2rem',
              marginLeft: '4rem',
              borderRadius: '4rem'
            })
          )
        )
      )
    ),

    slide(
      div(C.LH, C.Header, 'Anonymization'),
      div(C.LH, C.Bullet, tag('code', 'corpus: Array<string | AnonymizationRecord>')),
      div(C.LH, C.Bullet, 'Researchers might suggest: "Just" use a NER tagger, DNN, ML, SAT-solver...'),
      div(C.LH, C.Bullet, 'Propensity to reach for tools before a manual annotation approach is devised'),
      pause(div(
        div(C.LH, C.Underbullet, '- It might not work at all'),
        div(C.LH, C.Underbullet, '- It might be too slow / clunky / anything'),
        div(C.LH, C.Underbullet, '- Need some way to manually fix errors anyway'),
      )),
      div(C.LH, C.Bullet, 'NLP researchers talking about automated tools confuse SLA researchers',
        css_hide(),
        span('big problem!', css_hide(),
          s.css({
            border: '1rem solid red',
            padding: '1rem 2rem',
            marginLeft: '6rem',
            borderRadius: '4rem',
            float: 'right'
          })
        )
      )
    ),

    slide(
      div(C.LH, C.Header, 'Request: data in unique identifiers'),
      div(C.LH, C.Bullet, "A database entry of a learner:"),
      div(C.LH, C.Underbullet, "L1: French"),
      div(C.LH, C.Underbullet, "Age: 38"),
      div(C.LH, C.Underbullet, "Time in Sweden: 29 weeks"),
      div(C.LH, C.Underbullet, "Unique identifier: ", tag('code', "2681")),
      div(C.LH, C.Bullet, "Suggestion: Unique identifier: ", tag('code', 'Fr38y29w')),
      pause(div(
        div(C.LH, C.Bullet, "+ can see learner metadata at a glance"),
        div(C.LH, C.Bullet, "- leads to disambiguties"),
        div(C.LH, C.Bullet, "- ", tag('code', 'shorten: Learner -> string'), ' is already O(1)'),
      ))
    ),

    slide_on(
      'examplesHere',
      div(C.LH, C.Header, 'What is data in the UI?'),
      tag('center',
        ViewGraph()
      )
    ),

    slide_on(
      'sentences',
      div(C.LH, C.Header, '"Just" show the current sentence'),
      ViewEditor(),
    ),

    slide(
      div(C.LH, C.Header, 'Conclusions'),
      div(C.LH, C.Bullet, 'Parallel corpus is a good representation for diffs such as a learner corpus'),
      div(C.LH, C.Bullet, 'The edges in the graph are a natural place to put labels'),
      div(C.LH, C.Bullet, 'Corpus can be constructed with an augmented an off-the-shelf text editor'),
      div(css_hide(),
        div(C.LH, C.Bullet, 'Working across disciplines:'),
        div(C.LH, C.Underbullet, 'Hidden challenges in solving seemingly trivial UI'),
        div(C.LH, C.Underbullet, 'Truly easy matters are discussed as if they were challenges'),
        div(C.LH, C.Underbullet, "Developers have to dodge NLP researchers sledgehammer predispositions",
          span(", and non-CS researchers have to too", css_hide()),
        ),
        div(C.LH, C.Underbullet, css_hide(),
          'Abstract representation of data gives us a common language'
        ),
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
