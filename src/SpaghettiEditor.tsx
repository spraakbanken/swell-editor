import * as R from 'ramda'
import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'
import {style} from 'typestyle'
import * as csstips from 'csstips'

import {DropZone} from './DropZone'

import * as D from './Diff'
import {Graph} from './Graph'
import * as G from './Graph'
import * as L from './LadderView'
import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'
import * as record from './record'

import * as C from './Compact'

import {VNode} from './ReactUtils'
import * as ReactUtils from './ReactUtils'
import {Button, showhide} from './ReactUtils'

import * as CM from './GraphEditingCM'

import 'codemirror/lib/codemirror.css'
import 'lato-font/css/lato-font.min.css'
import 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'

import {config} from './SpaghettiEditorConfig'

import * as bowser from 'bowser'

export interface State {
  readonly graph: Undo<Graph>
  readonly hover_id?: string
  readonly label_id?: string
  readonly selected: Record<string, true>
  readonly subspan?: G.Subspan
  readonly side_restriction?: G.Side
  /** for hot module reloading, bumped at each reload and used to make sure thunked components get updated */
  readonly generation: number
  /** error messages */
  readonly errors: Record<string, true>
}

export const init: State = {
  graph: Undo.init(G.init('')),
  hover_id: undefined,
  label_id: undefined,
  selected: {},
  subspan: undefined,
  side_restriction: undefined,
  generation: 0,
  errors: {},
}

function RestrictionButtons(store: Store<G.Side | undefined>) {
  const options = [undefined, ...G.sides]
  const name = (k?: string) => (k === undefined ? 'both sides' : k + ' only')
  return options.map(k => Button(name(k), '', () => store.set(k), store.get() !== k))
}

function only_select_existing_words(graph: Graph, selected0: Record<string, true>) {
  const em = G.edge_map(graph)
  const present = (s: string) => em.has(s)
  const selected = record.filter(selected0, (_, id) => present(id))
  const n_keys = (o: Object) => Object.keys(o).length
  if (n_keys(selected) < n_keys(selected0)) {
    return {selected}
  }
}

function advanceFactory(store: Store<State>) {
  const graph = store.at('graph')
  const now = graph.at('now')
  return (k: () => void) =>
    store.transaction(() => {
      const g0 = now.get()
      k()
      const g1 = now.get()
      if (!G.equal(g0, g1)) {
        now.set(g0)
        graph.modify(Undo.advance_to(g1))
      }
    })
}

type ActionOnSelected = 'revert' | 'auto' | 'disconnect' | 'merge' | 'group'

const onSelectedActions: ActionOnSelected[] = ['revert', 'auto', 'disconnect', 'merge', 'group']

const act_on_selected: {[K in ActionOnSelected]: (graph: Graph, selected: string[]) => Graph} = {
  revert(graph, selected) {
    const edge_ids = G.token_ids_to_edge_ids(graph, selected)
    const edges = G.token_ids_to_edges(graph, selected)
    return G.revert(graph, edge_ids)
  },
  auto(graph, selected) {
    const edge_ids = G.token_ids_to_edge_ids(graph, selected)
    return G.align({
      ...graph,
      edges: record.map(graph.edges, e => {
        if (edge_ids.some(id => id == e.id)) {
          return G.Edge(e.ids, e.labels, false)
        } else {
          return e
        }
      }),
    })
  },
  disconnect: G.disconnect,
  merge(graph, selected) {
    return G.connect(graph, G.token_ids_to_edge_ids(graph, selected))
  },
  group(graph, selected) {
    return this.merge(this.disconnect(graph, selected), selected)
  },
}

function ActOnSelected(action: ActionOnSelected, g: Graph, s: string[]): Graph {
  return act_on_selected[action](g, s)
}

function Deselect(store: Store<State>) {
  store.update({selected: {}, hover_id: undefined})
}

function LabelSidekick({store, onBlur}: {store: Store<State>; onBlur: () => void}) {
  const advance = advanceFactory(store)
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
      <div className="left tall sidekick" onClick={e => console.log('stop') || e.stopPropagation()}>
        <div>
          {onSelectedActions.map(action =>
            Button(action, '', () =>
              advance(() => graph.modify(g => ActOnSelected(action, g, selected)))
            )
          )}
          {Button('deselect', '', () => Deselect(store))}
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
              Deselect(store)
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
              {Button('x', '', () => pop(lbl))} {lbl}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return null
}

const topStyle = style({
  ...Utils.debugName('topStyle'),
  fontFamily: 'lato, sans-serif, DejaVu Sans',
  color: '#222',
  display: 'grid',
  gridAutoRows: '',

  gridGap: '0.8em 0.4em',
  paddingTop: '1em',
  paddingBottom: '4em',
  maxWidth: '1050px',
  margin: '0 auto',
  alignItems: 'start',
  gridTemplateColumns: '[left] 180px [main] 1fr [right] 180px',

  $nest: {
    '& > .left': {
      gridColumnStart: 'left',
    },
    '& > .main': {
      gridColumnStart: 'main',
    },
    '& > .right': {
      gridColumnStart: 'right',
    },
    '& > .tall': {
      gridRowEnd: 'span 10',
    },
    '& > .left button': {
      float: 'right',
    },
    '& .CodeMirror': {
      border: '1px solid #ddd',
      height: '300px',
      minWidth: '250px',
      lineHeight: '1.5em',
      fontFamily: "'Lato', sans-serif",
    },
    '& .CodeMirror .cm-resize-handle': {
      display: 'block',
      position: 'absolute',
      bottom: 0,
      right: 0,
      zIndex: 99,
      width: '18px',
      height: '18px',
      boxShadow: 'inset -1px -1px 0 0 silver',
      cursor: 'nwse-resize',
    },
    [`& .${CM.ManualMarkClassName}`]: {
      color: '#26a',
      background: '#e6e6e6',
    },
    '& > *': {
      // Non-grid fallback
      display: 'block',
    },
    '& > button': {
      marginTop: '-0.125em',
      // Non-grid fallback
      display: 'inline-block',
    },
    '& pre.pre-box': {
      fontSize: '0.85em',
      background: 'hsl(0,0%,96%)',
      borderTop: '2px hsl(220,65%,65%) solid',
      boxShadow: '2px 2px 3px 0px hsla(0,0%,0%,0.2)',
      borderRadius: '0px 0px 2px 2px',
      padding: '0.25em',
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
    '& .ladder ul': {
      zIndex: 10,
      cursor: 'pointer',
    },
    '& .Selected, & .Selectable': {
      padding: '3px',
    },
    '& .Selected': {
      background: '#8883',
      color: '#222',
      borderRadius: '3px',
      padding: '2px',
      border: '1px solid #8886',
    },
    // '& .hoverable, & .hoverable': {
    //   transition: 'opacity 50ms 0ms',
    //   opacity: 1.0,
    // },
    '& .cm-hovering span.hover': {
      color: '#222f',
    },
    '& .cm-hovering span': {
      color: '#2228',
    },
    '& .hovering .hover span, & .hovering path.hover': {
      opacity: 1.0,
      strokeOpacity: 1.0,
      fillOpacity: 1.0,
    },
    '& .hovering span, & .hovering path': {
      opacity: 0.6,
      strokeOpacity: 0.8,
      fillOpacity: 0.8,
    },
    '& .sidekick': {
      zIndex: 2,
      position: 'relative',
      background: 'hsl(0,0%,96%)',
      borderTop: '2px hsl(220,65%,65%) solid',
      boxShadow: '2px 2px 3px 0px hsla(0,0%,0%,0.2)',
      borderRadius: '0px 0px 2px 2px',
      marginRight: '10px',
    },
    '& .sidekick button': {
      fontSize: '0.85em',
      width: '46%',
      marginBottom: '5px',
      marginRight: '5px',
    },
    '& .sidekick li button': {
      width: '30px',
    },
    '& button': {
      marginRight: '5px',
    },
    '& .error': {
      whiteSpace: 'pre-wrap',
      backgroundColor: '#f2dede',
      borderColor: '#ebccd1',
      color: '#a94442',
      padding: '15px',
      marginBottom: '20px',
      border: '1px solid transparent',
      borderRadius: '4px',
    },
    '& .close': {
      float: 'right',
      textDecoration: 'none',
      opacity: 0.4,
    },
    '& .close:hover': {
      opacity: 0.8,
    },
  },
})

function ShowErrors(store: Store<Record<string, true>>) {
  return record.traverse(store.get(), (_, msg) => (
    <div className="main error">
      <a
        className="close"
        href="#"
        title="dismiss"
        onClick={e => {
          store.via(Lens.key(msg)).set(undefined)
          e.preventDefault()
        }}>
        ×
      </a>
      {msg}
    </div>
  ))
}

const ws_url = 'https://ws.spraakbanken.gu.se/ws/swell'

function check_invariant(store: Store<State>): (g: Graph) => void {
  return g => {
    const inv = G.check_invariant(g)
    if (inv !== 'ok') {
      Utils.stderr(inv)
      const msg = [
        `Internal invariant violated:`,
        inv.violation,
        '',
        `Please report this as a bug, describe what you did and include the current graph:`,
        Utils.show(inv.g),
      ].join('\n')
      store.at('errors').update({[msg]: true})
      store.at('graph').set(Undo.init(G.init('x')))
    }
  }
}

export function App(store: Store<State>): () => VNode {
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
    .ondiff(check_invariant(store))

  check_invariant(store)(store.get().graph.now)

  function trigger_invariant_error() {
    window.setTimeout(() => {
      const g0 = G.init('apa')
      const g = {...g0, edges: {oops: g0.edges['e-s0-t0']}}
      store.update({graph: Undo.init(g)})
    }, 1000)
  }

  store.ondiff(state => {
    const restricted = only_select_existing_words(state.graph.now, state.selected)
    restricted && store.update(restricted)
  })

  const cms = record.create(G.sides, side =>
    CM.GraphEditingCM(store.pick('graph', 'hover_id', 'subspan'), side)
  )
  return () => View(store, cms)
}

export function Summary(g: Graph) {
  const label_edge_map: Record<string, G.Edge[]> = {}
  record.forEach(g.edges, e => e.labels.forEach(l => Utils.push(label_edge_map, l, e)))
  const m = G.token_map(g)
  return (
    <div>
      {record.traverse(label_edge_map, (es, label) => (
        <div key={label} style={{background: '#eee'}}>
          <div className={L.BorderCell}>
            <div>{label}</div>
          </div>
          <ul>
            {es.map(e => (
              <li key={e.id}>
                {e.ids.map(id => {
                  const si = Utils.getUnsafe(m, id)
                  return (
                    si.side === 'source' && <span key={si.index}>{g[si.side][si.index].text}</span>
                  )
                })}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function View(store: Store<State>, cms: Record<G.Side, CM.CMVN>): VNode {
  // console.timeEnd('draw')
  // console.log('redraw')
  // console.time('draw')

  const state = store.get()
  const history = store.at('graph')
  const graph = history.at('now')

  const units: Store<G.ST<string>> = store
    .at('graph')
    .at('now')
    .via(
      Lens.iso(
        g => G.with_st(C.graph_to_units(g), us => C.units_to_string(us)),
        state => {
          const s = C.parse(state.source)
          const t = C.parse(state.target)
          return C.units_to_graph(s, t)
        }
      )
    )

  const g = graph.get()

  const advance = advanceFactory(store)

  const hovering = state.hover_id !== undefined && Object.keys(state.selected).length == 0

  return (
    <div onClick={e => Deselect(store)}>
      <DropZone webserviceURL={ws_url} onDrop={g => advance(() => graph.set(g))}>
        <div className={topStyle} style={{position: 'relative'}}>
          {ShowErrors(store.at('errors'))}
          {showhide('set source text', () => (
            <div className="main">
              <div className={hovering ? 'cm-hovering' : ''}>{cms.source.node}</div>
              <div>
                {Button('copy to target', '', () =>
                  advance(() => graph.modify(g => G.init_from(G.source_texts(g))))
                )}
              </div>
            </div>
          ))}
          <div className="main buttonSep" style={{zIndex: 5}}>
            {Button('undo', '', () => history.modify(Undo.undo), Undo.can_undo(history.get()))}
            {Button('redo', '', () => history.modify(Undo.redo), Undo.can_redo(history.get()))}
            {RestrictionButtons(store.at('side_restriction'))}
          </div>
          <div className="main">
            <div className={hovering ? 'cm-hovering' : ''}>{cms.target.node}</div>
          </div>
          <LabelSidekick store={store} onBlur={() => cms.target.cm.focus()} />
          <div className={'main' + (hovering ? ' hovering' : '')} style={{minHeight: '10em'}}>
            <L.Ladder
              side={state.side_restriction}
              orderChangingLabel={s => config.order_changing_labels[s]}
              graph={state.subspan ? G.subgraph(graph.get(), state.subspan) : g}
              hoverId={state.hover_id}
              onHover={hover_id => store.update({hover_id})}
              selectedIds={Object.keys(state.selected)}
              generation={state.generation}
              onSelect={ids => {
                const selected = store.get().selected
                const b = ids.every(id => selected[id]) ? undefined : true
                advance(() =>
                  ids.forEach(id =>
                    store
                      .at('selected')
                      .via(Lens.key(id))
                      .set(b)
                  )
                )
              }}
            />
          </div>
          <div className="right tall">{Summary(g)}</div>
          {showhide('compact representation', () => (
            <React.Fragment>
              {G.sides.map((side, i) => (
                <React.Fragment key={i}>
                  {Button('\u2b1a', 'clear', () => advance(() => units.at(side).set('')))}
                  {Button(i ? '\u21e1' : '\u21e3', 'copy to ' + side, () =>
                    advance(() => units.at(G.opposite(side)).set(units.get()[side]))
                  )}
                  <input
                    defaultValue={units.at(side).get()}
                    onKeyDown={e =>
                      e.key === 'Enter' &&
                      advance(() => {
                        const t = e.target as HTMLInputElement
                        units.at(side).set(t.value)
                      })
                    }
                    tabIndex={(i + 1) as number}
                    placeholder={'Enter ' + side + ' text...'}
                  />
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
          {showhide('graph json', () => Utils.show(g))}
          {showhide('diff json', () => Utils.show(RD.enrichen(g)))}
          {links(graph.get())}
          <div className="main TopPad">
            <em>Examples:</em>
          </div>
          {config.examples.map((e, i) => [
            <div className="left" key={i}>
              {!e.target ? (
                <div />
              ) : (
                Button('\u21eb', 'see example analysis', () =>
                  advance(() => units.set({source: e.source, target: e.target}))
                )
              )}
              {Button('\u21ea', 'load example', () =>
                advance(() => units.set({source: e.source, target: e.source}))
              )}
            </div>,
            <span className="main">{e.source}</span>,
          ])}
        </div>
      </DropZone>
    </div>
  )
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

function links(g: Graph) {
  const stu = C.graph_to_units(g)
  const esc = (s: string) =>
    encodeURIComponent(s)
      .replace('(', '%28')
      .replace(')', '%29')
  const escaped = G.with_st(stu, units => esc(C.units_to_string(units, '_')))
  const st = escaped.source + '//' + escaped.target
  const url = `${ws_url}/png?${st}`
  const md = `![](${url})`
  return (
    <>
      {showhide('compact form', () => (
        <pre className={'pre-box main '} style={{whiteSpace: 'pre-wrap', overflowX: 'hidden'}}>
          {`${C.units_to_string(stu.source)} // ${C.units_to_string(stu.target)}`}
        </pre>
      ))}
      {showhide(
        'copy link',
        () => (
          <pre
            className={'pre-box main ' + ReactUtils.Unselectable}
            style={{whiteSpace: 'pre-wrap', overflowX: 'hidden'}}
            draggable={true}
            onDragStart={e => {
              e.dataTransfer.setData('text/plain', md)
            }}>
            {md}
          </pre>
        ),
        true
      )}
    </>
  )
}
