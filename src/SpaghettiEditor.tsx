import * as R from 'ramda'
import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'
import {style, types, getStyles} from 'typestyle'
import * as typestyle from 'typestyle'
import * as csstips from 'csstips'

import {DropZone} from './DropZone'

import * as D from './Diff'
import {Graph} from './Graph'
import * as G from './Graph'
import * as L from './LadderView'
import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'

import * as C from './Compact'

import {VNode} from './LadderView'

import {GraphEditingCM} from './GraphEditingCM'

import 'codemirror/lib/codemirror.css'
import 'lato-font/css/lato-font.min.css'
import 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'

export interface State {
  readonly graph: Undo<Graph>
}

export const init: State = {
  graph: Undo.init(G.init('')),
}

export function Textarea({
  store,
  ...props
}: {store: Store<string>} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      value={store.get()}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => store.set(e.target.value)}
    />
  )
}

export function Input(store: Store<string>, tabIndex?: number) {
  return (
    <input
      value={store.get()}
      tabIndex={tabIndex}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.set(e.target.value)}
    />
  )
}

interface ex {
  source: string
  target: string
}
const ex = (source: string, target: string): ex => ({source, target})

const examples: ex[] = `
Their was a problem yesteray . // There was a problem yesterday .

The team that hits the most runs get ice cream . // The team that hits the most runs gets ice cream .

Blue birds have blue and pink feathers . // Bluebirds have blue and pink feathers .

I don't know his lives . // I don't know where he~his lives .

He get to cleaned his son . // He got his~his son~his~son to clean the~ room~ .

We wrote down the number . // We wrote the number down~down .

English is my second language with many difficulties that I faced them in
twolast years I moved in United States .
//

In my homeland we didn’t write as structural as here .
//

During the semester , I frustrated many times with my grades and thought I
couldn’t go up any more , because there was a very big difference between
ESOL 40 with other language people .
//

Sometimes , I recognized about why I’m here and studying with this crazy
language that I couldn’t be good at all ​ .
//

In contrast I faced with my beliefs and challenges that helped me to focus
on my mind to write an essay with these difficult subjectswith no experience
as narrative essay , business essay and all argumentative essays .
//

It makes me proud of myself to write something I never thought I can do
in end of this semester and improve my writing skills , have learned my
challenges and discovered strategies to overcome the challenges .
//
`
  .trim()
  .split(/\n\n+/gm)
  .map(line => ex.apply({}, line.split('//').map(side => side.trim())))

const Button = (label: string, title: string, on: () => void) => (
  <button title={title} onClick={on} style={{cursor: 'pointer'}}>
    {label}
  </button>
)

const topStyle = style({
  ...Utils.debugName('topStyle'),
  fontFamily: 'lato, sans-serif, DejaVu Sans',
  color: '#222',
  display: 'grid',
  gridAutoRows: '',
  gridTemplateColumns: 'min-content min-content [main] 1fr',
  gridGap: '0.8em 0.4em',
  paddingTop: '1em',
  paddingBottom: '4em',
  maxWidth: '700px',
  margin: '0 auto',
  alignItems: 'start',

  $nest: {
    '& .CodeMirror': {
      border: '1px solid #ddd',
      height: '300px',
      minWidth: '250px',
      lineHeight: '1.5em',
      fontFamily: "'Lato', sans-serif",
    },

    '& > .main': {
      gridColumnStart: 'main',
    },
    '& > *': {
      // Non-grid fallback
      display: 'block',
    },
    '& > button': {
      marginTop: '-0.125em',
      // Non-grid fallback
      display: 'inline-block',
    },
    '& pre.pre-box': {
      fontSize: '0.85em',
      background: 'hsl(0,0%,96%)',
      borderTop: '2px hsl(220,65%,65%) solid',
      boxShadow: '2px 2px 3px 0px hsla(0,0%,0%,0.2)',
      borderRadius: '0px 0px 2px 2px',
      padding: '0.25em',
    },
    '& > .TopPad': {
      paddingTop: '4em',
    },
    '& path': {
      stroke: '#222',
    },
    '& input': {
      width: '100%',
      fontFamily: 'inherit',
      color: 'inherit',
    },
  },
})

export class If extends React.Component<
  {
    children: (b: boolean, set: (b?: any) => void) => React.ReactNode
    init?: boolean
  },
  {b: boolean}
> {
  constructor(p: any) {
    super(p)
    this.state = {b: p.init === undefined ? false : p.init}
  }
  render() {
    const b = this.state.b
    return this.props.children(b, next => this.setState({b: typeof next === 'boolean' ? next : !b}))
  }
}

function showhide(what: string, show: string | VNode, init = false) {
  return (
    <If init={init}>
      {(b, flip) => (
        <React.Fragment>
          <a
            style={{opacity: '0.85', justifySelf: 'end'} as any}
            className="main"
            href=""
            onClick={e => (e.preventDefault(), flip())}>
            {b ? 'hide' : 'show'} {what}
          </a>
          {b && (typeof show === 'string' ? <pre className="pre-box main">{show}</pre> : show)}
        </React.Fragment>
      )}
    </If>
  )
}

type side = 'source' | 'target'
const sides = ['source' as side, 'target' as side]
const op = (x: side) => (x == 'source' ? 'target' : 'source')

const ws_url = 'https://ws.spraakbanken.gu.se/ws/swell'

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  global.G = G
  global.Utils = Utils
  store
    .at('graph')
    .at('now')
    .storage_connect('swell-spaghetti-3')

  store
    .at('graph')
    .at('now')
    .ondiff(g => {
      const inv = G.check_invariant(g)
      if (inv !== 'ok') {
        Utils.stderr(inv)
      }
    })

  const cm_node = GraphEditingCM(store.at('graph'))

  return () => View(store, cm_node)
}

export function View(store: Store<State>, cm_node: VNode): VNode {
  const state = store.get()
  const history = store.at('graph')
  const graph = history.at('now')

  const units: Store<G.ST<string>> = store
    .at('graph')
    .at('now')
    .via(
      Lens.iso(
        g => G.with_st(C.graph_to_units(g), us => C.units_to_string(us)),
        state => {
          const s = C.parse(state.source)
          const t = C.parse(state.target)
          return C.units_to_graph(s, t)
        }
      )
    )

  // Utils.stdout(units.get())
  Utils.stdout(graph.get().target)

  // const source = now.at('source')
  // const target = now.at('target')

  const g = graph.get()
  const d = RD.enrichen(g, G.calculate_diff(g))

  function advance(k: () => void) {
    store.transaction(() => {
      history.modify(Undo.advance)
      k()
    })
  }

  return (
    <DropZone webserviceURL={ws_url} onDrop={g => advance(() => graph.set(g))}>
      <div className={topStyle}>
        <div className="main" style={{minHeight: '10em'}}>
          <L.LadderComponent graph={graph.get()} onDrop={g => advance(() => graph.set(g))} />
        </div>
        {sides.map((side, i) => (
          <React.Fragment key={i}>
            {Button('\u2b1a', 'clear', () => advance(() => units.at(side).set('')))}
            {Button(i ? '\u21e1' : '\u21e3', 'copy to ' + side, () =>
              advance(() => units.at(op(side)).set(units.get()[side]))
            )}
            <Textarea
              store={units.at(side)}
              tabIndex={(i + 1) as number}
              rows={units.get()[side].split('\n').length}
              style={{resize: 'vertical'}}
              placeholder={'Enter ' + side + ' text...'}
            />
          </React.Fragment>
        ))}
        <div className="main">{cm_node}</div>
        {showhide('graph json', Utils.show(g))}
        {showhide('diff json', Utils.show(d))}
        {links(graph.get())}
        <div className="main TopPad">
          <em>Examples:</em>
        </div>
        {examples.map((e, i) => (
          <React.Fragment key={i}>
            {!e.target ? (
              <div />
            ) : (
              Button('\u21eb', 'see example analysis', () =>
                advance(() => units.set({source: e.source, target: e.target}))
              )
            )}
            {Button('\u21ea', 'load example', () =>
              advance(() => units.set({source: e.source, target: e.source}))
            )}
            <span>{e.source}</span>
          </React.Fragment>
        ))}
      </div>
    </DropZone>
  )
}

function links(g: Graph) {
  const stu = C.graph_to_units(g)
  const esc = (s: string) =>
    encodeURIComponent(s)
      .replace('(', '%28')
      .replace(')', '%29')
  const escaped = G.with_st(stu, units => esc(C.units_to_string(units, '_')))
  const st = escaped.source + '//' + escaped.target
  const url = `${ws_url}/png?${st}`
  const md = `![](${url})`
  return (
    <>
      {showhide(
        'compact form',
        <pre className={'pre-box main '} style={{whiteSpace: 'pre-wrap', overflowX: 'hidden'}}>
          {`${C.units_to_string(stu.source)} // ${C.units_to_string(stu.target)}`}
        </pre>
      )}
      {showhide(
        'copy link',
        <pre
          className={'pre-box main ' + L.Unselectable}
          style={{whiteSpace: 'pre-wrap', overflowX: 'hidden'}}
          draggable={true}
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', md)
          }}>
          {md}
        </pre>,
        true
      )}
    </>
  )
}
