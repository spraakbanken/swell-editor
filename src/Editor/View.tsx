import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'
import {style} from 'typestyle'
import * as typestyle from 'typestyle'
import * as csstips from 'csstips'

import {Graph} from '../Graph'
import * as G from '../Graph'
import * as Utils from '../Utils'
import * as record from '../record'

import {VNode} from '../ReactUtils'
import * as ReactUtils from '../ReactUtils'
import {Close, Button} from '../ReactUtils'

import {State} from './Model'
import * as Model from './Model'
import {DropZone} from './DropZone'
import * as CM from './CodeMirror'
import {config} from './Config'

import * as EditorTypes from '../EditorTypes'

import {LabelSidekick} from './LabelSidekick'
import {GraphView} from '../GraphView'
import * as GV from '../GraphView'

import * as Manual from './Manual'
import {validation_transaction} from './Validate'

typestyle.cssRaw(`
body > div {
  height: 100%
}
`)

const header_height = '32px'
const footer_height = '26px'

const topStyle = style({
  ...Utils.debugName('topStyle'),
  fontFamily: 'lato, sans-serif, DejaVu Sans',
  color: '#222',
  display: 'grid',

  gridGap: '0px 5px',
  margin: '0 auto',
  alignItems: 'start',
  gridTemplate: `
    "header   header header"  ${header_height}
    "sidekick main   summary" 1fr
    "footer   footer footer"  ${footer_height}
  / 185px     1fr    180px
  `,
  height: '100%',

  $nest: {
    ...record.flatten(
      'sidekick main summary header footer'.split(' ').map(area => ({
        [`& > .${area}`]: {
          gridArea: area,
          height: '100%',
        },
      }))
    ),
    '& .header': {
      position: 'relative',
      paddingBottom: '5px',
      marginBottom: '5px',
    },
    '& .content': {
      height: '100%',
    },
    '& .menu div': {
      position: 'absolute',
      top: header_height,
      right: 0,
      zIndex: 100,
    },
    '& .menu button': {
      display: 'block',
    },
    '& .CodeMirror': {
      border: '1px solid #ddd',
      height: 'auto',
      paddingBottom: '1em',
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
    '& .box': {
      background: 'hsl(0,0%,96%)',
      borderTop: '2px hsl(220,65%,65%) solid',
      boxShadow: '2px 2px 3px 0px hsla(0,0%,0%,0.2)',
      borderRadius: '0px 0px 2px 2px',
      padding: '3px',
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
    '& .TopPad': {
      paddingTop: '1em',
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
      fontSize: '0.85em',
      marginRight: '5px',
      marginBottom: '5px',
    },
    '& button:last-child': {
      marginRight: 0,
    },
    '& .error, & .warning': {
      whiteSpace: 'pre-wrap',
      padding: '15px',
      marginBottom: '20px',
      border: '1px solid transparent',
      borderRadius: '4px',
    },
    '& .error': {
      backgroundColor: '#f2dede',
      borderColor: '#ebccd1',
      color: '#a94442',
    },
    '& .warning': {
      backgroundColor: '#f2e9de',
      borderColor: '#ebebd1',
      color: '#a99942',
    },
    '& .float_right > *': {
      float: 'right',
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

export function View(store: Store<State>, cms: Record<G.Side, CM.CMVN>): VNode {
  // console.timeEnd('draw')
  // console.log('redraw')
  // console.time('draw')

  const state = store.get()
  const graph = Model.graphStore(store)
  const anon_mode = Model.inAnonMode(store)

  const g = Model.currentGraph(store)
  const visibleGraph = Model.visibleGraph(store)

  const advance = Model.make_history_advance_function(store)

  const manual_page = state.manual !== undefined && Manual.manual[state.manual]

  const manual_part = () =>
    manual_page && (
      <div className="main" style={{minHeight: '18em'}}>
        {Manual.slugs.map(slug => (
          <span key={slug}>
            <ReactUtils.A
              title={slug.replace('_', ' ')}
              text={slug.replace('_', ' ')}
              onMouseDown={e => {
                e.stopPropagation()
                Model.setManualTo(store, slug)
              }}
            />{' '}
          </span>
        ))}
        {manual_page && (
          <React.Fragment>
            <Close onMouseDown={() => Model.setManualTo(store, undefined)} title="Close manual" />
            {manual_page.text}
            {G.equal(manual_page.target, graph.get(), true) && (
              <i style={{color: 'darkgreen'}}>Correct!</i>
            )}
          </React.Fragment>
        )}
      </div>
    )

  function full_manual() {
    return (
      <div className={topStyle}>
        <div className="main">
          <div className="content">
            <Close onMouseDown={() => Model.setManualTo(store, undefined)} title="Close manual" />
            {Manual.slugs.map(slug => {
              const page = Manual.manual[slug]
              if (page) {
                const anon_mode = page.mode == 'anonymization'
                const m = G.anonymize_when(anon_mode)
                return (
                  <React.Fragment>
                    {page.text}
                    <i>Initial view:</i>
                    <div className={anon_mode ? ' NoManualBlue' : ''}>
                      <GraphView graph={m(page.graph)} />
                    </div>
                    <i>Target view:</i>
                    <div className={anon_mode ? ' NoManualBlue' : ''}>
                      <GraphView graph={m(page.target)} />
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
      </div>
    )
  }

  function main() {
    const hovering = Model.isHovering(store)
    const visible_graph = Model.visibleGraph(store)
    const units = Model.compactStore(store)

    return (
      <div className="content">
        {ShowMessages(store.at('errors'))}
        {ShowMessages(store.at('warnings'), true)}
        {manual_part()}
        {state.show.source_text && (
          <div>
            <em>Source text:</em>
            <div className={'TopPad ' + (hovering ? 'cm-hovering' : '')}>{cms.source.node}</div>
            <div>
              {!!state.backend ||
                Button('copy to target', '', () =>
                  advance(() => graph.modify(g => G.init_from(G.source_texts(g))))
                )}
            </div>
          </div>
        )}
        {anon_mode || (
          <div className="TopPad">
            <em>Target text:</em>
            <div className={hovering ? 'cm-hovering' : ''}>{cms.target.node}</div>
          </div>
        )}
        <div
          className={(hovering ? ' hovering' : '') + (anon_mode ? ' NoManualBlue' : '')}
          style={{minHeight: '10em'}}>
          <GraphView
            side={state.side_restriction}
            orderChangingLabel={s => config.order_changing_labels[s]}
            graph={visible_graph}
            hoverId={anon_mode ? undefined : state.hover_id}
            onHover={anon_mode ? undefined : hover_id => store.update({hover_id})}
            selectedIds={Object.keys(state.selected)}
            generation={state.generation}
            onSelect={(ids, only) => Model.onSelect(store, ids, only)}
          />
        </div>
        {state.show.image_link && ImageWebserviceAddresses(visible_graph, anon_mode)}
        {state.show.graph && <pre className="box pre-box">{Utils.show(visibleGraph)}</pre>}
        {state.show.diff && (
          <pre className="box pre-box">{Utils.show(G.enrichen(visibleGraph))}</pre>
        )}
        {state.show.examples && (
          <div className="TopPad">
            <em>Examples:</em>
            {config.examples.map((e, i) => (
              <div key={i}>
                <div>
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
                  <span>{e.source}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const show_store = (show: Model.Show) => store.at('show').via(Lens.key(show))

  function header() {
    const history = Model.history(store)

    const options = ['graph', 'diff', 'image_link', 'examples', 'source_text'] as Model.Show[]

    const toggle = (show: Model.Show) => show_store(show).modify(b => (b ? undefined : true))

    const toggle_button = (show: Model.Show, label = show.replace('_', ' ')) =>
      Button(show_hide_str(state.show[show]) + label, '', () => toggle(show), undefined, true)

    return (
      <React.Fragment>
        <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
          <div>
            {Button('undo', '', history.undo, history.canUndo())}
            {Button('redo', '', history.redo, history.canRedo())}
          </div>
          <div>
            {!!state.backurl && (
              <a
                style={{margin: '3px 8px', fontSize: '0.9em', opacity: 0.8}}
                href={state.backurl}
                onClick={e => {
                  const warnings = Object.keys(store.at('warnings').get())
                  if (warnings.length && !confirm(warnings.join('\n') + '\n\nLeave anyway?')) {
                    e.preventDefault()
                  }
                }}>
                back
              </a>
            )}
            {state.done !== undefined &&
              Button(state.done ? 'not done' : 'done', 'toggle between done and not done', () =>
                validation_transaction(store, s => s.at('done').modify(b => !b))
              )}
            {toggle_button('options', 'options')}
          </div>
        </div>
        {state.show.options && (
          <div className="menu">
            <div className="box">
              {RestrictionButtons(store.at('side_restriction'))}
              <hr />
              {Button(
                `${anon_mode ? 'disable' : 'enable'} anonymization view`,
                '',
                () => store.at('mode').modify(Model.nextMode),
                !state.backend
              )}
              <hr />
              {Button(
                show_hide_str(state.manual !== undefined) + 'manual',
                'toggle showing manual',
                () => Model.setManualTo(store, state.manual ? undefined : 'manual')
              )}
              <hr />
              {options.map(s => toggle_button(s))}
            </div>
          </div>
        )}
      </React.Fragment>
    )
  }

  return state.manual === 'print' ? (
    full_manual()
  ) : (
    <div
      className={topStyle}
      style={{position: 'relative'}}
      onMouseDown={() => show_store('options').set(undefined)}>
      <div className="header box">{header()}</div>
      <div className="sidekick">
        <LabelSidekick store={store} taxonomy={state.taxonomy[state.mode]} mode={state.mode} />
      </div>
      <div className="main" onMouseDown={e => Model.deselect(store)}>
        <DropZone
          webserviceURL={config.image_ws_url}
          onDrop={d =>
            advance(() => {
              Model.disconnectBackend(store, () => {
                graph.set(d.graph)
                store.update({
                  mode: d.anon_mode ? Model.modes.anonymization : Model.modes.normalization,
                })
              })
            })
          }>
          {main()}
        </DropZone>
      </div>
      <div className="summary">{Summary(g)}</div>
      <div className="footer box">
        <span style={{opacity: 0.8, fontSize: '0.9em'}}>
          swell-editor{' '}
          <a href="https://github.com/spraakbanken/swell-editor" target="_blank">
            repo
          </a>{' '}
          <a href="https://github.com/spraakbanken/swell-editor/issues" target="_blank">
            issues
          </a>
          {state.essay &&
            state.backend && (
              <span style={{float: 'right', opacity: 0.9}}>
                {`${state.version ? 'revision ' + state.version + ' of' : 'saving'} essay ${
                  state.essay
                } at `}
                <code style={{fontSize: '0.95em'}}>{state.backend}</code>
              </span>
            )}
        </span>
      </div>
    </div>
  )
}

function show_hide_str(b: boolean | undefined) {
  return b ? 'hide ' : 'show '
}

function RestrictionButtons(store: Store<G.Side | undefined>): VNode[] {
  const options = [undefined, ...G.sides]
  const name = (k?: string) => 'view ' + (k === undefined ? 'both sides' : k + ' only')
  return options.map(k => Button(name(k), '', () => store.set(k), store.get() !== k))
}

function ShowMessages(store: Store<Record<string, true>>, transient = false) {
  return record.traverse(store.get(), (_, msg) => (
    <div className={transient ? 'warning' : 'error'} key={msg}>
      {!transient && (
        <Close
          title="dismiss"
          onMouseDown={e => {
            store.via(Lens.key(msg)).set(undefined)
            e.preventDefault()
          }}
        />
      )}

      {msg}
    </div>
  ))
}

function ImageWebserviceAddresses(g: Graph, anon_mode: boolean) {
  const escape = (s: string) =>
    encodeURIComponent(s)
      .replace('(', '%28')
      .replace(')', '%29')
  const data: EditorTypes.Data = EditorTypes.graph_to_data(g, anon_mode)
  const st = EditorTypes.data_to_string(data)
  const url = `${config.image_ws_url}/png?${escape(st)}`
  const md = `![](${url})`
  return (
    <pre
      className={'box pre-box ' + ReactUtils.Unselectable}
      style={{whiteSpace: 'normal', wordBreak: 'break-all', overflowX: 'hidden'}}
      draggable={true}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', md)
      }}>
      {md}
    </pre>
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
