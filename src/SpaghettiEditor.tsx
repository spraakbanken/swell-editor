import * as R from 'ramda'
import * as React from 'react'
import {Store} from 'reactive-lens'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'

import * as D from './Diff'
import * as G from './Graph'
import * as L from './LadderView'
import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'

import * as C from './Compact'

import {VNode} from './LadderView'

export interface State {
  readonly source: string
  readonly target: string
}

export const init: State = {
  source: 'preamble apa:Ort bepacepa xu depa flepa:Comp florp^preamble',
  target: 'apa bpea cpea dpeaflpae xlbabulr postscriptum^preamble woop^',
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
    style={{width: '100%'}}
    onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.set(e.target.value)}
  />
)

export function View(store: Store<State>): VNode {
  const state = store.get()
  const s = C.test_parse(state.source)
  const t = C.test_parse(state.target)
  const g = C.units_to_graph(s, t)
  return (
    <div>
      <div>{L.Ladder(g)}</div>
      <div>{Input(store.at('source'))}</div>
      <div>{Input(store.at('target'))}</div>
    </div>
  )
}
