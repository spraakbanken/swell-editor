import * as React from 'react'
import {Store} from 'reactive-lens'
import * as G from '../Graph'
import * as Pilot from './PilotData'
import * as Utils from '../Utils'
import {GraphSegments} from './PilotData'
import * as GV from '../GraphView'

import {VNode} from '../ReactUtils'
import * as ReactUtils from '../ReactUtils'

export interface State {
  readonly graph_segments: GraphSegments
  readonly scroll: null | {
    readonly text: string
    readonly begin: number
  }
}

export const init: State = {
  graph_segments: [],
  scroll: null,
}

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  global.G = G
  global.Pilot = Pilot
  // store.on(x => console.log(json(x)))
  store.storage_connect('swell-vis')
  store.at('scroll').ondiff(scroll => {
    const {graph_segments} = store.get()
    let text
    if (scroll && graph_segments[0] && ({text} = graph_segments[0])) {
      if (text != scroll.text) {
        store.update({graph_segments: Pilot.GraphSegments(scroll.text)})
      }
    }
  })
  return () => View(store)
}

export function View(store: Store<State>): VNode {
  const state = store.get()
  return (
    <div
      className={ReactUtils.clean_ul}
      style={{maxWidth: '50em', margin: 'auto', padding: '0 0.625em', fontSize: '16px'}}>
      <div style={{margin: '1.25em 0'}}>
        {Object.keys(Pilot.ByText)
          .sort()
          .map(text => (
            <button
              key={text}
              style={{marginRight: '0.625em'}}
              onMouseDown={() => store.update({graph_segments: Pilot.GraphSegments(text)})}>
              {text}
            </button>
          ))}
      </div>
      {Utils.zipWithPrevious(state.graph_segments, (m, m_prev, i) => {
        const sep = !m_prev || m_prev.subspan.source.begin != m.subspan.source.begin
        return (
          <React.Fragment key={m.annotator + m.subspan.source.begin}>
            {sep && (
              <div
                style={{
                  borderTop: '0.125em #ccc solid',
                  marginBottom: '2.5em',
                }}
                ref={d =>
                  d &&
                  state.scroll &&
                  state.scroll.text == m.text &&
                  m.subspan.source.begin == state.scroll.begin &&
                  (d.scrollIntoView(), store.update({scroll: null}))
                }>
                <span style={{fontSize: '0.85em'}}>
                  {m.text}
                  {', '}
                  {m.subspan.source.begin}-{m.subspan.source.end}
                </span>
              </div>
            )}
            <ul
              style={{
                display: 'flex',
                marginBottom: '1.875em',
              }}>
              <li style={{flex: 1}}>{Utils.capitalize_head(m.annotator)}</li>
              <li style={{flex: 6}}>{GV.graphView(m.graph)}</li>
            </ul>
          </React.Fragment>
        )
      })}
    </div>
  )
}

type InputAttrs = React.InputHTMLAttributes<HTMLInputElement>

function Input({store, ...props}: {store: Store<string>} & InputAttrs) {
  return <input {...props} value={store.get()} onChange={e => store.set(e.target.value)} />
}

function ValueInput({store, ...props}: {store: Store<number>} & InputAttrs) {
  return <input {...props} value={store.get()} onChange={e => store.set(e.target.valueAsNumber)} />
}
