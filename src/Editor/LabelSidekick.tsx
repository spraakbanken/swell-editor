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
import {Button, showhide} from '../ReactUtils'

import {State} from './Model'
import * as Model from './Model'
import {DropZone} from './DropZone'
import * as CM from './CodeMirror'
import {config, Taxonomy} from './Config'

const LabelSidekickStyle = style({
  ...Utils.debugName('LabelSidekickStyle'),

  $nest: {
    '& .entry': {
      cursor: 'pointer',
      padding: '0 5px',
    },
    '& .cursor': {
      background: '#c2e0ff',
      borderRadius: 5,
      padding: '0 5px',
    },
    '& .selected': {
      color: 'blue',
      fontWeight: 700,
    },
    '& ul ul': {
      paddingLeft: 10,
      marginRight: 5,
      marginLeft: 0,
    },
    '&': {
      zIndex: 2,
      position: 'relative',
      marginRight: '10px',
      margin: 0,
      padding: 1,
    },
    '& > * > button': {
      fontSize: '0.85em',
      width: '47%',
      marginBottom: '5px',
    },
    '& li button': {
      fontSize: '0.85em',
      width: '30px',
    },
  },
})

interface DropdownProps {
  taxonomy: Taxonomy
  selected: string[]
  onChange(label: string, value: boolean): void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}
interface DropdownState {
  cursor: number
}

export class Dropdown extends React.Component<DropdownProps, DropdownState> {
  constructor(props: DropdownProps) {
    super(props)
    this.state = {
      cursor: 0,
    }
  }

  render() {
    const props = this.props
    const {taxonomy, selected} = this.props
    const {cursor} = this.state
    const labels = Utils.flatMap(taxonomy, g => g.entries.map(e => e.label))

    function isSelected(l: string) {
      return selected.some(s => s === l)
    }

    function isDigit(l: string) {
      return /^\d+$/.test(l)
    }

    function set(l: string) {
      props.onChange(l, true)
    }

    function unset(l: string) {
      props.onChange(l, false)
    }

    function toggle(l: string) {
      if (isSelected(l)) {
        unset(l)
      } else {
        set(l)
      }
    }

    function wrap(c: number) {
      const N = labels.length
      return (c + N) % N
    }

    function new_cursor(base: number, sign: 1 | -1 = 1, m = /.*/): number {
      for (let i = 0; i < labels.length; i++) {
        const c = wrap(base + i * sign)
        if (m.test(labels[c])) {
          return c
        }
      }
      return cursor
    }

    const liberal_re = (s: string) => new RegExp(Utils.str_map(s, c => c + '-?').join(''), 'i')

    const input = (
      <input
        ref={e => e && e.focus()}
        placeholder="Enter label..."
        onKeyDown={e => {
          const t = e.target as HTMLInputElement
          if (e.key === 'Enter' || e.key === ' ') {
            if (isDigit(t.value)) {
              toggle(t.value)
              t.value = ''
            } else {
              toggle(labels[cursor])
              t.value = ''
            }
            e.preventDefault()
          } else if (e.key === 'Backspace') {
            if (t.value == '' && selected.length > 0) {
              unset(selected[selected.length - 1])
            }
          } else if (e.key === 'ArrowDown') {
            this.setState({cursor: new_cursor(cursor + 1, 1)})
            e.preventDefault()
          } else if (e.key === 'ArrowUp') {
            this.setState({cursor: new_cursor(cursor - 1, -1)})
            e.preventDefault()
          } else if (e.key === 'Tab') {
            this.setState({cursor: new_cursor(cursor + 1, 1, liberal_re(t.value))})
            e.preventDefault()
          } else if (!e.altKey && !e.ctrlKey && !e.metaKey) {
            this.setState({cursor: new_cursor(cursor, 1, liberal_re(t.value + e.key))})
          }
          this.props.onKeyDown && this.props.onKeyDown(e)
        }}
      />
    )

    const entry_span = (label: string, c?: number) => {
      const classes = (cursor == c ? ' cursor' : '') + (isSelected(label) ? ' selected' : '')
      return (
        <span
          className={'entry' + classes}
          onMouseOver={evt => c && this.setState({cursor: c})}
          onMouseDown={e => {
            toggle(label)
            e.preventDefault()
          }}>
          {label}
        </span>
      )
    }

    const list = Utils.expr(() => {
      let c = 0
      return (
        <ul>
          {selected.filter(isDigit).map(i => <li key={'d' + i}>{entry_span(i + '')}</li>)}
          {taxonomy.map((g, i) => (
            <li key={i}>
              <b>{g.group}</b>
              <ul>
                {g.entries.map((e, i) => {
                  return (
                    <li key={i} title={e.desc}>
                      {entry_span(e.label, c++)}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )
    })

    return (
      <React.Fragment>
        {input}
        {list}
      </React.Fragment>
    )
  }
}

export function LabelSidekick({store, taxonomy}: {store: Store<State>; taxonomy: Taxonomy}) {
  const graph = store.at('graph').at('now')
  const selected = Object.keys(store.get().selected)
  const advance = Model.make_history_advance_function(store)
  if (selected.length > 0) {
    const edges = G.token_ids_to_edges(graph.get(), selected)
    const edge_ids = edges.map(e => e.id)
    const labels = Utils.uniq(Utils.flatMap(edges, e => e.labels))
    return (
      <div
        className={'left tall sidekick box ' + LabelSidekickStyle + ' ' + ReactUtils.clean_ul}
        onMouseDown={e => {
          e.stopPropagation()
          e.preventDefault()
        }}>
        <div>
          {Model.onSelectedActions.map(action =>
            Button(
              Model.actionButtonNames[action],
              Model.actionDescriptions[action] + `\n\nShortcut: ${Model.actionKeyboard[action]}`,
              () => Model.performAction(store, action)
            )
          )}
        </div>
        <Dropdown
          taxonomy={taxonomy}
          selected={labels}
          onChange={(label, value) =>
            advance(() =>
              edge_ids.forEach(id =>
                graph.modify(g =>
                  G.modify_labels(g, id, labels => Utils.set_modify(labels, label, value))
                )
              )
            )
          }
          onKeyDown={e => {
            const key = (e.altKey || e.metaKey ? 'Alt-' : '') + (e.shiftKey ? 'Shift-' : '') + e.key
            const action = record.reverse_lookup(Model.actionKeyboard, key)
            if (action) {
              Model.performAction(store, action)
            }
            e.preventDefault()
          }}
        />
      </div>
    )
  }
  return null
}
