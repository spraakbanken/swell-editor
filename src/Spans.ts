
import * as Utils from './Utils'
import {debug} from './dev'

export interface Span {
  readonly text: string,
  readonly links: number[],
  readonly labels: string[],
  readonly moved: boolean
}

/** Combine all data from several spans */
export function merge_spans(spans: Span[], text: string): Span {
  const links = Utils.flatten(spans.map(s => s.links))
  return {
    text: text,
    labels: Utils.flatten(spans.map(s => s.labels)),
    links: Utils.numsort(links),
    moved: spans.some(s => s.moved) || !Utils.contiguous(links)
  }
}

/** Tokenizes text on whitespace */
export function tokenize(s: string): string[] {
  const lts = Utils.ltrim(s)
  if (lts.length > 0) {
    return (lts + ' ').match(/\S*\s+/g) || []
  } else {
    return [] as string[]
  }
}

/** Makes spans from an original text by tokenizing it and assumes no changes */
export const identity_spans: (s: string) => Span[] = (s) => init(tokenize(s))

/** Makes spans from tokens */
export function init(tokens: string[]): Span[] {
  return tokens.map((s, i) => ({
    text: s,
    links: [i],
    labels: [],
    moved: false
  }))
}

/** Checks the invariants for spans, returns empty string if OK */
export function check_invariant(spans: Span[]): string {
  for (let i = 0; i < spans.length; i++) {
    const text = spans[i].text
    if (!text.match(/^\S(.|\n)*\s$/)) {
      return 'Content invariant violated at index ' + i + ': ' + text
    }
  }
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (!span.moved && !Utils.contiguous(span.links)) {
      return 'Links not contiguous on unmoved span at index ' + i
    }
    if (!Utils.increases(span.links)) {
      return 'Links not sorted at index ' + i
    }
    if (span.moved && span.links.length == 0) {
      return 'Span moved but without links at index ' + i
    }
  }
  for (let i = 0; i < spans.length; i++) {
    for (let j = 0; j < spans.length; j++) {
      if (spans[i].links.some((x) => spans[j].links.some((y) => x == y)) && i != j) {
        return 'Links injectivity invariant broken at indicies ' + i + ' and ' + j
      }
    }
  }
  if (!Utils.increases(Utils.flatten(spans.filter(s => !s.moved).map(s => s.links)))) {
    return 'Links not increasing'
  }
  return '' // all ok!
}

/** Moves a slice of the spans and puts it at a new destination (marking them as moved).

Indexes are spans, not offsets.
*/
export function rearrange(spans: Span[], begin: number, end: number, dest: number): Span[] {
  const bumped_end = end + 1
  const [before, seg, after] = Utils.splitAt3(spans, begin, bumped_end)
  function mark_moved(span: Span): Span {
    return {...span, moved: span.links.length > 0}
  }
  const mod_dest = dest - (dest >= bumped_end ? bumped_end - begin : 0)
  const [a,b] = Utils.splitAt(Utils.flatten([before, after]), mod_dest)
  return cleanup_after_raw_modifications(Utils.flatten([a, seg.map(mark_moved), b]))
}

/** Replace the text at some position, merging the spans it touches upon.

Positions are offsets from the beginning of text.
(use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert */
export function modify(spans: Span[], from: number, to: number, text: string): Span[] {
  const [from_span, from_ix] = span_from_offset(spans, from)
  let [to_span, to_ix] = span_from_offset(spans, to - 1)
  const [before, seg, after] = Utils.splitAt3<Span>(spans, from_span, to_span+1)
  const pre = seg.length > 0 ? seg[0].text.slice(0, from_ix) : ""
  const post = seg.length > 0 ? seg[seg.length - 1].text.slice(to_ix + 1) : ""
  const new_span: Span = merge_spans(seg, pre + text + post)
  return cleanup_after_raw_modifications(Utils.flatten([before, [new_span], after]))
}

/** Modify the spans using a sliding window of width one.

Goes through the array backwards in case the size changes.

Return null for no change.
*/
function cursor<S>(f: ((prev: S | null, me: S, next: S | null) => (S | null)[] | null)): (spans: S[]) => S[] {
  return (spans) => {
    for (let i = spans.length - 1; i >= 0; i--) {
      const prev = i > 0 ? spans[i-1] : null
      const next = i < spans.length - 1 ? spans[i+1] : null
      const replace = f(prev, spans[i], next)
      if (replace != null) {
        spans = Utils.flatten([spans.slice(0, Math.max(i-1,0)), replace.filter((x) => x != null) as S[], spans.slice(i+2)])
      }
    }
    return spans
  }
}

/** Reverts a span if it matches the original exactly.

Only performed when this breaks up a span into many, and they are not moved */
export function auto_revert(spans: Span[], original: string[]): Span[] {
  return cursor<Span>((prev, me, next) => {
    if (me.links.length > 1 &&
        !me.moved &&
        me.text == me.links.map((i) => original[i]).join('')) {
      const reverted_spans: Span[] = me.links.map((i) => ({
        text: original[i],
        links: [i],
        labels: [],
        moved: false
      }))
      return [prev].concat(reverted_spans, [next])
    } else {
      return null
    }
  })(spans)
}


/** Shuffles initial whitespace from a token to the previous one,
or if it's the first span remove all its initial whitespace */
const move_whitespace: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    const m = me.text.match(/^\s+/)
    if (m) {
      const new_me = {...me, text: me.text.slice(m[0].length)}
      if (prev) {
        const new_prev = {...prev, text: prev.text + m[0]}
        return [new_prev, new_me, next]
      } else {
        return [new_me, next]
      }
    } else {
      return null // no change
    }
  })

/** Remove empty spans */
const remove_empty: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (me.text.length == 0) {
      return [prev, next]
    } else {
      return null // no change
    }
  })

/** Merge tokens which have no final whitespace with next token */
const merge_no_final_whitespace: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (me.text.match(/\S$/) && next) {
      const new_me_next = merge_spans([me, next], text([me, next]))
      return [prev, new_me_next]
    } else {
      return null // no change
    }
  })

/** Clean up after modifications */
function cleanup_after_raw_modifications(spans: Span[]): Span[] {
  const new_spans = merge_no_final_whitespace(remove_empty(move_whitespace(spans)))
  if (debug) {
    if (Utils.ltrim(text(spans)) != text(new_spans)) {
      throw new Error('Internal error: content modified')
    }
    //check_invariant(new_spans)
  }
  return new_spans
}

/** The total text length */
export function text_length(spans: Span[]): number {
  return text(spans).length
}

/** The text */
export function text(spans: Span[]): string {
  return spans.map(s => s.text).join('')
}

/** The offset in the modified text for a span at an index. */
export function span_offset(spans: Span[], index: number): number {
  return spans.slice(0, index).reduce((x, s: Span) => x + s.text.length, 0)
}

/** The span index and position in it from an offset in the modified text */
export function span_from_offset(spans: Span[], offset: number): [number, number] {
  let passed = 0
  for (let i = 0; i < spans.length; i++) {
    const w = spans[i].text.length
    passed += w
    if (passed > offset) {
      return [i, offset - passed + w]
    }
  }
  throw new Error('Out of bounds')
}

export type Diff
  = { edit: 'Unchanged', source: string }
  | { edit: 'Edited', target: string, source: string[] }
  | { edit: 'Deleted', source: string }
  | { edit: 'Dragged', source: string, id: string }
  // The following two are (unlike the other four) not related to a source word
  | { edit: 'Dropped', target: string, ids: string[] }
  | { edit: 'Inserted', target: string }

function Unchanged(source: string): Diff {
  return { edit: 'Unchanged', source }
}

function Edited(target: string, source: string[]): Diff {
  if (target == source.join('')) {
    return Unchanged(target)
  } else {
    return { edit: 'Edited', target, source }
  }
}

function Dropped(target: string, ids: string[]): Diff {
  return { edit: 'Dropped', target , ids }
}

function Dragged(source: string, id: string): Diff {
  return { edit: 'Dragged', source, id }
}

function Inserted(target: string): Diff {
  return { edit: 'Inserted', target }
}

function Deleted(source: string): Diff {
  return { edit: 'Deleted', source }
}

export function drop_map(diff: Diff[]): {[id: string]: string} {
  let m = {} as {[id: string]: string}
  diff.map((d: Diff) => d.edit == 'Dragged' && (m[d.id] = d.source))
  return m
}


/**
This is a translation of this algorithm:

diff (Span text [] false : spans)    ss = Inserted text : diff spans ss
diff (Span text links false : spans) ss0@((s,j):ss)
  | j == links[0]        = edited text (concatMap s (take links.length ss0))
                         : diff spans (drop links.length ss0)
  | j `elem` unlinked    = Dragged s (Span text links false : spans) ss
  | j `notElem` unlinked = Deleted s (Span text links false : spans) ss
diff (Span text links true : spans) ss = Dropped text (concatMap (! unlinked) links) : diff spans ss
diff [] ss = map (Deleted/Dragged . fst) ss
*/
export function calculate_diff(spans: Span[], tokens: string[]): Diff[] {
  const moved : {[x : number] : {}} = {}
  spans.map((s, i) => {
    if (s.moved) {
      s.links.map(j => moved[j] = {})
    }
  })
  let i = 0
  let j = 0
  const out: Diff[] = []
  function Gone() {
    const u = j in moved
    if (u) {
      out.push(Dragged(tokens[j], Utils.show(j)))
      j++
    } else {
      out.push(Deleted(tokens[j]))
      j++
    }
  }
  while (i < spans.length) {
    const span = spans[i]
    if (span.links.length == 0) {
      out.push(Inserted(span.text))
      i++
    } else if (span.moved) {
      out.push(Dropped(span.text, span.links.map(Utils.show)))
      i++
    } else if (j == span.links[0]) {
      out.push(Edited(span.text, span.links.map((t) => tokens[t])))
      i++
      j+=span.links.length
    } else {
      Gone()
    }
  }
  tokens.slice(j).map(Gone)
  return out
}

type Children = (Element | string | [string, string])[]

const xml: Document = document.implementation.createDocument(null, null, null);
function node(tag_name: string): (...children: Children) => Element {
  return (...children) => {
    const ret = xml.createElement(tag_name)
    for (const child of children) {
      if (typeof child === 'string') {
        ret.appendChild(xml.createTextNode(child))
      } else if (Array.isArray(child)) {
        ret.setAttribute(child[0], child[1])
      } else {
        ret.appendChild(child)
      }
    }
    return ret
  }
}

// these are exported for testing
export type LaxDiff = {
  edit: string,
  source?: string,
  target?: string,
  ids?: string[]
}

export function pretty_lax(d: LaxDiff): string {
  const args = (d.ids || []).map((x) => x + '')
  return [d.edit].concat(...args).join(' ') + (d.target != null ? ':' + d.target : '')
}

export function parse_lax(s: string): LaxDiff {
  const m = s.match(/^(\w*)((?:\s+\w+)*)(?::(.*))?$/)
  if (!m) {
    throw 'Cannot parse ' + s
  } else {
    const ids = (m[2].match(/\w+/g) || [])
    return {
      edit: m[1],
      target: m[3],
      ids: ids.length == 0 ? undefined : ids
    }
  }
}

/*
  <w h="|Unchanged:En |">En </w>
  <w h="|Edited:x dag |">dag </w>
  <w h="|Dropped 3:vaknade|Unchanged:jag|">jag </w>
  <w h="|Dragged 3|">vaknade </w>
  <w h="|Unchanged:när |">när </w>
*/

export function diff_to_xml(diff: Diff[]): Element {
  let queue: LaxDiff[] = []
  let source: string | null = null
  const nodes = [] as Element[]
  function pop(): void {
    if (source) {
      const pretty = queue.map(pretty_lax)
      nodes.push(node('w')(['h', Utils.pipesep(pretty)], source))
    } else {
      throw new Error('Internal error, no source! Starting from an empty document?')
    }
    queue = []
  }
  function enqueue(x: LaxDiff): void {
    const {source:x_source, ...x_without_source} = x
    if (source && x_source) {
      pop()
    }
    if (x_source) {
      source = x_source
    }
    queue.push(x_without_source)
  }
  diff.map((d) => {
    switch (d.edit) {
      case 'Unchanged':
        return enqueue({...d, target: d.source})
      case 'Edited':
        return d.source.map((s, i) => {
          if (i == 0) {
            enqueue({edit: 'Edited', target: d.target, source: s})
          } else {
            enqueue({edit: 'EditedContinuation', source: s, target: d.target})
          }
        })
      case 'Deleted':
        return enqueue(d)
      case 'Dragged':
        return enqueue({...d, ids: [d.id]})
      case 'Dropped':
        return enqueue(d)
      case 'Inserted':
        return enqueue(d)
    }
  })
  pop()
  return node('corpus')(...nodes)
}

export function xml_to_diff(xml_string: string): Diff[] {
  const parser = new DOMParser();
  const xml = parser.parseFromString('<?xml version="1.0"?>' + xml_string, 'application/xml')
  if (xml.querySelector('parsererror')) {
    throw 'Invalid xml'
  }
  const ws = xml.getElementsByTagName('w') as any as Element[]
  let diff = [] as Diff[]
  for (const w of ws) {
    const h = w.getAttribute('h')
    if (h == null) {
      throw 'No h attribute for target hypothesis on: ' + w
    }
    const lds = Utils.pipeunsep(h).map(parse_lax)
    let consumed = false
    const w_text = (ld: LaxDiff) => {
      const text = w.textContent
      if (text == null) {
        throw 'Word tag without text content: ' + w
      }
      if (consumed) {
        throw 'Cannot have another edit on the same word ' + text
      }
      consumed = true
      return text
    }
    lds.map((ld) => {
      switch (ld.edit) {
        case 'Unchanged':
          return diff.push(Unchanged(w_text(ld)))
        case 'Edited':
          if (ld.target === undefined) {
            throw 'No edit target on: ' + h
          }
          return diff.push(Edited(ld.target, [w_text(ld)]))
        case 'EditedContinuation':
          if (diff.length == 0) {
            throw 'EditedContinuation with no previous Edited'
          }
          const last = diff[diff.length - 1]
          if (last.edit == 'Edited') {
            const {target, source} = last
            diff[diff.length - 1] = Edited(target, source.concat([w_text(ld)]))
            return
          } else {
            throw 'EditedContinuation with no previous Edited'
          }
        case 'Deleted':
          return diff.push(Deleted(w_text(ld)))
        case 'Dragged':
          if (!ld.ids || ld.ids.length != 1) {
            throw 'Dragged without identifier'
          }
          return diff.push(Dragged(w_text(ld), ld.ids[0]))
        case 'Dropped':
          if (!ld.ids || ld.ids.length == 0) {
            throw 'Dropped without identifiers'
          }
          if (!ld.target) {
            throw 'Dropped without target text'
          }
          return diff.push(Dropped(ld.target, ld.ids))
        case 'Inserted':
          if (!ld.target) {
            throw 'Inserted without target text'
          }
          return diff.push(Inserted(ld.target))
        default:
          throw 'Unknown edit type: ' + ld.edit
      }
    })
    if (!consumed) {
      throw 'Needs an operation about the current word on ' + h
    }
  }
  return diff
}

export function diff_to_spans(diff: Diff[]): {spans: Span[], tokens: string[]} {
  let m = {} as {[id: string]: number}
  const tokens = [] as string[]
  diff.map((d) => {
    switch (d.edit) {
      case 'Dragged': m[d.id] = tokens.length
      case 'Unchanged':
      case 'Deleted':
        tokens.push(d.source)
        break

      case 'Edited':
        tokens.push(...d.source)
        break
    }
  })
  const lookup = (id: string) => {
    if (id in m) {
      return m[id]
    } else {
      throw 'Unknown identifier: ' + id
    }
  }
  let i = 0
  const mspans = diff.map((d) => {
    switch (d.edit) {
      case 'Unchanged':
        return {text: d.source, links: [i++], moved: false, labels: []}
      case 'Edited':
        return {text: d.target, links: d.source.map(() => i++), moved: false, labels: []}
      case 'Deleted':
        i++
        return null
      case 'Dragged':
        i++
        return null
      case 'Dropped':
        return {text: d.target, links: d.ids.map(lookup), moved: true, labels: []}
      case 'Inserted':
        return {text: d.target, links: [], moved: false, labels: []}
    }
  })
  return {tokens, spans: Utils.cat(mspans)}
}

