import * as CodeMirror from "codemirror"
import * as Spans from "./Spans"
import * as Utils from "./Utils"
import { h } from "snabbdom"
import { VNode } from "snabbdom/vnode"
import snabbdomClass from 'snabbdom/modules/class'

function table(rows: VNode[][]): VNode {
  return h('div', {class: {row: true}},
    rows.map(row => h('div', {class: {column: true}}, row)))
}

const span = (t ?: string, cls: Record<string, boolean> = {}) =>
  t ? h('span', {class: {...cls, margin: true}}, t)
    : h('span', {class: {...cls, margin: true}})

export function ladder_diff(diff: Spans.Diff[]): VNode {
  const m = Spans.drop_map(diff)
  const m2 = Spans.drag_map(diff)
  return table(
    diff.map(d => {
      switch (d.edit) {
        case 'Unchanged':
          return [span(d.source), span(), span(d.source)]
        case 'Edited':
          const s = d.source.join('')
          const t = d.target
          return [deletes(s, t), span(), inserts(s, t)]
        case 'Deleted':
          return [span(d.source, {Delete: true}), span(), span()]
        case 'Dragged':
          // Need to know my companions... Refactor this beauty
          const dropped = m2[d.id]
          const target = dropped.target
          const sources = dropped.ids.map(id => m[id] || '?')
          const my_pos = dropped.ids.indexOf(d.id)
          const sp = h('span', classes(['margin']),
            diff_helper(Utils.multi_diff(sources, target)[my_pos],
              ['Delete', '', null], (text, cls) => h('span', classes([cls]), text)))
          return [sp, span(), span()]
        case 'Dropped':
          const source = d.ids.map(id => m[id] || '?').join('')
          console.log(Utils.show(Utils.token_diff(source, d.target)))
          return [span(), span(), inserts(source, d.target)]
        case 'Inserted':
          return [span(), span(), span(d.target, {Insert: true})]
        default:
          return d
      }
    })
  )
}

function diff_help<A>(source: string, target: string, rules: (string | null)[], cb: (text: string, className: string) => A): A[] {
  return diff_helper(Utils.token_diff(target, source), rules, cb)
}

function diff_helper<A>(token_diff: [number, string][], rules: (string | null)[], cb: (text: string, className: string) => A): A[] {
  const out = [] as A[]
  token_diff.map(([type, text]) => {
    const cls = rules[type + 1]
    if (cls != null) {
      out.push(cb(text, cls))
    }
  })
  return out
}

function classes(cls: string[]): {class: Record<string, boolean>} {
  const d = {} as Record<string, boolean>
  cls.map(c => { if (c != '') { d[c] = true }})
  return {class: d}
}

function inserts(source: string, target: string): VNode {
  return h('span', classes(['margin']), diff_help(source, target, ['Insert', '', null], (text, cls) => h('span', classes([cls]), text)))
}

function deletes(source: string, target: string): VNode {
  return h('span', classes(['margin']), diff_help(source, target, [null, '', 'Delete'], (text, cls) => h('span', classes([cls]), text)))
}

/** Draws a diff onto a code mirror */
export const draw_diff = (diff: Spans.Diff[], editor: CodeMirror.Editor) => editor.operation(() => {
  // TODO: Renumber all ids so they are contiguous and monotone
  const diff_doc = editor.getDoc()
  diff_doc.setValue('')
  diff_doc.getAllMarks().map((m) => m.clear())
  function push(text: string, className: string = '') {
    diff_doc.replaceSelection(text)
    if (className) {
      const end = diff_doc.getCursor()
      const begin = diff_doc.posFromIndex(diff_doc.indexFromPos(end) - text.length)
      diff_doc.markText(begin, end, {className})
    }
  }
  function push_diff(source: string, target: string, className: string = '') {
    diff_help(source, target, [' Insert', '', ' Delete'], (text, cls) => push(text, className + cls))
  }
  const m = Spans.drop_map(diff)
  let i = 0
  const rename_map = {} as {[x: string]: string}
  const rename = (id: string) => {
    if (!(id in rename_map)) {
      rename_map[id] = ++i + ''
    }
    return rename_map[id]
  }
  diff.map(d => {
    if (d.edit == 'Unchanged') {
      push(d.source)
    } else if (d.edit == 'Edited') {
      push_diff(d.source.join(''), d.target)
    } else if (d.edit == 'Dropped') {
      const [target, target_ws] = Utils.whitespace_split(d.target)
      const source = d.ids.map(id => m[id] || '?').join('')
      push_diff(Utils.whitespace_split(source)[0], target, 'Dropped')
      push(d.ids.map(rename).join(','), 'Subscript')
      push(target_ws)
    } else if (d.edit == 'Dragged') {
      const [s, t] = Utils.whitespace_split(d.source)
      push(s, 'Dragged')
      push(rename(d.id), 'Subscript')
      push(t)
    } else if (d.edit == 'Inserted') {
      const [s, t] = Utils.whitespace_split(d.target)
      push(s, 'Insert')
      push(t)
    } else if (d.edit == 'Deleted') {
      const [s, t] = Utils.whitespace_split(d.source)
      push(s, 'Delete')
      push(t)
    } else {
      push(d)
    }
  })
})
