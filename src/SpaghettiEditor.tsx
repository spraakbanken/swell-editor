import * as R from 'ramda'
import * as React from 'react'
import {Store} from 'reactive-lens'
import {style, types, getStyles} from 'typestyle'
import * as typestyle from 'typestyle'
import * as csstips from 'csstips'

import * as D from './Diff'
import * as G from './Graph'
import * as L from './LadderView'
import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'

import * as C from './Compact'

import {VNode} from './LadderView'

// import "codemirror/lib/codemirror.css"
import 'lato-font/css/lato-font.min.css'
import 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'

export interface State {
  readonly source: string
  readonly target: string
  readonly show_g: boolean
  readonly show_d: boolean
}

export const init: State = {
  // source: 'preamble apa:Ort bepacepa xu depa flepa:Comp florp^preamble',
  // target: 'apa bpea cpea dpeaflpae xlbabulr postscriptum^preamble woop^',
  source: '',
  target: '',
  show_g: false,
  show_d: false,
}

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  global.G = G
  store.storage_connect('swell-spaghetti')
  store.at('source').modify(s => s || '')
  store.at('target').modify(s => s || '')

  return () => View(store)
}

export const Textarea = ({
  store,
  ...props
}: {store: Store<string>} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    value={store.get()}
    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => store.set(e.target.value)}
  />
)

export const Input = (store: Store<string>, tabIndex?: number) => (
  <input
    value={store.get()}
    tabIndex={tabIndex}
    onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.set(e.target.value)}
  />
)

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

const checklink = (store: Store<boolean>, f = 'show json', t = 'hide json') => (
  <a href="" onClick={e => (store.modify(x => !x), e.preventDefault())}>
    {store.get() ? t : f}
  </a>
)

const display_if = (b: boolean) => ({
  display: b ? 'inherit' : 'none',
})

const topStyle = style({
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
    '& pre': {
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

type side = 'source' | 'target'
const sides = ['source' as side, 'target' as side]
const op = (x: side) => (x == 'source' ? 'target' : 'source')

export function View(store: Store<State>): VNode {
  const state = store.get()
  const source = store.at('source')
  const target = store.at('target')
  const s = C.parse(state.source)
  const t = C.parse(state.target)
  const g = C.units_to_graph(s, t)
  const d = RD.enrichen(g, G.calculate_diff(g))
  return (
    <div className={topStyle}>
      <div className="main" style={{minHeight: '10em'}}>
        {L.Ladder(g)}
      </div>
      {sides.map((side, i) => (
        <React.Fragment key={i}>
          {Button('\u2b1a', 'clear', () => store.at(side).set(''))}
          {Button(i ? '\u21e1' : '\u21e3', 'copy to ' + side, () =>
            store.at(op(side)).set(state[side])
          )}
          <Textarea
            store={store.at(side)}
            tabIndex={(i + 1) as number}
            rows={state[side].split('\n').length}
            style={{resize: 'vertical'}}
            placeholder={'Enter ' + side + ' text...'}
          />
        </React.Fragment>
      ))}
      <div className="main" style={{opacity: '0.85', justifySelf: 'end'} as any}>
        graph: {checklink(store.at('show_g'))} diff: {checklink(store.at('show_d'))}
      </div>
      <div className="main">
        {store.get().show_d && <pre>diff = {Utils.show(d)}</pre>}
        {store.get().show_g && <pre>graph = {Utils.show(g)}</pre>}
      </div>
      <div className="main TopPad">
        <em>Examples:</em>
      </div>
      {examples.map((e, i) => (
        <React.Fragment key={i}>
          {!e.target ? (
            <div />
          ) : (
            Button(
              '\u21eb',
              'see example analysis',
              () => (source.set(e.source), target.set(e.target))
            )
          )}
          {Button('\u21ea', 'load example', () => (source.set(e.source), target.set(e.source)))}
          <span>{e.source}</span>
        </React.Fragment>
      ))}
    </div>
  )
}
