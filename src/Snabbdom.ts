import * as CodeMirror from "codemirror"

import * as snabbdom from "snabbdom"
import * as eventlisteners from "snabbdom/modules/eventlisteners"
import * as attachto from "snabbdom/helpers/attachto"
import * as vnode from "snabbdom/vnode"
import * as snabbis from "snabbis"
import { tag, Content as S } from "snabbis"
import { Hooks } from 'snabbdom/hooks';

// reexports
const h = snabbdom.h
type VNode = vnode.VNode
type VNodeData = vnode.VNodeData

export function checkbox(value: boolean, update: (new_value: boolean) => void): VNode {
  return tag('input',
    S.attrs({type: 'checkbox'}),
    S.props({value, checked: value}),
    S.on('change')((evt: Event) => update((evt.target as any).checked))
  )
}

export function CM(opts: CodeMirror.EditorConfiguration) {
  const div = document.createElement('div')
  const cm = CodeMirror(div, {lineWrapping: true, ...opts})
  const refresh = (vn: VNode) => {
    if (vn.elm) {
      while(vn.elm && vn.elm.lastChild) {
        vn.elm.removeChild(vn.elm.lastChild)
      }
      console.log('refresh')
      vn.elm.appendChild(div)
      cm.refresh()
    }
  }
  return {cm, vn: hook(tag('div'), {
    insert: refresh,
    update: (_, vn) => refresh(vn),
  })}
}

export const on = (old: VNode, new_on: eventlisteners.On) => ({
  ...old,
  data: {
    ...(old.data || {}),
    on: {
      ...((old.data || {}).on || {}),
      ...new_on
    }
  }
})

export const hook = (old: VNode, new_hook: Hooks) => ({
  ...old,
  data: {
    ...(old.data || {}),
    hook: {
      ...((old.data || {}).hook || {}),
      ...new_hook
    }
  }
})

