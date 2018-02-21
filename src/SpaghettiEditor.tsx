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
}

export const init: State = {
  // source: 'preamble apa:Ort bepacepa xu depa flepa:Comp florp^preamble',
  // target: 'apa bpea cpea dpeaflpae xlbabulr postscriptum^preamble woop^',
  source: '',
  target: '',
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

export const Input = (store: Store<string>) => (
  <input
    value={store.get()}
    onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.set(e.target.value)}
  />
)

const ex = (s: string, t: string) => ({s, t})

const examples = `
Their was a problem yesteray . // There was a problem yesterday .

The team that hits the most runs get ice cream . // The team that hits the most runs gets ice cream .

Blue birds have blue and pink feathers . // Bluebirds have blue and pink feathers .

I don't know his lives . // I don't know where he~his lives .

He get to cleaned his son . // He got his~his son~his~son to clean the~ room~ .

We wrote down the number . // We wrote the number down~down .
`
  .trim()
  .split(/\n+/gm)
  .map(line => ex.apply({}, line.split('//').map(side => side.trim())))

const Button = (label: string, title: string, on: () => void) => (
  <button title={title} onClick={on} style={{cursor: 'pointer'}}>
    {label}
  </button>
)

const topStyle = style({
  fontFamily: 'lato, sans-serif, DejaVu Sans',
  color: '#222',
  display: 'grid',
  gridAutoRows: '',
  gridTemplateColumns: 'min-content min-content [main] 1fr',
  gridGap: '0.2em 0.4em',
  paddingTop: '1em',
  paddingBottom: '4em',
  maxWidth: '900px',
  margin: '0 auto',
  alignItems: 'center',

  $nest: {
    '& > .main': {
      gridColumnStart: 'main',
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

export function View(store: Store<State>): VNode {
  const state = store.get()
  const source = store.at('source')
  const target = store.at('target')
  const s = C.test_parse(state.source)
  const t = C.test_parse(state.target)
  const g = C.units_to_graph(s, t)
  return (
    <div className={topStyle}>
      <div className="main">{L.Ladder(g)}</div>
      {Button('\u2b1a', 'clear', () => source.set(''))}
      {Button('\u21e3', 'copy to target', () => target.set(state.source))}
      {Input(source)}
      {Button('\u2b1a', 'clear', () => target.set(''))}
      {Button('\u21e1', 'copy to source', () => target.set(state.source))}
      {Input(target)}
      <div className="main TopPad">
        <em>Examples:</em>
      </div>
      {examples.map((e, i) => (
        <React.Fragment key={i}>
          {Button('\u21eb', 'see example analysis', () => (source.set(e.s), target.set(e.t)))}
          {Button('\u21ea', 'load example', () => (source.set(e.s), target.set(e.s)))}
          <span>{e.s}</span>
        </React.Fragment>
      ))}
    </div>
  )
}
