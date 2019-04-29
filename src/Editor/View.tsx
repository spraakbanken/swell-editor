import * as React from 'react'
import {Store, Lens} from 'reactive-lens'
import * as typestyle from 'typestyle'

import * as G from '../Graph'
import * as Utils from '../Utils'
import * as record from '../record'

import * as ReactUtils from '../ReactUtils'
import {Close, Button, VNode} from '../ReactUtils'

import * as Model from './Model'
import {DropZone} from './DropZone'
import * as CM from './CodeMirror'
import {config, label_sort, taxonomy_has_label, label_taxonomy, label_args} from './Config'

import * as EditorTypes from '../EditorTypes'

import {LabelSidekick} from './LabelSidekick'
import * as GV from '../GraphView'

import * as Manual from '../Doc/Manual'
import {Severity} from './Validate'
import {anonymize_when, anonfixGraph, is_anon_label} from './Anonymization'

typestyle.cssRaw(`
body > div {
  height: 100%
}
`)

const header_height = '32px'
const footer_height = '26px'

const topStyle = typestyle.style({
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
  / 185px     3fr    minmax(180px, 1fr)
  `,
  minHeight: '100%',

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
      position: 'sticky',
      top: 0,
      zIndex: 20,
      paddingBottom: '5px',
      marginBottom: '5px',
    },
    '& .sidekick > div': {
      top: `${header_height}`,
    },
    '& .content': {
      height: '100%',
    },
    '& .footer': {
      position: 'sticky',
      bottom: 0,
      zIndex: 20,
    },
    '& .menu .box': {
      position: 'absolute',
      top: header_height,
      right: 0,
      zIndex: 100,
      maxWidth: '180px',
    },
    '& .menu button': {
      appearance: 'none',
      '-moz-appearance': 'none',
      '-webkit-appearance': 'none',
      borderWidth: 0,
      background: 'none',
      display: 'block',
      width: '100%',
      textAlign: 'left',
      margin: 0,
      padding: '.2em',
      $nest: {
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, .1)',
        },
        '&:disabled': {
          opacity: 0.5,
        },
        '&:disabled:hover': {
          backgroundColor: 'inherit',
        },
      },
    },
    '& .CodeMirror, & textarea': {
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
    '& pre': {
      whiteSpace: 'pre-wrap',
    },
    '& .doc img': {
      maxWidth: '100%',
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
    '& .graphView': {
      position: 'relative',
      overflowY: 'auto',
      resize: 'vertical',
      marginTop: '1em',
    },
    '& .graphView ul': {
      zIndex: 10,
      cursor: 'pointer',
    },
    '& .Selectable': {
      padding: '2px',
      border: '1px solid transparent',
      borderRadius: '3px',
    },
    '& .hovering .hover .Selectable:not(.Selected), & .hovering path.hover, & .hovering .hover path': {
      background: '#8882',
    },
    '& .Selected': {
      background: 'hsla(220,65%,65%, .3)',
      borderColor: 'hsl(220,65%,65%)',
    },
    [`& .cm-hovering span.hover:not(.${CM.SelectedMarkClassName})`]: {
      background: '#8882',
    },
    [`& .${CM.SelectedMarkClassName}`]: {
      background: 'hsla(220,65%,65%, .3)',
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
    '& .comment-pane textarea': {
      display: 'block',
      width: '100%',
      resize: 'vertical',
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

export function View(store: Store<Model.State>, cms: Record<G.Side, CM.CMVN>): VNode {
  const state = store.get()
  const graph = Model.graphStore(store)
  const readonly = Model.is_target_readonly(state.mode)

  const visibleGraph = Model.visibleGraph(store)

  const advance = Model.make_history_advance_function(store)

  const manual_page = state.manual !== undefined && Manual.manual[state.manual]

  store.at('hover_id').ondiff(hover_id => {
    const graphViewElement = document.querySelector<HTMLElement>('.graphView')
    if (!graphViewElement) return
    const edgeElement = graphViewElement.querySelector<HTMLElement>(`[data-edge=${hover_id}]`)
    edgeElement && Utils.scrollIntoView(graphViewElement, edgeElement)
  })

  const manual_part = () =>
    manual_page && (
      <div className="main" style={{minHeight: '18em'}}>
        {Manual.slugs.map(slug => (
          <span key={slug}>
            {state.manual === slug ? (
              slug.replace('_', ' ')
            ) : (
              <ReactUtils.A
                title={slug.replace('_', ' ')}
                text={slug.replace('_', ' ')}
                onMouseDown={e => {
                  e.stopPropagation()
                  Model.setManualTo(store, slug)
                }}
              />
            )}{' '}
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
                const m = anonymize_when(page.mode == 'anonymization')
                return (
                  <React.Fragment>
                    {page.text}
                    <i>Initial view:</i>
                    <div className={Model.is_target_readonly(page.mode) ? ' NoManualBlue' : ''}>
                      <GV.GraphView graph={m(page.graph, store.at('pseudonyms'))} />
                    </div>
                    <i>Target view:</i>
                    <div className={Model.is_target_readonly(page.mode) ? ' NoManualBlue' : ''}>
                      <GV.GraphView graph={m(page.target, store.at('pseudonyms'))} />
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
    // Limit the rich diff to the visible graph.
    const rich_diff = state.rich_diff && state.rich_diff.filter(d => visible_graph.edges[d.id])
    const units = Model.compactStore(store)
    const label_mode = (mode: string, label: string) =>
      G.is_comment_label(label) ||
      (mode == Model.modes.anonymization ? is_anon_label(label) : taxonomy_has_label(mode, label))

    return (
      <div className="content">
        {ShowErrors(store.at('errors'))}
        {manual_part()}
        {state.show.source_text && (
          <div className="TopPad">
            <em>Source text:</em>
            <div className={hovering ? 'cm-hovering' : ''}>{cms.source.node}</div>
            <div>
              {!!state.backend ||
                Button('copy to target', '', () =>
                  advance(() => graph.modify(g => G.init_from(G.source_texts(g))))
                )}
            </div>
          </div>
        )}
        {state.show.target_text && (
          <div className="TopPad">
            <em>Target text:</em>
            <div className={hovering ? 'cm-hovering' : ''}>{cms.target.node}</div>
          </div>
        )}
        <div
          className={'vsep' + (hovering ? ' hovering' : '') + (readonly ? ' NoManualBlue' : '')}
          style={{minHeight: '10em'}}>
          <GV.GraphView
            mode={state.mode}
            side={state.side_restriction}
            orderChangingLabel={s => config.order_changing_labels[s]}
            graph={visible_graph}
            richDiff={rich_diff}
            hoverId={state.hover_id}
            onHover={hover_id => store.update({hover_id})}
            selectedIds={Object.keys(state.selected)}
            generation={state.generation}
            labelMode={label_mode}
            labelSort={label_sort}
            onSelect={(ids, only) => Model.onSelect(store, ids, only)}
          />
        </div>
        {state.show.validation && ShowMessages(store)}
        {state.show.image_link && ImageWebserviceAddresses(visible_graph, Model.inAnonMode(state))}
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
        {state.doc && (
          <div className="box doc">
            <Close onMouseDown={() => store.at('doc').set(undefined)} title="Close" />
            {Button('open in new window', '', () => {
              window.open(state.doc)
              store.at('doc').set(undefined)
            })}
            {state.doc_node && <div dangerouslySetInnerHTML={{__html: state.doc_node.outerHTML}} />}
          </div>
        )}
      </div>
    )
  }

  const show_store = (show: Model.Show) => store.at('show').via(Lens.key(show))

  function header() {
    const history = Model.history(store)

    const toggle = (show: Model.Show) => show_store(show).modify(b => (b ? undefined : true))

    const toggle_button = (show: Model.Show, enabled?: boolean, label = show.replace('_', ' ')) =>
      Button(show_hide_str(state.show[show]) + label, '', () => toggle(show), enabled, true)

    const exit_reanonymization = (mode: Model.Mode) => {
      // The done status needs to go from false to true at validation.
      const real_done = store.at('done').get()
      store.at('done').set(false)
      // Overwrite source tokens, then save.
      Model.validation_transaction(store, s => {
        s.at('done').set(true)
        s
          .at('graph')
          .at('now')
          .set(anonfixGraph(Model.visibleGraph(store)))
      })
      const validation_success = store.at('done').get()
      store.at('done').set(real_done)
      if (validation_success) {
        Model.save(store)
        Model.report(store, 'Anonymization changed during ' + mode)
        // After save, switch mode.
        const unsub = store.at('version').ondiff(() => {
          store.at('mode').set(mode)
          unsub()
        })
      }
    }

    const mode_switcher = (mode: Model.Mode, enable_in_any_mode: boolean = false) =>
      Button(
        `switch to ${Model.mode_label(mode)}`,
        '',
        Model.inAnonfixMode(state)
          ? () => exit_reanonymization(mode)
          : () => store.at('mode').set(mode),
        state.mode !== mode && (!state.backend || state.start_mode == mode || enable_in_any_mode)
      )

    return (
      <React.Fragment>
        <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
          <div>
            {Button('undo', '', history.undo, history.canUndo())}
            {Button('redo', '', history.redo, history.canRedo())}
          </div>
          <div style={{fontWeight: 'bold'}}>
            Svala {Model.mode_label(state.mode)} {state.essay ? `– essay ${state.essay}` : ''}
          </div>
          <div>
            {!!state.backurl && (
              <a
                style={{margin: '3px 8px', fontSize: '0.9em', opacity: 0.8}}
                href={state.backurl}
                onClick={e => {
                  Model.validateState(store, true)
                  const messages = store.at('validation_messages').get()
                  if (
                    messages.length &&
                    !confirm(messages.map(m => m.message).join('\n') + '\n\nLeave anyway?')
                  ) {
                    e.preventDefault()
                  }
                }}>
                back
              </a>
            )}
            {state.done !== undefined &&
              !Model.inAnonfixMode(state) &&
              Button(state.done ? 'not done' : 'done', 'toggle between done and not done', () =>
                Model.validation_transaction(store, s => s.at('done').modify(b => !b))
              )}
            {toggle_button('options')}
          </div>
        </div>
        {state.show.options && (
          <div className="menu">
            <div className="box">
              {toggle_button('source_text')}
              {toggle_button('target_text')}
              {RestrictionButtons(store.at('side_restriction'))}
              {Button('fit graph', 'adjust the height of the graph view', () => fitGraph())}
              {Button(
                'show full graph',
                'render the full graph (may be slow, please have patience)',
                () => {
                  store.transaction(() => {
                    Model.setSelection(store, [])
                    Model.setSubspanIncluding(store, [])
                  })
                }
              )}
              <hr />
              {Button('validate', '', () => Model.validateState(store, true))}
              {mode_switcher(Model.modes.anonymization, true)}
              {mode_switcher(Model.modes.normalization)}
              {mode_switcher(Model.modes.correctannot)}
              <hr />
              {toggle_button('graph')}
              {toggle_button('diff')}
              {toggle_button('image_link')}
              {// Examples destroy essays.
              toggle_button('examples', !state.backend)}
              <hr />
              {config.docs[state.mode] &&
                record.traverse(config.docs[state.mode], (url, label) =>
                  Button(`view ${label}`, '', () => store.at('doc').set(url))
                )}
              {Button(
                state.manual === undefined ? 'manual' : 'exit manual',
                'toggle showing manual',
                () => Model.setManualTo(store, state.manual ? undefined : 'manual')
              )}
            </div>
          </div>
        )}
      </React.Fragment>
    )
  }

  const selected_edges = G.token_ids_to_edges(visibleGraph, Object.keys(store.get().selected))
  const selected_only_edge = selected_edges.length === 1 ? selected_edges[0] : undefined
  const selected_only_source = selected_only_edge
    ? G.partition_ids(visibleGraph)(selected_only_edge.ids).source[0].id
    : undefined

  return state.manual === 'print' ? (
    full_manual()
  ) : (
    <div
      className={topStyle}
      style={{position: 'relative'}}
      onMouseDown={() => show_store('options').set(undefined)}>
      <div className="header box">{header()}</div>
      <div className="sidekick">
        <LabelSidekick
          store={store}
          taxonomy={state.taxonomy[state.mode]}
          mode={state.mode}
          extraInput={
            selected_only_edge &&
            selected_only_source &&
            selected_only_edge.labels.some(l => !!label_args[l])
              ? {
                  get: () => {
                    const args = store.get().pseudonym_args[selected_only_source]
                    return args ? args.join(' ') : undefined
                  },
                  set: (value: string) => {
                    store.at('pseudonym_args').update({[selected_only_source]: value.split(' ')})
                  },
                }
              : undefined
          }
        />
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
      {Summary(store)}
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

/** Auto-size the spaghetti. */
function fitGraph() {
  const gv = document.querySelector('.graphView') as HTMLElement | null
  const footer = document.querySelector('.footer') as HTMLElement | null
  if (!gv || !footer) return
  // Pull spaghetti bottom down to wrapper bottom.
  // Subtracting a few pixels is necessary for some reason.
  gv.style.height = `${window.innerHeight - footer.offsetHeight - gv.offsetTop - 5}px`
}

function show_hide_str(b: boolean | undefined) {
  return b ? 'hide ' : 'show '
}

function RestrictionButtons(store: Store<G.Side | undefined>): VNode[] {
  return G.sides.map(k =>
    Button(
      show_hide_str(store.get() !== G.opposite(k)) + `${k} in graph`,
      '',
      // Undefined means show both.
      () => store.set(store.get() === undefined ? G.opposite(k) : undefined),
      store.get() !== k
    )
  )
}

function ShowErrors(store: Store<Record<string, true>>) {
  return record.traverse(store.get(), (_, msg) => (
    <div className="error" key={msg}>
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

function ShowMessages(store: Store<Model.State>) {
  const messageStore = store.at('validation_messages')
  return messageStore.get().map((message, i) => (
    <div className={message.severity} key={i}>
      {// Errors should prevent action, so error messages indicate an error that has not actually happened.
      // They will disappear on the next validation, but we should also let the user dismiss them manually.
      message.severity == Severity.ERROR && (
        <Close
          title="dismiss"
          onMouseDown={e => {
            messageStore.modify(ms => ms.slice(0, i).concat(ms.slice(i + 1)))
            e.preventDefault()
          }}
        />
      )}

      {message.message}

      {String(message.subject).indexOf('e-') === 0 && <span>: {Edge(store, message.subject)}</span>}
    </div>
  ))
}

function Summary(store: Store<Model.State>) {
  return (
    <div className="summary">
      {ShowComments(store)}
      {store.get().mode === Model.modes.anonymization
        ? LabelUsage(store, l => /^\d+$/.test(l), 'source')
        : LabelUsage(store, l => label_taxonomy(l) !== Model.modes.anonymization)}
    </div>
  )
}

function ShowComments(store: Store<Model.State>) {
  const g = Model.currentGraph(store)
  const setGraphComment = Utils.debounce(1000, (comment: string) =>
    Model.graphStore(store).modify(g => G.set_comment(g, comment))
  )
  const setEdgeComment = Utils.debounce(1000, (edgeId: string, comment: string) =>
    Model.graphStore(store).modify(g => G.comment_edge(g, edgeId, comment))
  )
  if (G.empty(g)) return null
  return (
    <div>
      <div className="comment-pane box vsep">
        <p>Document comment:</p>
        <textarea
          // Prevent refocusing to label filter field.
          className={'keepfocus'}
          // Avoid deselecting.
          onMouseDown={ev => ev.stopPropagation()}
          onChange={ev => setGraphComment(ev.target.value)}
          defaultValue={g.comment}
        />
      </div>
      {G.token_ids_to_edges(g, Object.keys(store.at('selected').get()))
        .filter(edge => edge.labels.some(G.is_comment_label))
        .map(edge => (
          <div className="comment-pane box vsep" key={edge.id}>
            <p>Edge comment:</p>
            <textarea
              className={'keepfocus'}
              onMouseDown={ev => ev.stopPropagation()}
              onChange={ev => setEdgeComment(edge.id, ev.target.value)}
              defaultValue={edge.comment}
            />
          </div>
        ))}
    </div>
  )
}

function ImageWebserviceAddresses(g: G.Graph, anon_mode: boolean) {
  const escape = (s: string) =>
    encodeURIComponent(s)
      .replace('(', '%28')
      .replace(')', '%29')
  const data: EditorTypes.Data = EditorTypes.graph_to_data(g, anon_mode)
  const st = EditorTypes.data_to_string(data)
  const url = `${config.image_ws_url}/png?${escape(st)}`
  return (
    <pre
      className={'box pre-box'}
      style={{whiteSpace: 'normal', wordBreak: 'break-all', overflowX: 'hidden'}}>
      {url}
    </pre>
  )
}

/** Lists edges for each label in use. */
export function LabelUsage(
  store: Store<Model.State>,
  label_filter?: (l: string) => boolean,
  side?: G.Side
) {
  const g = Model.currentGraph(store)
  const obs_class = (labels: string[]) => (labels.some(l => -1 != l.indexOf('!')) ? ' OBS ' : '')
  return (
    <div>
      {record.traverse(
        G.label_edge_map(g, label_filter),
        (es, label) => (
          <div key={label} className="box vsep">
            <div className={GV.BorderCell + obs_class([label])}>
              <div>{label}</div>
            </div>
            <ul>{es.map(e => <li key={e.id}>{Edge(store, e.id, side)}</li>)}</ul>
          </div>
        ),
        true
      )}
    </div>
  )
}

/** Visualizes an edge. */
export function Edge(store: Store<Model.State>, id: string, side?: G.Side) {
  const g = Model.currentGraph(store)
  const in_edge = (t: G.Token) => g.edges[id].ids.includes(t.id)
  const tokens = {
    source: g.source.filter(in_edge),
    target: g.target.filter(in_edge),
  }
  const tids = side ? tokens[side].map(t => t.id) : g.edges[id].ids
  return (
    <span
      onClick={() => Model.setSelection(store, tids)}
      style={{cursor: 'pointer', textDecoration: 'underline'}}>
      {side
        ? G.text(tokens[side])
        : `${G.text(tokens.source).trim()}—${G.text(tokens.target).trim()}`}
    </span>
  )
}
