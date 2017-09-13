import * as CodeMirror from "codemirror"
import * as Spans from "./Spans"
import * as Utils from "./Utils"
import * as Positions from "./Positions"
import { h } from "snabbdom"
import { VNode } from "snabbdom/vnode"

// NOTE: diff refers to two different things in this module:
// the diff calculated by Spans.calculate_diff, and
// diffs within tokens calculated by diff_match_patch.

function table(rows: VNode[][]): VNode {
  return h('div', {class: {row: true}, style: {height: '120px'}},
    rows.map(row => h('div', {class: {column: true}}, row)))
}

// todo: keys on VNodes

const span = (t ?: string, cls: Record<string, boolean> = {}) =>
  t ? h('span', {class: {...cls, 'ladder-cell': true}}, t)
    : h('span', {class: {...cls, 'ladder-cell': true}})

const aug = (id: string, v: VNode) => ({...v, data: {...v.data, hook: {
  insert: (vn: VNode) => console.log('insert', id, vn.elm, (vn.elm as HTMLElement).offsetLeft, (vn.elm as HTMLElement).offsetTop),
  postpatch: (_: any, vn: VNode) => console.log('postpatch', id, vn.elm, (vn.elm as HTMLElement).offsetLeft, (vn.elm as HTMLElement).offsetTop)
}}})

export function ladder_diff(diff: Spans.Diff[], pos_dict: Positions.PosDict): VNode {
  const m = Spans.drop_map(diff)
  const m2 = Spans.drag_map(diff)
  const links = [] as [string, string][]
  return Positions.relative(
    table(
      diff.map((d, i) => {
        function elements() {
          switch (d.edit) {
            case 'Unchanged':
              links.push(['top'+i, 'bot'+i])
              return [span(d.source), span(d.source)]
            case 'Edited':
              links.push(['top'+i, 'bot'+i])
              const s = d.source.join('')
              const t = d.target
              const td = Utils.token_diff(t, s)
              return [deletes(td), inserts(td)]
            case 'Deleted':
              return [span(d.source, {Delete: true}), span()]
            case 'Dragged':
              const [drop_id, dropped] = m2[d.id]
              const target = dropped.target
              const sources = dropped.ids.map(id => m[id] || '?')
              const my_pos = dropped.ids.indexOf(d.id)
              links.push(['top'+i, 'bot'+drop_id])
              return [deletes(invert_diff(Utils.multi_diff(sources, target)[my_pos])), span()]
            case 'Dropped':
              const source = d.ids.map(id => m[id] || '?').join('')
              return [span(), inserts(Utils.token_diff(d.target, source))]
            case 'Inserted':
              return [span(), span(d.target, {Insert: true})]
            default:
              return d
          }
        }
        const [top, bot] = elements()
        return [Positions.posid('top'+i, pos_dict, top), Positions.posid('bot'+i, pos_dict, bot)]
      })),
    h('svg', {style: {width: '100%'}}, links.map(([top, bot]) => {
      const top_p = pos_dict.dict[top]
      const bot_p = pos_dict.dict[bot]
      if (top_p && bot_p) {
        console.log(top, bot, top_p, bot_p)
        const x1 = top_p.left + top_p.width / 2
        const y1 = top_p.top + top_p.height
        const x2 = bot_p.left + bot_p.width / 2
        const y2 = bot_p.top
        return h('path', {attrs: {
          d: "M" + x1 + " " + y1 + " L" + x2 + " " + y2,
          stroke: "black"
        }})
      } else {
        return null
      }
    }).filter(x => x != null))
  )
}

const invert_diff = (ds : [number, string][]) => ds.map(([i, s]) => [-i, s] as [number, string])

const diff_to_spans = (rules: (string | null)[]) => (d: [number, string][]) =>
  h('span', classes(['ladder-cell']), diff_helper(d, rules, (text, cls) => h('span', classes([cls]), text)))

const inserts = diff_to_spans(['Insert', '', null])

const deletes = diff_to_spans([null, '', 'Delete'])

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
    diff_helper(Utils.token_diff(target, source), [' Insert', '', ' Delete'], (text, cls) => push(text, className + cls))
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
