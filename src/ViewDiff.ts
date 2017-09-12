import * as CodeMirror from "codemirror"
import * as Spans from "./Spans"
import * as Utils from "./Utils"

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
  function push(text: string, className: string = '') {
    diff_doc.replaceSelection(text)
    if (className) {
      const end = diff_doc.getCursor()
      const begin = diff_doc.posFromIndex(diff_doc.indexFromPos(end) - text.length)
      diff_doc.markText(begin, end, {className})
    }
  }
  function push_diff(source: string, target: string, className: string = '') {
    const token_diff = Utils.dmp.diff_main(target, source)
    Utils.dmp.diff_cleanupSemantic(token_diff)
    token_diff.map(([type, text]) => {
      switch (type) {
        case 1:
          push(text, 'Delete ' + className)
          break
        case -1:
          push(text, 'Insert ' + className)
          break
        default:
          push(text, className)
      }
    })
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
  diff.map((d) => {
    if (d.edit == 'Unchanged') {
      push(d.source)
    } else if (d.edit == 'Edited') {
      push_diff(d.source.join(''), d.target)
    } else if (d.edit == 'Dropped') {
      const [target, target_ws] = whitespace_split(d.target)
      const source = d.ids.map(id => m[id] || '?').join('')
      push_diff(whitespace_split(source)[0], target, 'Dropped')
      push(d.ids.map(rename).join(','), 'Subscript')
      push(target_ws)
    } else if (d.edit == 'Dragged') {
      const [s, t] = whitespace_split(d.source)
      push(s, 'Dragged')
      push(rename(d.id), 'Subscript')
      push(t)
    } else if (d.edit == 'Inserted') {
      const [s, t] = whitespace_split(d.target)
      push(s, 'Insert')
      push(t)
    } else if (d.edit == 'Deleted') {
      const [s, t] = whitespace_split(d.source)
      push(s, 'Delete')
      push(t)
    } else {
      const d2: never = d
    }
  })
})
