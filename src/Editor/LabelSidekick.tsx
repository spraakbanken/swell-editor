import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'
import {style} from 'typestyle'
import * as csstips from 'csstips'

import {Graph} from '../Graph'
import * as G from '../Graph'
import * as Utils from '../Utils'

import {VNode} from '../ReactUtils'
import * as ReactUtils from '../ReactUtils'
import {Close, Button, showhide} from '../ReactUtils'

import {State} from './Model'
import * as Model from './Model'
import {DropZone} from './DropZone'
import * as CM from './CodeMirror'
import {config} from './Config'

export function LabelSidekick({store, onBlur}: {store: Store<State>; onBlur: () => void}) {
  const advance = Model.make_history_advance_function(store)
  const graph = store.at('graph').at('now')
  const selected = Object.keys(store.get().selected)
  if (selected.length > 0) {
    const edges = G.token_ids_to_edges(graph.get(), selected)
    const edge_ids = edges.map(e => e.id)
    const labels = Utils.uniq(Utils.flatMap(edges, e => e.labels))
    function pop(l: string) {
      advance(() =>
        edge_ids.forEach(id =>
          graph.modify(g => G.modify_labels(g, id, ls => ls.filter(x => x !== l)))
        )
      )
    }
    function push(l: string) {
      advance(() =>
        edge_ids.forEach(id => graph.modify(g => G.modify_labels(g, id, ls => [...ls, l])))
      )
    }
    return (
      <div
        className="left tall sidekick box"
        onClick={e => console.log('stop') || e.stopPropagation()}>
        <div>
          {Model.onSelectedActions.map(action =>
            Button(action, '', () =>
              advance(() => graph.modify(g => Model.act_on_selected[action](g, selected)))
            )
          )}
          {Button('deselect', '', () => Model.deselect(store))}
        </div>
        <input
          ref={e => e && e.focus()}
          placeholder="Enter label..."
          onKeyDown={e => {
            const t = e.target as HTMLInputElement
            if (e.key === 'Enter' || e.key === ' ') {
              push(t.value)
              t.value = ''
            }
            if (e.key === 'Escape') {
              Model.deselect(store)
              onBlur()
            }
            if (e.key === 'Backspace' && t.value == '' && labels.length > 0) {
              pop(labels[labels.length - 1])
            }
          }}
        />
        <ul>
          {labels.map((lbl, i) => (
            <li key={i}>
              <Close title="remove label" onClick={() => pop(lbl)} /> {lbl}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return null
}
