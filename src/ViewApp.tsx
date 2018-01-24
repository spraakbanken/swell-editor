import * as React from 'react'
import {Store} from 'reactive-lens'
import {GraphState} from './Model'
import * as G from './Graph'
import * as R from 'ramda'
import * as RD from './RichDiff'
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
  {borderRadius: '2px'},
  {fontSize: '13px'},
  {background: 'white'},
  csstips.padding('4px', '4px'),
  csstips.centerJustified,
  {
    $nest: {
      '& > span:not(:last-child)': {
        //borderRight: '1px solid #777',
        paddingRight: '4px',
        marginRight: '4px',
      },
    },
  }
)

const Column = style(
  {$debugName: 'Column'},
  {fontSize: '16px'},
  csstips.wrap,
  csstips.startJustified,
  csstips.horizontal,
  {
    $nest: {
      '& > *': {
        ...csstips.vertical,
        borderTop: '1px #ccc solid',
        borderBottom: '1px #ccc solid',
        marginBottom: '20px',
      },
      '& > * > *': {
        height: '20px',
        width: '100%',
        ...csstips.selfCenter,
        ...csstips.horizontal,
        paddingRight: '3px',
        paddingLeft: '3px',
        justifyContent: 'center',
      },
      '& > * > *:nth-child(even)': {
        height: '40px',
      },
    },
  }
)

export function MagicSVG(h: number, children: VNode[]) {
  return (
    <svg height="100%" width="100%" viewBox={'0 0 1 ' + h} preserveAspectRatio="none">
      {children}
    </svg>
  )
}

const offsets: Record<D.Dir, {dx: number; dy: number}> = {
  Up: {dx: 0.5, dy: 0},
  Down: {dx: 0.5, dy: 1},
  Left: {dx: 0, dy: 0.5},
  Right: {dx: 1, dy: 0.5},
}

export function BoxToSVG(x: number, y: number, b: D.Box) {
  const x1 = x + offsets[b.enter].dx
  const y1 = y + offsets[b.enter].dy
  const x2 = x + offsets[b.exit].dx
  const y2 = y + offsets[b.exit].dy
  const id = x + ',' + y + '-' + b.enter + '-' + b.exit + '-' + b.id
  return (
    <React.Fragment>
      <defs>
        <clipPath id={id}>
          <rect x={x + 0.25} y={y + 0.25} width={0.5} height={0.5} />
        </clipPath>
      </defs>
      <path
        clipPath={`url(#${id})`}
        vectorEffect="non-scaling-stroke"
        d={`M ${x1} ${y1} C ${x + 0.5} ${y + 0.5} ${x + 0.5} ${y + 0.5} ${x2} ${y2}`}
        style={{
          stroke: '#fff',
          strokeWidth: '5',
          fill: 'none',
        }}
      />
      <path
        vectorEffect="non-scaling-stroke"
        d={`M ${x1} ${y1} C ${x + 0.5} ${y + 0.5} ${x + 0.5} ${y + 0.5} ${x2} ${y2}`}
        style={{
          stroke: '#888',
          strokeWidth: '1.5',
          fill: 'none',
        }}
      />
    </React.Fragment>
  )
}

export function Position(base: VNode, absolute: VNode): VNode {
  return (
    <div style={{position: 'relative'}}>
      {base}
      <div
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
        }}>
        {absolute}
      </div>
    </div>
  )
}

export function Key(s: string | number, ...nodes: VNode[]) {
  return (
    <React.Fragment key={s}>
      {nodes.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
    </React.Fragment>
  )
}

export function LineColumn(column: D.Box[][], rel: VNode = <div />): VNode {
  return Position(
    rel,
    MagicSVG(
      column.length,
      Utils.flatMap(column, (boxes, y) =>
        R.sortBy(b => b.exit, boxes).map((b, i) => Key(y + ' ' + i, BoxToSVG(0, y, b)))
      )
    )
  )
}

const diff_to_spans = (rules: (string | null)[]) => (d: [number, string][]) =>
  Key('diff', ...diff_helper(d, rules, (text, cls) => <span className={cls}>{text}</span>))

const Insert = style({
  color: '#070',
  // textDecoration: 'underline',
})

const Delete = style({
  color: '#d00',
  // textDecoration: 'line-through',
})

const inserts = diff_to_spans([null, '', Insert])

const deletes = diff_to_spans([Delete, '', null])

function diff_helper<A>(
  token_diff: [number, string][],
  rules: (string | null)[],
  cb: (text: string, className: string) => A
): A[] {
  const out = [] as A[]
  token_diff.map(([type, text]) => {
    const cls = rules[type + 1]
    if (cls != null) {
      out.push(cb(text, cls))
    }
  })
  return out
}

export function Ladder(g: G.Graph, rd: RD.RichDiff[]): VNode {
  const ids: Record<string, number> = {}
  let next = 0
  const id = (x: string) => (x in ids ? ids[x] : ((ids[x] = ++next), next))
  const Id = (x: string) => <span className={Subscript}>{id(x)}</span>
  const grids = D.DiffToGrid(rd)
  const u = R.transpose(grids.upper)
  const l = R.transpose(grids.lower)
  return (
    <div className={Column}>
      {rd.map((d, i) => {
        const upper_empty = d.edit == 'Edited' && d.source.length == 0
        const lower_empty = d.edit == 'Edited' && d.target.length == 0
        const upper = LineColumn(u[i].map(bs => bs.filter(b => b.enter != 'Up' || !upper_empty)))
        const lower = LineColumn(l[i].map(bs => bs.filter(b => b.exit != 'Up' || !lower_empty)))
        const [s, t] = Utils.expr((): [VNode, VNode] => {
          switch (d.edit) {
            case 'Edited':
              return [
                <div>
                  <div>{Key(i, ...d.source_diffs.map(deletes))}</div>
                </div>,
                <div>
                  <div>{Key(i, ...d.target_diffs.map(inserts))}</div>
                </div>,
              ]
            case 'Dragged':
              return [<div>{deletes(d.source_diff)}</div>, <div />]
            case 'Dropped':
              return [<div />, <div>{inserts(d.target_diff)}</div>]
          }
        })
        const labels = g.edges[d.id].labels.filter(lbl => lbl.length > 0)
        const mid = LineColumn(
          [l[i][0]],
          <div style={{zIndex: 1}}>
            {labels.length > 0 &&
              l[i][0].length > 0 && (
                <div className={BorderCell}>{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
              )}
          </div>
        )
        return (
          <div key={i}>
            {s}
            {upper}
            {mid}
            {lower}
            {t}
          </div>
        )
      })}
    </div>
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
