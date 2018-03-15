import * as CodeMirror from "codemirror"
import { tag, s, VNode } from "snabbis"

let i = 0

export function CM(opts: CodeMirror.EditorConfiguration) {
  const div = document.createElement('div')
  const key = (i++) + '_cm'
  const cm = CodeMirror(div, {lineWrapping: true, ...opts})
  const empty = (vn: VNode) => {
    if (vn.elm) {
      while(vn.elm && vn.elm.lastChild) {
        vn.elm.removeChild(vn.elm.lastChild)
      }
    }
  }
  const refresh = (vn: VNode) => {
    if (vn.elm) {
      empty(vn)
      vn.elm.appendChild(div)
      cm.refresh()
    }
  }
  const vn = tag('div', s.key(key), s.hooks({
    insert: refresh,
    update: (_, vn) => refresh(vn),
    destroy: empty
  }))
  return {cm, vn}
}

