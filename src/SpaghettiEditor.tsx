import * as R from 'ramda'
import * as React from 'react'
import {Store, Lens, Undo, Stack} from 'reactive-lens'
import {style, types, getStyles} from 'typestyle'
import * as typestyle from 'typestyle'
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

import {VNode} from './LadderView'

import * as CM from './GraphEditingCM'

import 'codemirror/lib/codemirror.css'
import 'lato-font/css/lato-font.min.css'
import 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'

export interface State {
  readonly graph: Undo<Graph>
  readonly hover_id?: string
  readonly label_id?: string
  readonly selected: Record<string, true>
  readonly subspan?: G.Subspan
  readonly side_restriction?: L.RestrictToSide
}

export const init: State = {
  graph: Undo.init(G.init('')),
  hover_id: undefined,
  label_id: undefined,
  selected: {},
  subspan: undefined,
  side_restriction: undefined,
}

function RestrictionButtons(store: Store<L.RestrictToSide | undefined>) {
  const options: (L.RestrictToSide | undefined)[] = [undefined, 'source', 'target']
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
      <div className="Modal" onClick={() => Deselect(store)}>
        <div className="ModalInner" onClick={e => e.stopPropagation()}>
          <div>
            {onSelectedActions.map(action =>
              Button(action, '', () =>
                advance(() => graph.modify(g => ActOnSelected(action, g, selected)))
              )
            )}
            {Button('deselect', '', () => Deselect(store))}
          </div>
          <hr />
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
      </div>
    )
  }
  return null
}

export function Textarea({
  store,
  onRef,
  ...props
}: {store: Store<string>} & React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    onRef?: (e: HTMLTextAreaElement) => void
  }) {
  return (
    <textarea
      {...props}
      value={store.get()}
      ref={e => onRef && e && onRef(e)}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => store.set(e.target.value)}
    />
  )
}

export function Input(store: Store<string>, tabIndex?: number) {
  return (
    <input
      value={store.get()}
      tabIndex={tabIndex}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.set(e.target.value)}
    />
  )
}

interface ex {
  source: string
  target: string
}
const ex = (source: string, target: string): ex => ({source, target})

const examples: ex[] = `
Their was a problem yesteray . // There was a problem yesterday .

The team that hits the most runs get ice cream . // The team that hits the most runs gets ice cream .

Blue birds have blue and pink feathers . // Bluebirds have blue and pink feathers .

I don't know his lives . // I don't know where he~his lives .

He get to cleaned his son . // He got his~his son~his~son to clean the~ room~ .

We wrote down the number . // We wrote the number down~down .

English is my second language with many difficulties that I faced them in
twolast years I moved in United States .
//

In my homeland we didn’t write as structural as here .
//

During the semester , I frustrated many times with my grades and thought I
couldn’t go up any more , because there was a very big difference between
ESOL 40 with other language people .
//

Sometimes , I recognized about why I’m here and studying with this crazy
language that I couldn’t be good at all ​ .
//

In contrast I faced with my beliefs and challenges that helped me to focus
on my mind to write an essay with these difficult subjectswith no experience
as narrative essay , business essay and all argumentative essays .
//

It makes me proud of myself to write something I never thought I can do
in end of this semester and improve my writing skills , have learned my
challenges and discovered strategies to overcome the challenges .
//
`
  .trim()
  .split(/\n\n+/gm)
  .map(line => ex.apply({}, line.split('//').map(side => side.trim())))

const Button = (label: string, title: string, on: () => void, enabled = true) => (
  <button title={title} onClick={on} style={{cursor: 'pointer'}} disabled={!enabled}>
    {label}
  </button>
)

const topStyle = style({
  ...Utils.debugName('topStyle'),
  fontFamily: 'lato, sans-serif, DejaVu Sans',
  color: '#222',
  display: 'grid',
  gridAutoRows: '',
  gridTemplateColumns: 'min-content min-content [main] 1fr',
  gridGap: '0.8em 0.4em',
  paddingTop: '1em',
  paddingBottom: '4em',
  maxWidth: '700px',
  margin: '0 auto',
  alignItems: 'start',

  $nest: {
    '& .CodeMirror': {
      border: '1px solid #ddd',
      height: '300px',
      minWidth: '250px',
      lineHeight: '1.5em',
      fontFamily: "'Lato', sans-serif",
    },
    [`& .${CM.ManualMarkClassName}`]: {
      color: '#26a',
      background: '#e6e6e6',
    },
    '& > .main': {
      gridColumnStart: 'main',
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
      background: '#eee',
      color: '#222',
      borderRadius: '3px',
      padding: '2px',
      border: '1px solid #888',
    },
    '& .hoverable, & .hoverable': {
      transition: 'opacity 50ms 0ms',
      opacity: 1.0,
    },
    [`& .hover, & .hover `]: {
      opacity: 1.0,
      strokeOpacity: 1.0,
    },
    [`& .not-hover, & .not-hover `]: {
      opacity: 0.6,
      strokeOpacity: 0.8,
      fillOpacity: 0.8,
    },
    '& .Modal': {
      top: '0px',
      left: '0',
      height: '100%',
      width: '100%',
      bottom: 'auto',
      zIndex: 5,
      position: 'fixed',
    },
    '& .ModalInner': {
      top: '0px',
      left: '0',
      padding: '10px 5px',
      width: '200px',
      height: '100%',

      background: 'hsl(0,0%,96%)',
      borderTop: '2px hsl(220,65%,65%) solid',
      boxShadow: '2px 2px 3px 0px hsla(0,0%,0%,0.2)',
      borderRadius: '0px 0px 2px 2px',
    },
    '& .Modal button': {
      fontSize: '0.85em',
      width: '90px',
      marginBottom: '5px',
      marginRight: '5px',
    },
    '& .Modal li button': {
      width: '30px',
    },
    '& button': {
      marginRight: '5px',
    },
  },
})

export class If extends React.Component<
  {
    children: (b: boolean, set: (b?: any) => void) => React.ReactNode
    init?: boolean
  },
  {b: boolean}
> {
  constructor(p: any) {
    super(p)
    this.state = {b: p.init === undefined ? false : p.init}
  }
  render() {
    const b = this.state.b
    return this.props.children(b, next => this.setState({b: typeof next === 'boolean' ? next : !b}))
  }
}

function showhide(what: string, show: () => string | VNode, init = false) {
  return (
    <If init={init}>
      {(b, flip) => {
        let v
        return (
          <React.Fragment>
            <a
              style={{opacity: '0.85', justifySelf: 'end'} as any}
              className="main"
              href=""
              onClick={e => (e.preventDefault(), flip())}>
              {b ? 'hide' : 'show'} {what}
            </a>
            {b &&
              ((v = show()), typeof v === 'string' ? <pre className="pre-box main">{v}</pre> : v)}
          </React.Fragment>
        )
      }}
    </If>
  )
}

type side = 'source' | 'target'
const sides = ['source' as side, 'target' as side]
const op = (x: side) => (x == 'source' ? 'target' : 'source')

const ws_url = 'https://ws.spraakbanken.gu.se/ws/swell'

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  global.G = G
  global.Utils = Utils
  store
    .at('graph')
    .at('now')
    .storage_connect('swell-spaghetti-4')

  store
    .at('graph')
    .at('now')
    .ondiff(g => {
      const inv = G.check_invariant(g)
      if (inv !== 'ok') {
        Utils.stderr(inv)
      }
    })

  const inv = G.check_invariant(store.get().graph.now)
  if (inv !== 'ok') {
    Utils.stderr(inv)
    store.set(init)
  }

  global.test = () => {
    store.set({graph: Undo.init(G.init('this is an example', true)), selected: {}})
  }

  store.ondiff(state => {
    const restricted = only_select_existing_words(state.graph.now, state.selected)
    restricted && store.update(restricted)
  })

  const cm_target = CM.GraphEditingCM(store.pick('graph', 'hover_id', 'subspan'))
  return () => View(store, cm_target)
}

export function View(store: Store<State>, cm_target: CM.CMVN): VNode {
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

  // Utils.stdout(units.get())
  // Utils.stdout(graph.get().target)
  // Utils.stdout(graph.get())

  // const source = now.at('source')
  // const target = now.at('target')

  const g = graph.get()

  const advance = advanceFactory(store)

  return (
    <DropZone webserviceURL={ws_url} onDrop={g => advance(() => graph.set(g))}>
      <div className={topStyle} style={{position: 'relative'}}>
        <LabelSidekick store={store} onBlur={() => cm_target.cm.focus()} />
        {showhide('set source text', () => (
          <div className="main">
            <div>
              <textarea
                style={{width: '100%'}}
                rows={5}
                className="main"
                onChange={e =>
                  advance(() => {
                    const t = e.target as HTMLTextAreaElement
                    graph.modify(g => G.invert(G.set_target(G.invert(g), t.value + ' ')))
                  })
                }
                placeholder="Input source text..."
                value={G.source_text(graph.get()).slice(0, -1)}
              />
            </div>
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
        <div className="main">{cm_target.node}</div>
        <div className="main" style={{minHeight: '10em'}}>
          <L.LadderComponent
            side={state.side_restriction}
            graph={state.subspan ? G.subgraph(graph.get(), state.subspan) : g}
            hoverId={state.hover_id}
            onHover={hover_id => store.update({hover_id})}
            selectedIds={Object.keys(state.selected)}
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
        {showhide('compact representation', () => (
          <React.Fragment>
            {sides.map((side, i) => (
              <React.Fragment key={i}>
                {Button('\u2b1a', 'clear', () => advance(() => units.at(side).set('')))}
                {Button(i ? '\u21e1' : '\u21e3', 'copy to ' + side, () =>
                  advance(() => units.at(op(side)).set(units.get()[side]))
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
        {examples.map((e, i) => (
          <React.Fragment key={i}>
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
            <span>{e.source}</span>
          </React.Fragment>
        ))}
      </div>
    </DropZone>
  )
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
            className={'pre-box main ' + L.Unselectable}
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
