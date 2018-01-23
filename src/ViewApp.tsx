import * as React from 'react'
import {Store} from 'reactive-lens'
import {GraphState} from './Model'
import * as G from './Graph'
import * as R from './RichDiff'
import * as T from './Token'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'
import * as Pilot from './PilotData'
import * as Utils from './Utils'
import {GraphSegments} from './PilotData'
import * as D from './Diff'

type VNode = React.ReactElement<{}>

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

export const json = (s: any) => JSON.stringify(s, undefined, 2)

export const Subscript = style({
  position: 'relative',
  bottom: '-0.5em',
  fontSize: '85%',
  paddingLeft: '1px',
})

const BorderCell = style(
  {$debugName: 'BorderCell'},
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
  {fontSize: '16px'},
  csstips.wrap,
  csstips.startJustified,
  csstips.horizontal,
  // csstips.horizontallySpaced('5px'),
  csstips.verticallySpaced('15px'),
  {
    $nest: {
      '& > *': {
        ...csstips.vertical,
        ...csstips.verticallySpaced('5px'),
        ...csstips.betweenJustified,
        ...csstips.border('1px #ccc solid', '1px #e8e8e8 solid'),
      },
      '& > * > *:first-child': {
        height: '22px',
      },
      '& > * > *:last-child': {
        height: '22px',
      },
      '& > * > *': {
        ...csstips.content,
        margin: '0px !important',
        padding: '0px',
        flex: '0 1 auto',
        flexWrap: 'nowrap',
        height: '16px',
        ...csstips.selfCenter,
        ...csstips.horizontal,
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
  const pls = D.ProtoLines(rd, 'Dragged')
  const grid = D.Grid(D.Line(pls, rd.length).boxes)
  const u = D.Asciibox(grid).split('\n')
  const pls2 = D.ProtoLines(rd, 'Dropped')
  const grid2 = D.VFlip(D.Grid(D.Line(pls2, rd.length).boxes))
  const l = D.Asciibox(grid2).split('\n')
  return (
    <React.Fragment>
      <div className={Top}>
        {rd.map((d, i) => {
          const upper = (
            <React.Fragment>
              {u.map((y, j) => (
                <pre style={{lineHeight: '16px'}} key={j}>
                  {'' + y[i]}
                </pre>
              ))}
            </React.Fragment>
          )
          const lower = (
            <React.Fragment>
              {l.map((y, j) => (
                <pre style={{lineHeight: '16px'}} key={j}>
                  {'' + y[i]}
                </pre>
              ))}
            </React.Fragment>
          )
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
                  <div key={i} style={{background: s != t ? '#ffd8c0' : null}}>
                    <div>{T.texts(d.source)}</div>
                    {upper}
                    <div className={labels.length > 0 ? BorderCell : ''}>{labels}</div>
                    {lower}
                    <div>{T.texts(d.target)}</div>
                  </div>
                )
              }
            case 'Dragged':
              return (
                <div key={i} style={{background: '#ddfaff'}}>
                  <div>{d.source.text}</div>
                  {upper}
                  <div className={BorderCell}>
                    {g.edges[d.id].labels.join(' ')}
                    {Id(d.id)}
                  </div>
                  {lower}
                  <div />
                </div>
              )
            case 'Dropped':
              return (
                <div key={i} style={{background: '#faffcf'}}>
                  <div>{''}</div>
                  {upper}
                  <div className={BorderCell}>
                    {g.edges[d.id].labels.join(' ')}
                    {Id(d.id)}
                  </div>
                  {lower}
                  <div>{d.target.text}</div>
                </div>
              )
          }
        })}
      </div>
    </React.Fragment>
  )
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
    <div style={{maxWidth: '850px', margin: 'auto', padding: '0 10px'}}>
      <div style={{margin: '20px 0'}}>
        {Object.keys(Pilot.ByText)
          .sort()
          .map(text => (
            <button
              key={text}
              style={{marginRight: '10px'}}
              onClick={() => store.update({graph_segments: Pilot.GraphSegments(text)})}>
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
                  borderTop: '2px #ccc solid',
                  marginBottom: '40px',
                }}
                ref={d =>
                  d &&
                  state.scroll &&
                  state.scroll.text == m.text &&
                  m.subspan.source.begin == state.scroll.begin &&
                  (d.scrollIntoView(), store.update({scroll: null}))
                }>
                <span>
                  {m.text}:{m.subspan.source.begin}-{m.subspan.source.end}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                marginBottom: '30px',
              }}>
              <div style={{flex: 1}}>
                {Utils.capitalize_head(m.annotator)}
                <span className={Subscript}>{i}</span>
              </div>
              <div style={{flex: 6}}>{Ladder(m.graph, m.rich_diff)}</div>
            </div>
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
