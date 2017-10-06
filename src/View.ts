/*

Right now we use the cut word part of the CM state using a CM mark

*/
import * as CodeMirror from "codemirror"
import { Editor } from "codemirror"
import * as Spans from "./Spans"
import * as Utils from "./Utils"
import * as Classes from './Classes'
import { classes_module } from './Classes'
import { Span } from "./Spans"
import * as ViewDiff from "./ViewDiff"
import { log, debug, debug_table } from "./dev"
import * as Positions from "./Positions"
import * as typestyle from "typestyle"

import { AppState } from './AppTypes'


import { h } from "snabbdom"
import { VNode, VNodeData } from "snabbdom/vnode"

import * as snabbdom from "snabbdom"
import snabbdomAttrs from 'snabbdom/modules/attributes'
import snabbdomProps from 'snabbdom/modules/props'
import snabbdomEvents from 'snabbdom/modules/eventlisteners'

// no @types for prettify-xml
declare function require(module_name: string): any
const format: (xml_string: string) => string = require('prettify-xml')

function whitespace_start(s: string): number {
  const m = s.match(/\s*$/)
  if (m) {
    return m.index || s.length
  } else {
    return s.length
  }
}

function checkbox(value: boolean, update: (new_value: boolean) => void): VNode {
  return h('input', {
    props: {type: 'checkbox', value, checked: value},
    on: {
      change: (evt: Event) => update((evt.target as any).checked)
    }
  })
}

const tag =
  (tag_name: string) =>
  (main_class: string = '', data: VNodeData = {}, ...more_classes: string[]) =>
  (...children: (string | VNode | null | undefined)[]) =>
  h(tag_name, {...data, classes: [main_class, ...more_classes, ...(data.classes || [])]}, children  as any)

const div = tag('div')
const span = tag('span')

export function wrap(div: HTMLDivElement, post: () => void, ...classes: string[]) {
  function move(_: any, v: VNode) {
    if (v.elm) {
      v.elm.appendChild(div)
    }
    post()
  }

  return h('div', {
    classes: classes,
    hook: {
      insert: v => move(null, v),
      //create: move,
      //update: move,
      //postpatch: move
    }
  })
}

export interface EditorAndNode {
  editor: CodeMirror.Editor,
  vnode: () => VNode
}

export function CM(opts: CodeMirror.EditorConfiguration, ...classes: string[]): EditorAndNode {
  const div = document.createElement('div')
  const editor = CodeMirror(div, {lineWrapping: true, ...opts})
  const wrapper = editor.getWrapperElement()
  const prev_classes = wrapper.className
  wrapper.className = [prev_classes, ...classes].join(' ')
  return {editor, vnode: () => wrap(div, () => editor.refresh()) }
}

export function MkCM(caption: string, name: string, opts: CodeMirror.EditorConfiguration, ...classes: string[]): EditorAndNode {
    const {editor, vnode} = CM(opts, ...classes)
    return {
      editor,
      vnode: () =>
        div(name, {key: name, classes: [name]})(
          div(Classes.Caption)(caption),
          vnode()
        )
    }
}

export interface ViewParts {
  view_orig: () => VNode,
  view_main: () => VNode,
  view_diff: () => VNode,
  view_xml: () => VNode,
  semi_rich_diff: Spans.SemiRichDiff[],
  cm_diff: CodeMirror.Editor,
  state: AppState,
  set_state: (to: AppState) => void,
}

const view = (parts: ViewParts, ladder: VNode) =>
  div(Classes.MainStyle)(
    div(Classes.SideBySide)(
      parts.view_orig(),
      parts.view_main(),
      parts.view_diff(),
    ),
    div('', {key: 'ladder'})(
      div(Classes.Caption)('Alignment of source text and normalised text'),
      ladder
    ),
    div(Classes.Vertical)(
      span(Classes.FlushRight)(
        checkbox(parts.state.show_xml, b => parts.set_state({...parts.state, show_xml: b})),
        span()('Show XML')
      ),
      parts.state.show_xml ? parts.view_xml() : null
    )
  )


export function setup(root_element: HTMLElement): (parts: ViewParts) => void {
  while (root_element.lastChild) {
    root_element.removeChild(root_element.lastChild)
  }

  const patch = snabbdom.init([
    classes_module,
    snabbdomAttrs,
    snabbdomEvents,
    snabbdomProps
  ])

  const container = document.createElement('div')
  root_element.appendChild(container)
  let vnode = patch(container, h('div'))
  let pos_dict = Positions.init_pos_dict()

  return (parts: ViewParts) => {
    ViewDiff.draw_diff(parts.semi_rich_diff, parts.cm_diff)
    typestyle.forceRenderStyles()
    do {
      pos_dict.modified = false
      const ladder = ViewDiff.ladder_diff(parts.semi_rich_diff, pos_dict)
      vnode = patch(vnode, view(parts, ladder))
    } while (pos_dict.modified)
  }
}

