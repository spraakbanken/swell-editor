import * as CodeMirror from "codemirror"
import { tag, s, VNode } from "snabbis"

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
  const vn = tag('div', s.hooks({
    insert: refresh,
    update: (_, vn) => refresh(vn),
  }))
  return {cm, vn}
}

