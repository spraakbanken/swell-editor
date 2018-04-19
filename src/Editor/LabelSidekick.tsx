import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'
import {style} from 'typestyle'
import * as csstips from 'csstips'

import {Graph} from '../Graph'
import * as G from '../Graph'
import * as Utils from '../Utils'

import {VNode} from '../ReactUtils'
import * as ReactUtils from '../ReactUtils'
import {Close, Button, showhide} from '../ReactUtils'

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
  onChange(selected: string[]): void
  onBlur(): void
}
interface DropdownState {
  input: string
  cursor: number
}

export class Dropdown extends React.Component<DropdownProps, DropdownState> {
  constructor(props: DropdownProps) {
    super(props)
    this.state = {
      input: '',
      cursor: 0,
    }
  }

  render() {
    const props = this.props
    const {taxonomy, selected} = this.props
    const {input, cursor} = this.state
    const labels = Utils.flatMap(taxonomy, g => g.entries.map(e => e.label))

    function isSelected(l: string) {
      return selected.some(s => s === l)
    }

    function isDigit(l: string) {
      return /^\d+$/.test(l)
    }

    function set(l: string) {
      props.onChange(Utils.uniq([...selected, l]))
    }

    function unset(l: string) {
      props.onChange(selected.filter(s => s != l))
    }

    function toggle(l: string) {
      if (isSelected(l)) {
        unset(l)
      } else {
        set(l)
      }
    }

    function curse(d: number, c: number, m = /.*/): number {
      console.log(d, c, m.test(labels[c]))
      if (labels.length == 0) {
        return 0
      } else if (c < 0) {
        return curse(d, labels.length - 1, m)
      } else if (c >= labels.length) {
        return curse(d, 0, m)
      } else if (d + c === cursor) {
        // full circle, give up
        return cursor
      } else if (!m.test(labels[c])) {
        // isSelected(labels[c])) {
        return curse(d, c + d, m)
      } else {
        return c
      }
    }

    let c = 0

    const entry_span = (label: string, c?: number) => {
      const cls =
        'entry' + (cursor == c ? ' cursor ' : '') + (isSelected(label) ? ' selected ' : '')
      return (
        <span
          className={cls}
          onMouseOver={evt => c && this.setState({cursor: c})}
          onClick={e => {
            toggle(label)
            e.preventDefault()
          }}>
          {label}
        </span>
      )
    }

    return (
      <React.Fragment>
        <input
          ref={e => e && e.focus()}
          placeholder="Enter label..."
          onKeyDown={e => {
            console.log(e.key)
            const t = e.target as HTMLInputElement
            if (e.key === 'Enter' || e.key === ' ') {
              if (isDigit(t.value)) {
                toggle(t.value)
              } else {
                toggle(labels[cursor])
                t.value = ''
              }
            }
            if (e.key === 'Escape') {
              props.onBlur()
            }
            if (e.key === 'Backspace' && t.value == '' && labels.length > 0) {
              unset(labels[cursor])
            }
            if (e.key === 'ArrowDown') {
              this.setState({cursor: curse(1, cursor + 1)})
              e.preventDefault()
            } else if (e.key === 'ArrowUp') {
              this.setState({cursor: curse(-1, cursor - 1)})
              e.preventDefault()
            } else {
              this.setState({cursor: curse(1, cursor, new RegExp(t.value + e.key, 'i'))})
            }
          }}
        />
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
      </React.Fragment>
    )
  }
}

export function LabelSidekick({
  store,
  onBlur,
  taxonomy,
}: {
  store: Store<State>
  onBlur: () => void
  taxonomy: Taxonomy
}) {
  const advance = Model.make_history_advance_function(store)
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
      <div
        className={'left tall sidekick box ' + LabelSidekickStyle + ' ' + ReactUtils.clean_ul}
        onClick={e => console.log('stop') || e.stopPropagation()}>
        <div>
          {Model.onSelectedActions.map(action =>
            Button(action, '', () =>
              advance(() => graph.modify(g => Model.act_on_selected[action](g, selected)))
            )
          )}
          {Button('deselect', '', () => Model.deselect(store))}
        </div>
        <Dropdown
          taxonomy={taxonomy}
          selected={labels}
          onChange={labels =>
            advance(() =>
              edge_ids.forEach(id => graph.modify(g => G.modify_labels(g, id, () => labels)))
            )
          }
          onBlur={() => Model.deselect(store)}
        />
      </div>
    )
  }
  return null
}
