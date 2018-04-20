import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'

import {Graph} from './Graph'
import * as G from './Graph'
import * as Utils from './Utils'
import * as record from './record'

import {VNode} from './ReactUtils'

import 'codemirror/lib/codemirror.css'
import 'lato-font/css/lato-font.min.css'
import 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'

import * as bowser from 'bowser'

import {State} from './Editor/Model'
import * as Model from './Editor/Model'
import * as CM from './Editor/CodeMirror'
import {View} from './Editor/View'

export const init = Model.init

export function App(store: Store<Model.State>): () => VNode {
  const global = window as any

  if (bowser.name != 'Chrome') {
    store.at('errors').update({
      [`You are using an unsupported browser (${bowser.name}), only Chrome is supported.`]: true,
    })
  }

  global.store = store
  global.reset = () => store.set(init)
  global.G = G
  global.Utils = Utils
  global.stress = () => stress(store)
  store.at('generation').modify(i => i + 1)
  store
    .at('graph')
    .at('now')
    .storage_connect('swell-spaghetti-6')

  store
    .at('graph')
    .at('now')
    .ondiff(Model.check_invariant(store))

  Model.check_invariant(store)(store.get().graph.now)

  function trigger_invariant_error() {
    window.setTimeout(() => {
      const g0 = G.init('apa')
      const g = {...g0, edges: {oops: g0.edges['e-s0-t0']}}
      store.update({graph: Undo.init(g)})
    }, 1000)
  }

  store.ondiff(state => {
    const restricted = Model.deselect_removed_ids(state.graph.now, state.selected)
    restricted && store.update(restricted)
  })

  const cms = record.create(G.sides, side => CM.GraphEditingCM(store, side))
  return () => View(store, cms)
}

function stress(store: Store<State>) {
  const source = Utils.range(100).join(' ')
  // const source = Utils.range(100).map(() => Utils.range(25).join(' ')).join(' .\n')
  store.set({
    ...init,
    graph: Undo.init(G.init(source, false)),
  })
  function go(i: number) {
    if (i === 0) {
      return
    }
    window.setTimeout(() => {
      const g = G.modify(store.get().graph.now, 10, 10, i + ' ')
      store.at('graph').modify(Undo.advance_to(g))
      go(i - 1)
    }, 1)
  }
  go(10)
}