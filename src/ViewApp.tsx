import * as React from 'react'
import {Store} from 'reactive-lens'
import {GraphState} from './Model'
import * as G from './Graph'
import * as R from './RichDiff'
import * as T from './Token'
import {ClassNames, css} from './Classes'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'

type VNode = React.ReactElement<{}>

declare const require: (json_file: string) => any
const files: Record<string, {graphs: Record<string, GraphState>}> = {
  beata: require('./data/beata/state.json'),
  elena: require('./data/elena/state.json'),
  gunlög: require('./data/gunlög/state.json'),
  julia: require('./data/julia/state.json'),
  lena: require('./data/lena/state.json'),
  mats: require('./data/mats/state.json'),
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

export const Subscript = style({
  position: 'relative',
  bottom: '-0.5em',
  fontSize: '65%',
  paddingLeft: '1px',
})

const BorderCell = style(
  csstips.border('1px #777 solid'),
  {borderRadius: '20px'},
  {fontSize: '13px'},
  {background: 'white'},
  csstips.padding('4px', '4px'),
  csstips.horizontallySpaced('5px'),
  {
    $nest: {
      '& > span:not(:last-child)': {
        borderRight: '1px solid #777',
        paddingRight: '1px',
      },
    },
  }
)

const Top = style(
  {$debugName: 'Top'},
  csstips.wrap,
  csstips.startJustified,
  csstips.horizontal,
  // csstips.horizontallySpaced('5px'),
  csstips.verticallySpaced('35px'),
  {
    $nest: {
      '& > *': {
        height: '100px',
        ...csstips.vertical,
        ...csstips.verticallySpaced('5px'),
        ...csstips.betweenJustified,
        ...csstips.border('1px #ccc dotted', '', '1px #ccc dotted', '1px #ccc dotted'),
      },
      '& > * > *': {
        ...csstips.content,
        flex: '0 1 auto',
        flexWrap: 'nowrap',
        height: '22px',
        ...csstips.selfCenter,
        ...csstips.horizontal,
        //...csstips.border('1px #c88 solid'),
        paddingRight: '5px',
      },
    },
  }
)

export function Ladder(g: G.Graph, rd: R.RichDiff[]): VNode {
  const ids: Record<string, number> = {}
  let next = 0
  const id = (x: string) => (x in ids ? ids[x] : ((ids[x] = ++next), next))
  const Id = (x: string) => <span className={Subscript}>{id(x)}</span>
  return (
    <div className={Top}>
      {rd.map((d, i) => {
        switch (d.edit) {
          case 'Edited':
            const s = T.text(d.source)
            const t = T.text(d.target)
            const labels = g.edges[d.id].labels.join(' ')
            if (false && s == t) {
              return (
                <div key={i}>
                  <div />
                  <div>{s}</div>
                  <div />
                </div>
              )
            } else {
              return (
                <div key={i} style={{background: s != t ? '#ddfacf' : null}}>
                  <div>{T.texts(d.source)}</div>
                  <div className={labels.length > 0 ? BorderCell : ''}>{labels}</div>
                  <div>{T.texts(d.target)}</div>
                </div>
              )
            }
          case 'Dragged':
            return (
              <div key={i} style={{background: '#ddfaff'}}>
                <div>{d.source.text}</div>
                <div className={BorderCell}>
                  {g.edges[d.id].labels.join(' ')}
                  {Id(d.id)}
                </div>
                <div />
              </div>
            )
          case 'Dropped':
            return (
              <div key={i} style={{background: '#faffcf'}}>
                <div>{''}</div>
                <div className={BorderCell}>
                  {g.edges[d.id].labels.join(' ')}
                  {Id(d.id)}
                </div>
                <div>{d.target.text}</div>
              </div>
            )
        }
      })}
    </div>
  )
}

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  // store.on(x => console.log(json(x)))
  store.storage_connect('swell-viz')
  return () => View(store)
}

export function TryGetGraph(state: {
  annotator: string
  text: string
}): {ok: false; msg: string} | {ok: true; graph: G.Graph; rich_diff: R.RichDiff[]} {
  try {
    const graph = files[state.annotator].graphs[state.text].graph.now
    const rich_diff = R.enrichen(graph, G.calculate_diff(graph))
    return {ok: true, graph, rich_diff}
  } catch (e) {
    return {ok: false, msg: e.toString()}
  }
}

export function View(store: Store<State>): VNode {
  const edited: {annotator: string; text: string; labelled: number}[] = []
  Object.entries(files).forEach(([annotator, {graphs}]) => {
    Object.entries(graphs).forEach(([text, {graph: {now: {edges}}}]) => {
      const labelled = Object.values(edges).filter((e: G.Edge) => e.labels.length > 0).length
      if (labelled > 0 && text != 'examples') {
        edited.push({annotator, text, labelled})
      }
    })
  })
  edited.sort((x, y) => x.text.localeCompare(y.text))

  const state = store.get()
  const m = TryGetGraph(state)
  const r = m.ok ? m.rich_diff : null
  const g = m.ok ? m.graph : null
  const msg = m.ok ? null : m.msg
  return (
    <div style={{maxWidth: '800px', margin: 'auto', padding: '0 10px'}}>
      <div style={{display: 'none'}}>
        <Input store={store.at('annotator')} />
        <Input store={store.at('text')} />
      </div>
      {false && (
        <table>
          <tbody>
            {edited.map((e, i) => (
              <tr key={i} onClick={() => store.update(e)} style={{cursor: 'pointer'}}>
                <td>{e.annotator}</td>
                <td>{e.text}</td>
                <td>{e.labelled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edited.map((s, i) => {
        const m = TryGetGraph(s)
        return (
          m.ok && (
            <div key={i}>
              <h3>
                {s.annotator.slice(0, 1).toUpperCase() + s.annotator.slice(1)} {s.text} ({
                  s.labelled
                }{' '}
                labels)
              </h3>
              <div>{Ladder(m.graph, m.rich_diff)}</div>
            </div>
          )
        )
      })}
      {
        // g && r && Ladder(g, r)
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
