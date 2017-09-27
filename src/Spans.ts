
import * as Utils from './Utils'
import {TokenDiff} from './Utils'
import {debug, log} from './dev'

export interface Span {
  readonly text: string,
  readonly links: number[], // could retain the order in which they were glued together
  readonly labels: string[],
  readonly moved: boolean
}

/** Combine all data from several spans */
export function merge_spans(spans: Span[], text: string): Span {
  const links = Utils.uniq(Utils.flatten(spans.map(s => s.links)))
  return {
    text: text,
    labels: Utils.flatten(spans.map(s => s.labels)),
    links: links,
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
    labels: [],
    links: [i],
    moved: false
  }))
}

/** Checks the invariants for spans, returns empty string if OK */
export function check_invariant(spans: Span[]): string {
  const rmap = {} as {[index: number]: number[]}
  spans.map(({links}, i) => {
    links.map(j => {
      rmap[j] = [...(rmap[j] || []), i]
    })
  })
  const err = [] as string[]
  spans.map((span, i) => {
    const {text, links, moved} = span
    const report = (s: string) => err.push('At index ' + i + ': ' + s)
    if (!text.match(/^\S(.|\n)*\s$/)) {
      report('Content invariant violated: ' + text)
    }
    if (!moved && !Utils.contiguous(links)) {
      report('Links not contiguous on unmoved span')
    }
    if (moved && links.length == 0) {
      report('Span moved but without links at index ' + i)
    }
    links.map(j => {
      rmap[j].map(k => {
        if (!Utils.array_multiset_eq(links, spans[k].links)) {
          report('there is a link to ' + j + ' connected to ' + k + ' with links ' + spans[k].links + ', this should be ' + links)
        }
      })
    })
    if (links.some((x, xi) => links.some((y, yi) => x == y && xi != yi))) {
      report('Duplicate links: ' + Utils.show(links))
    }
  })
  const unmoved = spans.filter(s => !s.moved).map(s => s.links)
  const ok = unmoved.every((ls, i) => i == 0 || Utils.shallow_array_eq(ls, unmoved[i-1]) || Utils.increases([...(unmoved[i-1]), ...ls]))
  if (!ok) {
    err.push('Links not increasing ' + unmoved)
  }
  if (err.length > 0) {
    console.error(err)
  }
  return err.join(', ') // all ok if this is the empty string
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

/** If a span contains non-final whitespace, and is linked to exactly one word,
and that word is the prefix or suffix, make this an insertion */
export function chop_up_insertions(spans: Span[], original: string[]): Span[] {
  return cursor<Span>((prev, me, next) => {
    const m = me.text.match(/\S\s\S/)
    if (m && m.index != undefined) {
      const [w1, w2] = Utils.stringSplitAt(me.text, m.index + 2)
      const wo = me.links.map(j => original[j]).join('')
      if (wo == w1) {
        return [prev, {...me, text: w1}, merge_spans([], w2), next]
      } else if (wo == w2) {
        return [prev, merge_spans([], w1), {...me, text: w2}, next]
      } else {
        // todo: where do labels go? right now duplicated
        return [prev, {...me, text: w1}, {...me, text: w2}, next]
      }
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

// Could relax move_whitespace but it makes it predictable that whitespace
// always trails the token

/** Clean up after modifications */
function cleanup_after_raw_modifications(spans: Span[]): Span[] {
  const new_spans = merge_no_final_whitespace(remove_empty(move_whitespace(spans)))
  if (debug) {
    if (Utils.ltrim(text(spans)) != text(new_spans)) {
      throw new Error('Internal error: content modified')
    }
    //check_invariant(new_spans)
  }
  return transitive_closure(new_spans)
}

// find the transitive closure of all involved moves
// if any side is non-contiguous mark them all as moved
function transitive_closure(spans: Span[]): Span[] {
  const {find, unions} = Utils.UnionFind()
  // Put all links in the same equivalence classes
  spans.map(s => unions(s.links))
  // Go from representation to new links and moved
  const links = [] as number[][]
  const indexes = [] as number[][]
  const moved = [] as boolean[]
  spans.map((s, i) => {
    if (s.links.length > 0) {
      const repr = find(s.links[0])
      s.links.map(n => {
        if (links[repr] == undefined) {
          links[repr] = []
        }
        if (!~links[repr].indexOf(n)) {
          links[repr].push(n)
        }
      })
      moved[repr] = (moved[repr] || false) || s.moved;
      (indexes[repr] || (indexes[repr] = [])).push(i)
    }
  })
  // Set moved flags appropriately
  links.map((ls, i) => {
    if (ls && !Utils.contiguous(ls)) {
      moved[i] = true
    }
  })
  indexes.map((ls, i) => {
    if (ls && !Utils.contiguous(ls)) {
      moved[i] = true
    }
  })
  // Update spans
  return spans.map((s, i) => {
    if (s.links.length > 0) {
      const repr = find(s.links[0])
      return {...s, links: links[repr], moved: moved[repr]}
    } else {
      return s
    }
  })
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
  | { edit: 'Edited', target: string[], source: string[] }
  | { edit: 'Dragged', source: string, id: string }
  // The following (unlike the three above) is related to a source word
  | { edit: 'Dropped', target: string, ids: string[] }

  // TODO: Make Inserted Deleted special cases of Edited?

export type PosDiff
  = Diff
  & { source_pos: number[], target_pos: number[] }

export function pos_diff(diff: Diff[]): PosDiff[] {
  let s = 0
  let t = 0
  return diff.map(d => {
    switch (d.edit) {
      case 'Unchanged':
        return {...d, source_pos: [s++], target_pos: [t++]}

      case 'Edited':
        return {...d, source_pos: d.source.map(_ => s++), target_pos: d.target.map(_ => t++)}

      case 'Dragged':
        return {...d, source_pos: [s++], target_pos: []}

      case 'Dropped':
        return {...d, source_pos: [], target_pos: [t++]}
    }
  })
}

/** Revert all involved edits at array index i in the target text */
export function revert(i: number, spans: Span[], original: string[]): Span[] {
  const {links} = spans[i]
  const diff = pos_diff(calculate_diff(spans, original))
  return diff_to_spans(Utils.flatten(diff.map(d => {
    switch (d.edit) {
      case 'Dragged':
        if (-1 != links.indexOf(d.source_pos[0])) {
          return [Unchanged(d.source)]
        } else {
          return [d]
        }
      case 'Dropped':
        if (Utils.shallow_array_eq(links.map(x => x.toString()), d.ids)) {
          return [] as Diff[]
        } else {
          return [d]
        }
      case 'Edited':
        if (-1 != d.target_pos.indexOf(i)) {
          return d.source.map(Unchanged)
        } else {
          return [d]
        }
      case 'Unchanged':
        return [d]
    }
  }))).spans
}


export type RichDiff
  = { edit: 'Unchanged', source: string }
  // these have more information:
  | { edit: 'Edited', target: string[], source: string[], target_diffs: TokenDiff[], source_diffs: TokenDiff[] }
  | { edit: 'Dragged', source: string, id: string, rev_ids: string[], source_diff: TokenDiff, join_id: string }
  | { edit: 'Dropped', target: string, ids: string[], rev_id: string, target_diff: TokenDiff, join_id: string }

export type SemiRichDiff
  = { edit: 'Unchanged', source: string }
  | { edit: 'Dragged', source: string, id: string, source_diff: TokenDiff, join_id: string, float: boolean, nullary: boolean, move: boolean }
  | { edit: 'Dropped', target: string, ids: string[], target_diff: TokenDiff, join_id: string, float: boolean, nullary: boolean, move: boolean }

// help typescript understand what's going on
function typehelp<A>(x: A): A {
  return x
}

export function semirich(diff: RichDiff[]): SemiRichDiff[] {
  let u = 0
  const unique = () => 'fake_dnd_' + u++
  return Utils.flatten<SemiRichDiff>(diff.map(d => {
    switch(d.edit) {
      case 'Edited':
        const join_id = unique()
        const nullary = d.source.length == 0 || d.target.length == 0
        const float = nullary
        const move = false
        const drags = d.source.map((source, i) => ({
          edit: typehelp<'Dragged'>('Dragged'),
          source,
          id: unique(),
          source_diff: d.source_diffs[i],
          join_id,
          nullary,
          float,
          move
        }))
        const drops: SemiRichDiff[] = d.target.map((target, i) => ({
          edit: typehelp<'Dropped'>('Dropped'),
          target,
          ids: drags.map(drag => drag.id),
          target_diff: d.target_diffs[i],
          join_id,
          nullary,
          float,
          move
        }))
        return [...drags, ...drops]
      case 'Unchanged':
        return [d]
      case 'Dragged':
      case 'Dropped':
        return [{...d, float: true, nullary: false, move: true}]
    }
  }))
}

  // want to use & type here but TS doesn't know that eg "Edited" & "Dragged" is uninhabited

  // if they are m-1 or 1-n then they can be drawn a little more elegant
  // but for now let's just make them go through the join_id

export function enrichen_diff(diff: Diff[]): RichDiff[] {
  // id in Dragged and ids in Dropped -> new join identifier
  const join_id = {} as Record<string, string>
  const join_ids = {} as Record<string, string[]>
  const join_source = {} as Record<string, string[]>
  const join_target = {} as Record<string, string[]>
  diff.map((d: Diff) => {
    if (d.edit == 'Dropped') {
      const ji = Utils.pipesep(d.ids)
      d.ids.map(id => {
        join_id[id] = ji
      })
      join_ids[ji] = d.ids
      join_target[ji] = [...(join_target[ji] || []), d.target]
    }
  })
  diff.map((d: Diff) => {
    if (d.edit == 'Dragged') {
      const ji = join_id[d.id]
      if (join_source[ji] == undefined) {
        join_source[ji] = []
      }
      join_source[ji][join_ids[ji].indexOf(d.id)] = d.source
    }
  })
  const source_diffs = {} as Record<string, TokenDiff[]>
  const target_diffs = {} as Record<string, /* rw */ TokenDiff[]>
  const join_seen = {} as Record<string, /* rw */ number>
  Object.keys(join_ids).map(ji => {
    target_diffs[ji] = Utils.multi_token_diff(join_target[ji], join_source[ji].join('')).map(Utils.invert_token_diff)
    source_diffs[ji] = Utils.multi_token_diff(join_source[ji], join_target[ji].join(''))
    join_seen[ji] = 0
    // only keep deletes & inserts appropriately ?
  })
  return diff.map((d: Diff) => {
    switch (d.edit) {
      case 'Unchanged':
        return d

      case 'Edited': // could be represented as a drag & a drop at the same spot for consistency
        return {
          ...d,
          source_diffs: Utils.multi_token_diff(d.source, d.target.join('')),
          target_diffs: Utils.multi_token_diff(d.target, d.source.join('')).map(Utils.invert_token_diff)
          // could try to make a best guess where each part has ended up
          // same for drag and drop?
        }

      case 'Dragged': {
        const ji = join_id[d.id]
        return {
          ...d,
          source_diff: source_diffs[ji][join_ids[ji].indexOf(d.id)],
          join_id: join_id[d.id],
          rev_ids: join_target[ji].map((_, i) => ji + '_' + i)
        }
      }

      case 'Dropped': {
        const ji = Utils.pipesep(d.ids)
        return {
          ...d,
          target_diff: target_diffs[ji].shift() || [[0, "?"]],
          join_id: ji,
          rev_id: ji + '_' + join_seen[ji]++
        }
      }
    }
  })
}

function Unchanged(source: string): Diff {
  return { edit: 'Unchanged', source }
}

function Edited(target: string[], source: string[]): Diff {
  if (target.length == 1 && source.length == 1 && target[0] == source[0]) {
    return Unchanged(target[0])
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
  return Edited([target], [])
}

function Deleted(source: string): Diff {
  return Edited([], [source])
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

Todo: given a source position in spans or tokens, say where in the diff it ends up

Todo: calculate diff_match_patch here once and for all
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
      let width = 1
      while (i + width < spans.length && j == spans[i + width].links[0]) {
        width++;
      }
      out.push(Edited(spans.slice(i, i + width).map(s => s.text),
                      span.links.map((t) => tokens[t])))
      i+=width
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
        return enqueue(d)
      case 'Edited':
        return d.source.map((s, i) => {
          if (i == 0) {
            enqueue({edit: 'Edited', target: d.target.join(''), source: s})
          } else {
            enqueue({edit: 'EditedContinuation', source: s})
          }
        })
      case 'Dragged':
        return enqueue({...d, ids: [d.id]})
      case 'Dropped':
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
          const t = ld.target
          const t2 = t.slice(0, t.length - 1)
          return diff.push(Edited(tokenize(t2), [w_text(ld)]))
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
  const labels = [] as string[]
  const mspans = diff.map((d) => {
    switch (d.edit) {
      case 'Unchanged':
        return [{text: d.source, links: [i++], moved: false, labels}]
      case 'Edited':
        const links = d.source.map(() => i++)
        return d.target.map(text => ({text, links, moved: false, labels}))
      case 'Dragged':
        i++
        return []
      case 'Dropped':
        return [{text: d.target, links: d.ids.map(lookup), moved: true, labels}]
    }
  })
  return {tokens, spans: Utils.flatten(mspans)}
}

/** Change the role of source and target in a diff. */
export function invert_diff(diff: RichDiff[]): Diff[] {
  return diff.map(d => {
    switch(d.edit) {
      case 'Unchanged':
        return d
      case 'Edited':
        return Edited(d.source, d.target)
      case 'Dragged':
        return Dropped(d.source, d.rev_ids)
      case 'Dropped':
        return Dragged(d.target, d.rev_id)
    }
  })
}

/** Change the role of source and target. */
export const invert = (spans: Span[], tokens: string[]) =>
  diff_to_spans(invert_diff(enrichen_diff(calculate_diff(spans, tokens))))

