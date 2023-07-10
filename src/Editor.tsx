import {Store, Undo} from 'reactive-lens'
import * as G from './Graph'
import * as Utils from './Utils'
import * as record from './record'

import {VNode} from './ReactUtils'

import 'codemirror/lib/codemirror.css'
import 'lato-font/css/lato-font.min.css'

import {State} from './Editor/Model'
import * as Model from './Editor/Model'
import * as CM from './Editor/CodeMirror'
import {View} from './Editor/View'
import {remote_doc} from './Doc/RemoteDoc'
import {config} from './Editor/Config'

export const init = Model.init

export function App(store: Store<Model.State>): () => VNode {
  const global = window as any

  global.store = store
  global.reset = (v0: string = '') => {
    store.set(init)
    Model.graphStore(store).set(G.init(v0))
  }
  global.G = G
  global.Utils = Utils
  global.stress = () => stress(store)
  store.at('generation').modify(i => i + 1)

  const update_rich_diff = () => {
    const rd = G.enrichen(Model.viewGraph(store), s => config.order_changing_labels[s])
    store.at('rich_diff').set(rd)
  }

  store
    .at('graph')
    .at('now')
    .ondiff(g => {
      Model.check_invariant(store)(g)
      const restricted = Model.deselect_removed_ids(store, store.get().selected)
      restricted && store.update(restricted)
      // Enrichen is expensive. Run once at every graph change and keep the result in state.
      if (store.at('automatic_rendering').get())
        update_rich_diff()
    })

  Store.location_connect(Model.locationStore(store))

  // Store graph in local storage unless there is a backend.
  // This facilitates development and playing around.
  // Using both backend and local storage is pointless and prone to bugs.
  store.at('backend').get() ||
    store
      .at('graph')
      .at('now')
      .storage_connect('swell-spaghetti-7')

  store.at('mode').ondiff(mode => {
    // Reset/detect pseudonyms when switching to anonymization mode.
    mode === Model.modes.anonymization && Model.initPseudonymizations(store)
    // Adjust UI to mode.
    store.at('show').update({
      target_text: mode == Model.modes.anonymization ? undefined : true,
      source_text: undefined,
    })
    // Mode affects the viewed graph, so refresh rich diff.
    update_rich_diff()
  })

  store.at('pseudonym_args').ondiff(() => update_rich_diff())

  {
    const state = store.get()
    const page = state.manual
    page && Model.setManualTo(store, page)

    if (state.start_mode) {
      // Inflate a shortname like "anon" to a real mode.
      Object.values(Model.modes)
        .filter(m => m.indexOf(state.start_mode!) === 0)
        .forEach(m => store.update({start_mode: m, mode: m}))
    }
  }

  const load = (url: string) => remote_doc(url, content => store.at('doc_node').set(content))
  store.at('doc').ondiff(url => (url ? load(url) : store.at('doc_node').set(undefined)))
  store.at('mode').ondiff(() => store.at('doc').set(undefined))
  store.at('selected').ondiff(s => record.size(s) && Model.setSubspanIncluding(store, []))

  Model.check_invariant(store)(store.get().graph.now)

  global.trigger_invariant_error = () => {
    window.setTimeout(() => {
      const g0 = G.init('apa')
      const g = {...g0, edges: {oops: g0.edges['e-s0-t0']}}
      store.update({graph: Undo.init(g)})
    }, 1000)
  }

  Model.initialBackendFetch(store, () => Model.savePeriodicallyToBackend(store))

  const allowWhitespace: CM.ChangeCheck = change =>
    change.type == 'editor' &&
    !/\S/.test([...(change.change.text || []), ...(change.change.removed || [])].join(''))

  const targetChangeCheck: CM.ChangeCheck = () => !Model.is_target_readonly(store.at('mode').get())

  // for transcription mode then change here to make the source code mirror not be readOnly
  const cms = record.create(G.sides, side =>
    CM.GraphEditingCM(
      store,
      side,
      !store.get().backend ? undefined : side == 'target' ? targetChangeCheck : allowWhitespace
    )
  )
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
