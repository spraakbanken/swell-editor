import * as React from 'react'
import {Store} from 'reactive-lens'
import {GraphState} from './Model'
import * as G from './Graph'
import * as R from './RichDiff'
import * as T from './Token'

type VNode = React.ReactElement<{}>

declare const require: (json_file: string) => any
const files: Record<string, { graphs: Record<string, GraphState> }> = {
  'beata': require('./data/beata/state.json'),
  'elena': require('./data/elena/state.json'),
  'gunlög': require('./data/gunlög/state.json'),
  'julia': require('./data/julia/state.json'),
  'lena': require('./data/lena/state.json'),
  'mats': require('./data/mats/state.json'),
}
export interface State {
  readonly annotator: string
  readonly text: string
}

export const init: State = {
  annotator: 'gunlög',
  text: 'text2',
}

export const json = (s: any) => JSON.stringify(s, undefined, 2)

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  // store.on(x => console.log(json(x)))
  store.storage_connect('swell-viz')
  return () => View(store)
}

export function View(store: Store<State>): VNode {
  const state = store.get()
  let g: null | G.Graph = null
  let msg: null | string = null
  try {
    g = files[state.annotator].graphs[state.text].graph.now
  } catch (e) {
    msg = e.toString()
  }
  const edited: {annotator: string, text: string, labelled: number}[] = []
  Object.entries(files).forEach(([annotator, {graphs}]) => {
    Object.entries(graphs).forEach(([text, {graph: {now: {edges}}}]) => {
      const labelled = Object.values(edges).filter((e: G.Edge) => e.labels.length > 0).length
      if (labelled > 0) {
        edited.push({annotator, text, labelled})
      }
    })
  })
  edited.sort((y, x) => x.labelled - y.labelled)
  return (
    <div>
      <h1>
        <Input store={store.at('annotator')}/>
        <Input store={store.at('text')}/>
      </h1>
      <table><tbody>
        { edited.map((e, i) => <tr key={i}>
            <td>{e.annotator}</td>
            <td>{e.text}</td>
            <td>{e.labelled}</td>
            </tr>)  }
      </tbody></table>
      {g && <table><tbody>
        {R.enrichen(g, G.calculate_diff(g)).map((d, i) => {
          switch (d.edit) {
            case 'Edited':
              return <tr key={i}>
                <td>{T.text(d.source)}</td>
                <td>{T.text(d.target)}</td>
                <td>{g && g.edges[d.id].labels.join(', ')}</td>
              </tr>
            case 'Dragged':
              return <tr key={i} style={{background: '#affa88'}}>
                <td>{d.source.text}</td>
                <td></td>
                <td>{g && g.edges[d.id].labels.join(', ')}</td>
              </tr>
            case 'Dropped':
              return <tr key={i} style={{background: '#faaf88'}}>
                <td></td>
                <td>{d.target.text}</td>
                <td>{g && g.edges[d.id].labels.join(', ')}</td>
              </tr>
          }
        })}
        </tbody></table>
      }
      {msg && <pre>{msg}</pre>}
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

