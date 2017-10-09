import * as Spans from "./Spans"
import * as Utils from "./Utils"
import { TokenDiff }  from "./Utils"
import * as Positions from "./Positions"
import * as Classes from './Classes'
import { div, VNode, h, on } from "./Snabbdom"
import * as Snabbdom from "./Snabbdom"
import * as csstips from "csstips"
import { style } from "typestyle"
import { log } from './dev'

function table(cols: VNode[][], classes: string[] = []): VNode {
  return div(Classes.Row, {}, ...classes)(
    ...cols.map(col => div(Classes.Column)(...col)))
}

// todo: keys on VNodes

const span = (t ?: string, cls: string[] = []) =>
  Snabbdom.span(Classes.InnerCell, {}, ...cls)(...(t ? [t] : []))

const avg = (xs: number[]) => {
  if (xs.length == 0) {
    return null
  } else {
    return xs.reduce((x,y) => x+y, 0) / xs.length
  }
}

type Link
  = { type: 'segment', from: string, to: string }
//  | { type: 'upper', from: string, converge: string }
//  | { type: 'lower', to: string, converge: string }

export function ladder_diff(diff: Spans.SemiRichDiff[], pos_dict: Positions.PosDict, select_group: (join_id: string) => void): VNode {
  const links = [] as Link[]
  const cols = [] as [VNode[], VNode[], VNode[]][]
  const name = (vnode: VNode, prefix: string, i: number, j: number|undefined = undefined) => {
    const key = prefix+i+(j == undefined ? '' : '.'+j)
    return Positions.posid(key, pos_dict, on(vnode, {
      mouseover(e: MouseEvent) {
        log('over', key, e)
      },
      click(e: MouseEvent) {
        log('click', key, e)
      }
    }))
  }
  const labels = {} as Record<string, boolean>
  diff.map((d, i) => {
    function elements(): [VNode | null, VNode | null, VNode | null] {
      let mid = null
      switch (d.edit) {
        case 'Unchanged':
          links.push({ type: 'segment', from: 'top'+i, to: 'bot'+i })
          return [
            name(span(d.source), 'top', i),
            null,
            name(span(d.source), 'bot', i)
          ]
        case 'Dragged':
          links.push({type: 'segment', from: 'top'+i, to: d.join_id + '0'})
          if (d.nullary) {
            //Delete
            mid = name(h('span', {classes: [Classes.BorderCell]}, d.labels.join(', ')), d.join_id, 0)
          }
          return [name(h('span', {classes: [Classes.InnerCell]}, deletes(d.source_diff)), 'top', i), mid, null]
        case 'Dropped':
          links.push({type: 'segment', to: 'bot'+i, from: d.join_id + '0'})
          if (!labels[d.join_id]) {
            labels[d.join_id] = true
            mid = name(h('span', {classes: [Classes.BorderCell]}, d.labels.join(', ')), d.join_id, 0)
          }
          return [null, mid, name(h('span', {classes: [Classes.InnerCell]}, inserts(d.target_diff)), 'bot', i)]
        default:
          return d
      }
    }
    const col = elements().map(x => x == null ? [] : [
      on(x, {
        click(e: MouseEvent) {
          if (d.edit != 'Unchanged') {
            select_group(d.join_id)
          }
        }
      })
    ])
    // If we are only doing drag or drop and previous did as well,
    // we don't need to start a new column, we can just push onto its parts
    let new_col = true
    if (i > 0) {
      const prev = diff[i-1]
      // floats: drag, drop, insert, delete: can float into previous
      if (d.edit != 'Unchanged' && prev.edit != 'Unchanged' && d.float && prev.float) {
        new_col = false
      }
      // non-floats: edits. merge them unless they are Dropped followed by Dragged
      if (d.edit != 'Unchanged' && prev.edit == d.edit && !d.float && !prev.float) {
        new_col = false
      }
      if (prev.edit == 'Dragged' && d.edit == 'Dropped' && !d.float && !prev.float) {
        new_col = false
      }
    }
    if (new_col) {
      cols.push(col)
    } else {
      col.map((e, i) => cols[cols.length-1][i].push(...e))
    }
  })
  const ladder = Positions.posid('table', pos_dict, table(cols.map(([u, m, d], i) => [
    h('div', {classes: [Classes.Cell]}, u.length == 0 ? [h('div', {classes: [Classes.InnerCell]}, '\u200b')] : u),
    h('div', {classes: [Classes.Cell]}, m.length == 0 ? []                                                   : m),
    h('div', {classes: [Classes.Cell]}, d.length == 0 ? [h('div', {classes: [Classes.InnerCell]}, '\u200b')] : d)
  ]), [Classes.LadderTable, Classes.MainStyle]))

  const svg = h('svg', {classes: [Classes.Width100Pct]}, links.map(link => {
      if (link.type == 'segment') {
        const top = pos_dict.dict[link.from]
        const bot = pos_dict.dict[link.to]
        if (!top || !bot) return;
        const x1 = Positions.hmid(top)
        const y1 = Positions.bot(top)
        const x2 = Positions.hmid(bot)
        const y2 = bot.top // Positions.top(bot)
        const d = 25 * (-1 / (Math.abs(x1 - x2) + 1) + 1)
        return h('path', {
          attrs: {
            d: ['M', x1, y1, 'C', x1, y1 + d, x2, y2 - d, x2, y2].join(' '),
          },
          classes: [Classes.Path]
        })
      }
    }).filter(x => x != null)
  )
  return Positions.relative(ladder, svg, ['LadderRoot'])
}

const diff_to_spans = (rules: (string | null)[]) => (d: [number, string][]) =>
  diff_helper(d, rules, (text, cls) => h('span', { classes: [cls] }, text))

const inserts = diff_to_spans([null, '', Classes.Insert])

const deletes = diff_to_spans([Classes.Delete, '', null])

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

const diff_and_whitespace = (diff: TokenDiff) => {
  if (diff.length == 0) {
    return {diff, whitespace: ''}
  } else {
    const [type, string] = diff[diff.length - 1]
    const [word, whitespace] = Utils.whitespace_split(string)
    const init = diff.slice(0, diff.length-1)
    if (word.length > 0) {
      return {diff: [...init, [type, word]] as TokenDiff, whitespace}
    } else {
      return {diff: init, whitespace}
    }
  }
}

/** Draws a diff onto a code mirror */
export const draw_diff = (diff: Spans.SemiRichDiff[], editor: CodeMirror.Editor) => editor.operation(() => {
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
  function push_diff(token_diff: TokenDiff, className: string = '') {
    diff_helper(token_diff, [' ' + Classes.Delete, '', ' ' + Classes.Insert], (text, cls) => push(text, className + cls))
  }
  const rename_map = {} as {[x: string]: string}
  let i = 0
  diff.map(d => {
    if (d.edit == 'Dropped' && d.move) {
      d.ids.map(id => id in rename_map || (rename_map[id] = ++i + ''))
    }
  })
  const rename = (id: string) => rename_map[id] || '?'
  diff.map(d => {
    if (d.edit == 'Unchanged') {
      push(d.source)
    } else if (d.edit == 'Dropped') {
      const m = diff_and_whitespace(d.target_diff.filter(([t, _]) => t != -1))
      const cl = d.move ? Classes.Dropped : ''
      push_diff(m.diff, cl)
      if (cl != '') {
        push(d.ids.map(rename).join(','), Classes.Subscript)
      }
      push(m.whitespace)
    } else if (d.edit == 'Dragged') {
      const m = diff_and_whitespace(d.source_diff.filter(([t, _]) => t != 1))
      const cl = d.move ? Classes.Dragged : ''
      push_diff(m.diff, cl)
      if (cl != '') {
        push(rename(d.id), Classes.Subscript)
      }
      push(m.whitespace)
    } else {
      push(d)
    }
  })
})
