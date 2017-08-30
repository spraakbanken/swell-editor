import * as CodeMirror from "codemirror"
import * as Spans from "./Spans"

function whitespace_split(s: string): [string, string] {
  const m = s.match(/^(.*?)(\s*)$/)
  if (m && m.length == 3) {
    return [m[1], m[2]]
  }
  return [s, ''] // unreachable (the regexp matches any string)
}

/** Draws a diff onto a code mirror */
export const draw_diff = (diff: Spans.Diff[], editor: CodeMirror.Editor) => editor.operation(() => {
  // TODO: Renumber all ids so they are contiguous and monotone
  const diff_doc = editor.getDoc()
  diff_doc.setValue('')
  diff_doc.getAllMarks().map((m) => m.clear())
  function push(text: string, css: string = '') {
    diff_doc.replaceSelection(text)
    if (css) {
      const end = diff_doc.getCursor()
      const begin = diff_doc.posFromIndex(diff_doc.indexFromPos(end) - text.length)
      diff_doc.markText(begin, end, {css: css})
    }
  }
  diff.map((d) => {
    if (d.kind == 'Unchanged') {
      push(d.source)
    } else if (d.kind == 'Edited') {
      const [s, t] = whitespace_split(d.now)
      push(s, 'color: #090')
      push(d.source.trim(), 'color: #d00; text-decoration: line-through;')
      push(t)
    } else if (d.kind == 'Dropped') {
      const [s, t] = whitespace_split(d.now)
      push(s, 'background-color: #87ceeb')
      push(d.ids.join(','), 'position: relative; bottom: -0.5em; font-size: 65%')
      if (d.source != d.now) {
        push(d.source.trim(), 'color: #d00; text-decoration: line-through;')
      }
      push(t)
    } else if (d.kind == 'Dragged') {
      const [s, t] = whitespace_split(d.source)
      push(s, 'background-color: #87ceeb; text-decoration: line-through;')
      push(d.id + '', 'position: relative; bottom: -0.5em; font-size: 65%')
      push(t)
    } else if (d.kind == 'Inserted') {
      const [s, t] = whitespace_split(d.now)
      push(s, 'color: #090')
      push(t)
    } else if (d.kind == 'Deleted') {
      const [s, t] = whitespace_split(d.source)
      push(s, 'color: #d00; text-decoration: line-through;')
      push(t)
    } else {
      const d2: never = d
    }
  })
})
