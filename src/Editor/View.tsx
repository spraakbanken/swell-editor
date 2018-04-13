import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'
import {style} from 'typestyle'
import * as csstips from 'csstips'

import {Graph} from '../Graph'
import * as G from '../Graph'
import * as C from '../Compact'
import * as RD from '../RichDiff'
import * as Utils from '../Utils'
import * as record from '../record'

import {VNode} from '../ReactUtils'
import * as ReactUtils from '../ReactUtils'
import {Close, Button, showhide} from '../ReactUtils'

import {State} from './Model'
import * as Model from './Model'
import {DropZone} from './DropZone'
import * as CM from './CodeMirror'
import {config} from './Config'

import {LabelSidekick} from './LabelSidekick'
import {Ladder} from '../LadderView'
import * as L from '../LadderView'

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
    '& .box': {
      background: 'hsl(0,0%,96%)',
      borderTop: '2px hsl(220,65%,65%) solid',
      boxShadow: '2px 2px 3px 0px hsla(0,0%,0%,0.2)',
      borderRadius: '0px 0px 2px 2px',
      padding: '3px',
      marginRight: '3px',
    },
    '& .vsep': {
      marginBottom: '10px',
    },
    '& .inline': {
      display: 'inline-block',
    },
    '& pre.pre-box': {
      fontSize: '0.85em',

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
    '& .sidekick ul': {
      marginRight: '15px',
      marginLeft: '0px',
    },
    '& .sidekick': {
      zIndex: 2,
      position: 'relative',
      marginRight: '10px',
      margin: 0,
      padding: 1,
    },
    '& .sidekick > * > button': {
      fontSize: '0.85em',
      width: '47%',
      marginBottom: '5px',
    },
    '& .sidekick li button': {
      fontSize: '0.85em',
      width: '30px',
    },
    '& button': {
      marginRight: '5px',
    },
    '& button:last-child': {
      marginRight: 0,
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
    '& .float_buttons_right button': {
      float: 'right',
      marginRight: '5px',
    },
    '& .close': {
      float: 'right',
      textDecoration: 'none',
      opacity: 0.4,
    },
    '& .close:hover': {
      opacity: 0.8,
    },
    '& .NoManualBlue .GreyPath.Manual': {
      stroke: '#999',
    },
  },
})


export function View(store: Store<State>, cms: Record<G.Side, CM.CMVN>): VNode {
  // console.timeEnd('draw')
  // console.log('redraw')
  // console.time('draw')

  const state = store.get()
  const history = store.at('graph')
  const graph = history.at('now')
  const {anon_view} = state

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

  const advance = Model.make_history_advance_function(store)

  const hovering = state.hover_id !== undefined && Object.keys(state.selected).length == 0

  const visible_graph = Utils.expr(() => {
    if (anon_view) {
      return G.anonymize(g)
    } else if (state.subspan) {
      return G.subgraph(g, state.subspan)
    } else {
      return g
    }
  })

  const tmg = G.token_map(g)
  const tmv = G.token_map(visible_graph)
  const emv = G.edge_map(visible_graph)

  function onSelect(ids: string[]) {
    const involved_ids = Utils.flatMap(ids, id => {
      if (anon_view) {
        const t = tmv.get(id)
        if (t && t.side == 'target') {
          return visible_graph.edges[Utils.getUnsafe(emv, id).id].ids.filter(
            id => Utils.getUnsafe(tmv, id).side === 'source'
          )
        } else {
          return [id]
        }
      } else {
        return [id]
      }
    })
    const selected = store.get().selected
    const b = involved_ids.every(id => selected[id]) ? undefined : true
    store.transaction(() =>
      involved_ids.forEach(id =>
        store
          .at('selected')
          .via(Lens.key(id))
          .set(b)
      )
    )
  }

  function wrap(node: VNode) {
    return <div onClick={e => Model.deselect(store)}><DropZone webserviceURL={config.image_ws_url} onDrop={g => advance(() => graph.set(g))}>{node}</DropZone></div>
  }


  return wrap(
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
            <div className="box inline">
              {Button('undo', '', () => history.modify(Undo.undo), Undo.can_undo(history.get()))}
              {Button('redo', '', () => history.modify(Undo.redo), Undo.can_redo(history.get()))}
            </div>
            <div className="box inline">{RestrictionButtons(store.at('side_restriction'))}</div>
            <div className="box inline">
              {Button(`${anon_view ? 'disable' : 'enable'} anonymization view`, '', () =>
                store.at('anon_view').modify(b => !b)
              )}
            </div>
          </div>
          {state.anon_view || (
            <div className="main">
              <div className={hovering ? 'cm-hovering' : ''}>{cms.target.node}</div>
            </div>
          )}
          <LabelSidekick store={store} onBlur={() => cms.target.cm.focus()} />
          <div
            className={'main' + (hovering ? ' hovering' : '') + (anon_view ? ' NoManualBlue' : '')}
            style={{minHeight: '10em'}}>
            <Ladder
              side={state.side_restriction}
              orderChangingLabel={s => config.order_changing_labels[s]}
              graph={visible_graph}
              hoverId={state.hover_id}
              onHover={hover_id => store.update({hover_id})}
              selectedIds={Object.keys(state.selected)}
              generation={state.generation}
              onSelect={onSelect}
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
          {ImageWebserviceAddresses(graph.get())}
          <div className="main TopPad">
            <em>Examples:</em>
          </div>
          {config.examples.map((e, i) => [
            <div className="left float_buttons_right" key={i}>
              {Button('\u21ea', 'load example', () =>
                advance(() => units.set({source: e.source, target: e.source}))
              )}
              {!e.target ? (
                <div />
              ) : (
                Button('\u21eb', 'see example analysis', () =>
                  advance(() => units.set({source: e.source, target: e.target}))
                )
              )}
            </div>,
            <span className="main">{e.source}</span>,
          ])}
        </div>
  )
}

function RestrictionButtons(store: Store<G.Side | undefined>): VNode[] {
  const options = [undefined, ...G.sides]
  const name = (k?: string) => (k === undefined ? 'both sides' : k + ' only')
  return options.map(k => Button(name(k), '', () => store.set(k), store.get() !== k))
}


function ShowErrors(store: Store<Record<string, true>>) {
  return record.traverse(store.get(), (_, msg) => (
    <div className="main error">
      <Close
        title="dismiss"
        onClick={e => {
          store.via(Lens.key(msg)).set(undefined)
          e.preventDefault()
        }}
      />

      {msg}
    </div>
  ))
}

function ImageWebserviceAddresses(g: Graph) {
  const stu = C.graph_to_units(g)
  const esc = (s: string) =>
    encodeURIComponent(s)
      .replace('(', '%28')
      .replace(')', '%29')
  const escaped = G.with_st(stu, units => esc(C.units_to_string(units, '_')))
  const st = escaped.source + '//' + escaped.target
  const url = `${config.image_ws_url}/png?${st}`
  const md = `![](${url})`
  return (
    <React.Fragment>
      {showhide('compact form', () => (
        <pre className={'box pre-box main '} style={{whiteSpace: 'pre-wrap', overflowX: 'hidden'}}>
          {`${C.units_to_string(stu.source)} // ${C.units_to_string(stu.target)}`}
        </pre>
      ))}
      {showhide(
        'copy link',
        () => (
          <pre
            className={'box pre-box main ' + ReactUtils.Unselectable}
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
    </React.Fragment>
  )
}

export function Summary(g: Graph) {
  const label_edge_map: Record<string, G.Edge[]> = {}
  record.forEach(g.edges, e => e.labels.forEach(l => Utils.push(label_edge_map, l, e)))
  const m = G.token_map(g)
  return (
    <div>
      {record.traverse(label_edge_map, (es, label) => (
        <div key={label} className="box vsep">
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
