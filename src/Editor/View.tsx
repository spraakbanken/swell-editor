import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'
import {style} from 'typestyle'
import * as csstips from 'csstips'

import {Graph} from '../Graph'
import * as G from '../Graph'
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
import {GraphView} from '../GraphView'
import * as GV from '../GraphView'

import * as Manual from './Manual'

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
    '& .graphView ul': {
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
    '& .hovering .hover span, & .hovering path.hover, & .hovering .hover path': {
      opacity: 1.0,
      strokeOpacity: 1.0,
      fillOpacity: 1.0,
    },
    '& .hovering span, & .hovering path': {
      opacity: 0.6,
      strokeOpacity: 0.8,
      fillOpacity: 0.8,
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
  const graph = Model.graphStore(store)
  const anon_view = Model.inAnonMode(store)

  const units = Model.compactStore(store)

  const g = Model.currentGraph(store)

  const advance = Model.make_history_advance_function(store)

  const hovering = Model.isHovering(store)

  const visible_graph = Model.visibleGraph(store)

  const manual_page = state.user_manual_page !== undefined && Manual.manual[state.user_manual_page]

  const manual_part = () => (
    <div className="main" style={manual_page ? {minHeight: '18em'} : {}}>
      {Manual.slugs.slice(0, manual_page ? Manual.slugs.length : 1).map(slug => (
        <span>
          <ReactUtils.A
            title={slug}
            text={slug}
            onMouseDown={e => {
              e.stopPropagation()
              Model.setManualTo(store, slug)
            }}
          />{' '}
        </span>
      ))}
      {manual_page && (
        <React.Fragment>
          <Close
            onMouseDown={() => store.at('user_manual_page').set(undefined)}
            title="Close manual"
          />
          {manual_page.text}
          {G.equal(manual_page.target, graph.get(), true) && 'Correct!'}
        </React.Fragment>
      )}
    </div>
  )

  function full_manual() {
    return (
      <div className={topStyle}>
        <div className="main">
          <Close
            onMouseDown={() => store.at('user_manual_page').set(undefined)}
            title="Close manual"
          />
          {Manual.slugs.map(slug => {
            const page = Manual.manual[slug]
            if (page) {
              return (
                <React.Fragment>
                  {page.text}
                  <i>Initial view:</i>
                  <div>
                    <GraphView graph={page.graph} />
                  </div>
                  <i>Target view:</i>
                  <div>
                    <GraphView graph={page.target} />
                  </div>
                  <ReactUtils.A
                    title={'Try this!'}
                    text={'Try this!'}
                    onMouseDown={e => {
                      e.stopPropagation()
                      Model.setManualTo(store, slug)
                    }}
                  />
                </React.Fragment>
              )
            }
          })}
        </div>
      </div>
    )
  }

  function wrap(node: VNode) {
    return (
      <div onMouseDown={e => Model.deselect(store)}>
        <DropZone webserviceURL={config.image_ws_url} onDrop={g => advance(() => graph.set(g))}>
          {state.user_manual_page === 'print' ? full_manual() : node}
        </DropZone>
      </div>
    )
  }

  const history = Model.history(store)

  return wrap(
    <div className={topStyle} style={{position: 'relative'}}>
      {ShowErrors(store.at('errors'))}
      {manual_part()}
      {showhide('source text', () => (
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
          {Button('undo', '', history.undo, history.canUndo())}
          {Button('redo', '', history.redo, history.canRedo())}
        </div>
        <div className="box inline">{RestrictionButtons(store.at('side_restriction'))}</div>
        <div className="box inline">
          {Button(`${anon_view ? 'disable' : 'enable'} anonymization view`, '', () =>
            store.at('mode').modify(Model.nextMode)
          )}
        </div>
      </div>
      {anon_view || (
        <div className="main">
          <div className={hovering ? 'cm-hovering' : ''}>{cms.target.node}</div>
        </div>
      )}
      <LabelSidekick store={store} taxonomy={state.taxonomy[state.mode]} />
      <div
        className={'main' + (hovering ? ' hovering' : '') + (anon_view ? ' NoManualBlue' : '')}
        style={{minHeight: '10em'}}>
        <GraphView
          side={state.side_restriction}
          orderChangingLabel={s => config.order_changing_labels[s]}
          graph={visible_graph}
          hoverId={anon_view ? undefined : state.hover_id}
          onHover={anon_view ? undefined : hover_id => store.update({hover_id})}
          selectedIds={Object.keys(state.selected)}
          generation={state.generation}
          onSelect={(ids, only) => Model.onSelect(store, ids, only)}
        />
      </div>
      <div className="right tall">{Summary(g)}</div>
      {showhide('graph json', () => Utils.show(g))}
      {showhide('diff json', () => Utils.show(G.enrichen(g)))}
      {ImageWebserviceAddresses(visible_graph)}
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
        onMouseDown={e => {
          store.via(Lens.key(msg)).set(undefined)
          e.preventDefault()
        }}
      />

      {msg}
    </div>
  ))
}

function ImageWebserviceAddresses(g: Graph) {
  const stu = G.graph_to_units(g)
  const esc = (s: string) =>
    encodeURIComponent(s)
      .replace('(', '%28')
      .replace(')', '%29')
  const escaped = G.mapSides(stu, units => esc(G.units_to_string(units, '_')))
  const st = escaped.source + '//' + escaped.target
  const url = `${config.image_ws_url}/png?${st}`
  const md = `![](${url})`
  return (
    <React.Fragment>
      {showhide('compact form', () => (
        <pre className={'box pre-box main '} style={{whiteSpace: 'pre-wrap', overflowX: 'hidden'}}>
          {`${G.units_to_string(stu.source)} // ${G.units_to_string(stu.target)}`}
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
      {record.traverse(
        label_edge_map,
        (es, label) =>
          /^\d+$/.test(label) && (
            <div key={label} className="box vsep">
              <div className={GV.BorderCell}>
                <div>{label}</div>
              </div>
              <ul>
                {es.map(e => (
                  <li key={e.id}>
                    {e.ids.map(id => {
                      const si = Utils.getUnsafe(m, id)
                      return (
                        si.side === 'source' && (
                          <span key={si.index}>{g[si.side][si.index].text}</span>
                        )
                      )
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )
      )}
    </div>
  )
}
