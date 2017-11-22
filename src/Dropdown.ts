import { VNode, tag, Content as S } from "snabbis"
import { Hooks } from 'snabbdom/hooks';
import { C, c } from "./Classes"
import { Store } from "reactive-lens"
import { div, InputField } from "./Snabbdom"
import * as typestyle from "typestyle"
import * as Utils from "./Utils"

export type Active = string[]

export interface State {
  input: string,
  cursor: number | undefined,
  active: Store<Active> | undefined
}

export const init: State = {
  input: '',
  cursor: undefined,
  active: undefined
}

export interface Group {
  label: string,
  choices: Alt[],
  unavailable?: boolean
}

export interface Alt {
  value: string,
  label: string
  unavailable?: boolean,
  index?: number
}

// Sets the unavailable flag accoring to the filter, and also sets indexes on all alts
export function Filter(input: string, active: Active, groups: Group[]): Group[] {
  let ix = 0
  return groups.map(g => {
    const choices = g.choices.map(alt => {
      const index = ix++
      return {
        ...alt,
        unavailable:
          active.some(x => x == alt.value) ||
          (    -1 == alt.value.replace('-','').toLowerCase().indexOf(input.replace('-','').toLocaleLowerCase())
          ),
  //          && -1 == alt.label.replace('-','').toLowerCase().indexOf(input.replace('-','').toLocaleLowerCase())),
        index
      }
    })
    return {...g, choices, unavailable: choices.every(ch => ch.unavailable == true)}
  })
}

export function Index(cursor: number, groups: Group[]): Alt | undefined {
  let ix = 0
  let out = undefined as Alt | undefined
  groups.forEach(g =>
    g.choices.forEach(alt => {
      if (cursor == ix++ && alt.unavailable == false) {
        out = alt
      }
    }))
  return out
}

export function Next(cursor: number, groups: Group[]): number | undefined {
  let ix = 0
  let out = undefined as number | undefined
  groups.forEach(g =>
    g.choices.forEach(alt => {
      const i = ix++
      if (i > cursor && alt.unavailable == false && out === undefined) {
        out = i
      }
    }))
  return out
}

export function Prev(cursor: number, groups: Group[]): number | undefined {
  let ix = 0
  let out = undefined as number | undefined
  groups.forEach(g =>
    g.choices.forEach(alt => {
      const i = ix++
      if (i < cursor && alt.unavailable == false) {
        out = i
      }
    }))
  return out
}

const cl  = {
  containerOuter: S.classed('choices'),
  containerInner: S.classed('choices__inner'),
  input: S.classed('choices__input'),
  inputCloned: S.classed('choices__input--cloned'),
  list: S.classed('choices__list'),
  listItems: S.classed('choices__list--multiple'),
  listSingle: S.classed('choices__list--single'),
  listDropdown: S.classed('choices__list--dropdown'),
  item: S.classed('choices__item'),
  itemSelectable: S.classed('choices__item--selectable'),
  itemDisabled: S.classed('choices__item--disabled'),
  itemChoice: S.classed('choices__item--choice'),
  placeholder: S.classed('choices__placeholder'),
  group: S.classed('choices__group'),
  groupHeading: S.classed('choices__heading'),
  button: S.classed('choices__button'),
  activeState: S.classed('is-active'),
  focusState: S.classed('is-focused'),
  openState: S.classed('is-open'),
  disabledState: S.classed('is-disabled'),
  highlightedState: S.classed('is-highlighted'),
  hiddenState: S.classed('is-hidden'),
  flippedState: S.classed('is-flipped'),
  loadingState: S.classed('is-loading'),
}

export function Handler(store: Store<State>): () => void {
  return () => { return }
  const input = store.at('input')
  return input.ondiff(s => {
    if (s.endsWith(',') || s.endsWith(' ')) {
      input.transaction(() => {
        const active = store.get().active
        if (active !== undefined) {
          Utils.array_store_key(active, s.slice(0, s.length - 1)).set(true)
        }
        input.set('')
      })
    }
  })
}

// this should be thunked on the store
export function Dropdown(store: Store<State>, groups: Group[], obtain: (inp: HTMLInputElement | undefined) => void): VNode {
  const active = store.at('active').get()
  if (!active) {
    return div()
  } else {
    const at_key = (k: string) => Utils.array_store_key(active, k)
    const cursor = store.at('cursor')
    const input = store.at('input')
    const active_groups = () => {
      const j = Filter(input.get(), active.get(), groups)
      return j
    }
    let inp = undefined as undefined | HTMLInputElement
    return div(
      C.DropdownZIndexFix,
      cl.containerOuter,
      div(cl.containerInner,
        div(cl.list, cl.listItems,
          active.get().map((s: string) =>
            div(cl.item, s,
              C.Pointer,
              C.Unselectable,
              S.on('click')(() => at_key(s).set(false))
            )
          ),
          InputField(input,
            cl.input,
            S.attrs({autofocus: true}),
            S.hook({
              postpatch: (_, vn: VNode) => {
                inp = vn.elm as any
                obtain(inp)
              }
            }),
            S.on('keydown')((e: KeyboardEvent) => {
              let x = cursor.get()
              console.log('keydown', {x}, e.code, e.keyCode, e.charCode)
              if (x === undefined) {
                x = Next(-1, active_groups())
              }
              console.log({x}, active_groups())
              if (x !== undefined && e.code == 'ArrowDown') {
                cursor.set(Next(x, active_groups()))
              }
              if (x !== undefined && e.code == 'ArrowUp') {
                cursor.set(Prev(x, active_groups()))
              }
              if (e.code == 'Enter') {
                store.transaction(() => {
                  input.set('')
                  cursor.set(undefined)
                  console.log('enter', x)
                  if (x !== undefined) {
                    const alt = Index(x, active_groups())
                    console.log('alt', alt, active_groups())
                    alt && at_key(alt.value).set(true)
                  }
                })
              }
              if (e.code == 'Backspace') {
                if (input.get() == '') {
                  Store.arr(active, 'pop')()
                }
              }
            }),
          ),
        ),
        div(cl.list, cl.listDropdown, cl.activeState,
          Utils.flatMap(Filter(input.get(), active.get(), groups), group =>
            group.unavailable ? [] : [
              div(cl.group, div(cl.groupHeading, group.label),
              ...group.choices.map(alt =>
                  alt.unavailable ||
                  div(cl.item, cl.itemSelectable,
                    S.style('padding', '6px'),
                    alt.index == cursor.get() && cl.highlightedState,
                    div(C.TaxonomyCodeInDropdown, alt.value),
                    div(C.InlineBlock, alt.label),
                    S.on('click')((e: MouseEvent) => {
                      at_key(alt.value).set(true)
                      e.preventDefault()
                      inp && inp.focus()
                    }),
                    S.on('mouseover')(() => {
                      if (alt.index !== undefined && cursor.get() != alt.index) {
                        cursor.set(alt.index)
                      }
                    })
                  )
                )
              )
            ]
          )
        )
      )
    )
  }
}

