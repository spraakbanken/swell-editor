import * as React from 'react'
import {Store} from 'reactive-lens'
import {style} from 'typestyle'

import * as G from '../Graph'
import * as Utils from '../Utils'
import * as record from '../record'

import * as ReactUtils from '../ReactUtils'

import * as Model from './Model'
import {Taxonomy, label_order, LabelOrder} from './Config'

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
      zIndex: 20,
      position: ['-webkit-sticky', 'sticky'],
      top: 0,
      marginRight: '10px',
      margin: 0,
      padding: 1,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '92vh',
    },
    '& > * > button': {
      width: '47%',
      marginBottom: '5px',
    },
    '& .taxonomy': {
      overflowY: 'auto',
    },
  },
})

interface DropdownProps {
  taxonomy: Taxonomy
  selected: string[]
  onChange(label: string, value: boolean): void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  mode: Model.Mode
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
    const {taxonomy, selected, mode} = this.props
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
        <ul className="taxonomy" ref="taxonomy">
          {props.mode == Model.modes.anonymization &&
            selected.filter(isDigit).map(i => <li key={'d' + i}>{entry_span(i + '')}</li>)}
          {taxonomy.map((g, i) => (
            <li key={i}>
              <b>{g.group}</b>
              <ul>
                {g.entries.map((e, i) => {
                  return (
                    <li ref={'tax_item' + c} key={i} title={e.desc}>
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
    const scrollToCursor = (cursor: number) => {
      const parent = this.refs['taxonomy'] as any
      const height = parent.clientHeight + parent.scrollTop
      const parentTop = parent.offsetTop
      const offsetTop = (this.refs['tax_item' + cursor] as any).offsetTop - parentTop

      if (offsetTop + 50 > height) {
        parent.scrollTop = offsetTop
      } else if (offsetTop - 30 < parent.scrollTop) {
        parent.scrollTop = offsetTop - 30
      }
    }

    const input = (
      <input
        ref={e => {
          if (e && !['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) {
            const x = window.scrollX
            const y = window.scrollY
            e.focus()
            window.scrollTo(x, y)
          }
        }}
        placeholder={
          mode == Model.modes.anonymization ? 'Filter / numeric label' :  'Enter filter text'
        }
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
            const c = new_cursor(cursor + 1, 1)
            this.setState({cursor: c})
            scrollToCursor(c)
            e.preventDefault()
          } else if (e.key === 'ArrowUp') {
            const c = new_cursor(cursor - 1, -1)
            this.setState({cursor: c})
            scrollToCursor(c)
            e.preventDefault()
          } else if (e.key === 'Tab') {
            if (e.shiftKey) {
              const c = new_cursor(cursor - 1, -1, liberal_re(t.value))
              this.setState({cursor: c})
              scrollToCursor(c)
            } else {
              const c = new_cursor(cursor + 1, 1, liberal_re(t.value))
              this.setState({cursor: c})
              scrollToCursor(c)
            }
            e.preventDefault()
          } else if (!e.altKey && !e.ctrlKey && !e.metaKey) {
            const c = new_cursor(cursor, 1, liberal_re(t.value + e.key))
            scrollToCursor(c)
            this.setState({cursor: c})
          }
          this.props.onKeyDown && this.props.onKeyDown(e)
        }}
      />
    )

    return (
      <React.Fragment>
        {input}
        {list}
      </React.Fragment>
    )
  }
}

export function LabelSidekick({
  store,
  taxonomy,
  mode,
}: {
  store: Store<Model.State>
  taxonomy: Taxonomy
  mode: Model.Mode
}) {
  const graph = store.at('graph').at('now')
  const selected = Object.keys(store.get().selected)
  const advance = Model.make_history_advance_function(store)
  if (selected.length > 0) {
    const edges = G.token_ids_to_edges(graph.get(), selected)
    const labels = Utils.uniq(Utils.flatMap(edges, e => e.labels))
    return (
      <div
        className={
          'sidekick box ' + LabelSidekickStyle + ' ' + ReactUtils.clean_ul + ' ' + 'mode-' + mode
        }
        onMouseDown={e => {
          e.stopPropagation()
          e.preventDefault()
        }}>
        <div>
          {Model.actionButtons[mode].map(action =>
            ReactUtils.Button(
              Model.actionButtonNames[action],
              Model.actionDescriptions[action] + `\n\nShortcut: ${Model.actionKeyboard[action]}`,
              () => Model.performAction(store, action)
            )
          )}
        </div>
        <Dropdown
          taxonomy={taxonomy}
          selected={labels}
          mode={mode}
          onChange={(label, value) =>
            Model.validation_transaction(store, store =>
              advance(() => {
                Model.setLabel(store, selected, label, value)
              })
            )
          }
          onKeyDown={e => {
            const key = (e.altKey || e.metaKey ? 'Alt-' : '') + (e.shiftKey ? 'Shift-' : '') + e.key
            const action = record.reverse_lookup(Model.actionKeyboard, key)
            if (action) {
              Model.performAction(store, action)
            }
            // e.preventDefault()
          }}
        />
      </div>
    )
  }
  return null
}
