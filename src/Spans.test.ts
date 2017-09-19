; (global as any)['document'] = require('xmlshim')
; (global as any)['XMLSerializer'] = require('xmlshim').XMLSerializer
; (global as any)['DOMParser'] = require('xmlshim').DOMParser

import * as Utils from "./Utils"
import * as Spans from "./Spans"
import * as jsc from "jsverify"
import { isEqual } from "lodash"
import "mocha"

function increasing(arr: number[][]): number[][] {
  let s = 0
  return arr.map(row => row.map(cell => {
    s += 1 + Math.abs(cell)
    return s
  }))
}

describe('increasing', () => {
  jsc.property('increases', jsc.array(jsc.array(jsc.integer)), arr => {
    return Utils.increases(Utils.flatten(increasing(arr)))
  })

  jsc.property('preserves lengths', jsc.array(jsc.array(jsc.integer)), arr =>
    arr.length == increasing(arr).length &&
    increasing(arr).every((row, i) =>
      arr.length > i && arr[i].length == row.length)
  )
})

function permute<A>(xs: A[]): jsc.Generator<A[]> {
  return jsc.generator.bless(() => {
    let ys = xs.slice()
    for (let i = 0; i < ys.length - 1; i++) {
      const j = jsc.random(i + 1, ys.length - 1);
      [ys[i], ys[j]] = [ys[j], ys[i]]
    }
    return ys
  })
}

describe('permute', () =>
  jsc.property('permutes',
    jsc.array(jsc.integer),
    xs => Utils.array_multiset_eq(xs, permute(xs)(0)))
)

function alphabet(cs: string): jsc.Arbitrary<string> {
  return jsc.array(
    jsc.oneof<string>(Utils.str_map(cs, c => jsc.constant(c)))
  ).smap((ss) => ss.join(''), (s) => Utils.str_map(s, c => c))
}

function nealphabet(cs: string): jsc.Arbitrary<string> {
  return jsc.nearray(
    jsc.oneof<string>(Utils.str_map(cs, c => jsc.constant(c)))
  ).smap((ss) => ss.join(''), (s) => Utils.str_map(s, c => c))
}

const pipe_text: jsc.Arbitrary<string> = alphabet('|\\ab ')

const head_text: jsc.Arbitrary<string> = alphabet('|\\ab ')

/** Text not starting with whitespace */
const tail_text: jsc.Arbitrary<string> = head_text.smap(s => 'a' + s, a_s => a_s.slice(1))

class Pair<A,B> {
  constructor(public readonly first: A, public readonly second: B) {}
}

const gen_spans: jsc.Generator<Spans.Span[]> = jsc.generator.bless(
  (size : number) => {
    const toks = jsc.nearray(tail_text).generator(Math.pow(2,size))
    const texts = toks.map((text) => text + ' ') // make sure each text segment ends with whitespace
    const links = increasing(texts.map(_ => jsc.small(jsc.array(jsc.integer)).generator(size)))

    /** indexes to move */
    const moves = links.map((links, index) => new Pair(links, index))
                       .filter(p => p.first.length > 0 && jsc.bool.generator(size))
                       .map(p => p.second)
    const perm = new Map(permute(moves)(size).map((v, i): [number, number] => [v, moves[i]]))
    const links_moves = links.map((_, index) => {
      const dest = perm.get(index)
      if (dest != undefined) {
        return new Pair(links[dest], true)
      } else {
        return new Pair(permute(links[index])(size), false)
      }
    })
    return texts.map((t, i) => ({
      text: t,
      links: links_moves[i].first,
      moved: links_moves[i].second || !Utils.contiguous(links_moves[i].first),
      labels: jsc.small(jsc.array(tail_text)).generator(size)
    }))
  })

const shrink_mid_string: jsc.Shrink<string> = jsc.shrink.bless<string>((s) => {
  const smaller = [] as string[]
  for (let i = 1; i < s.length - 1; i++) {
    smaller.push(s.slice(0,i) + s.slice(i+1))
  }
  return smaller
})

function shrink_record<T>(shr: { [P in keyof T]: jsc.Shrink<T[P]> }): jsc.Shrink<T> {
  return (jsc as any).shrink.record(shr)
}

function shrink_array_ends<T>(): jsc.Shrink<T[]> {
  return jsc.shrink.bless(
    (arr: T[]) => {
      if (arr.length < 2) {
        return []
      } else {
        return [arr.slice(1), arr.slice(0,arr.length-2)]
      }
    })
}

function shrink_nats(): jsc.Shrink<number[]> {
  return jsc.shrink.bless(
    (xs: number[]) => {
      const out = [] as number[][]
      if (xs.some(x => x > 100)) {
        out.push(xs.map(x => x > 100 ? x - 100 : x))
      }
      if (xs.some(x => x > 10)) {
        out.push(xs.map(x => x > 10 ? x - 10 : x))
      }
      if (xs.some(x => x > 0)) {
        out.push(xs.map(x => Math.abs(x - 1)))
      }
      if (xs.length >= 2) {
        out.push(xs.slice(1))
        out.push(xs.slice(0,xs.length - 2))
      }
      return out
    })
}

const arb_spans: jsc.Arbitrary<Spans.Span[]> =
  jsc.bless({
    generator: gen_spans,
    show: (s) => jsc.show.def(s),
    shrink: jsc.shrink.nearray(
      shrink_record({
        text: shrink_mid_string,
        labels: jsc.shrink.array(shrink_mid_string),
        links: shrink_nats(),
        moved: jsc.shrink.noop
      }))
    })

function check(spans: Spans.Span[], info: any=undefined): boolean {
  return eq('', Spans.check_invariant(spans), [spans, info])
}

function eq<A>(l: A, r: A, info: any=undefined) {
  const b = isEqual(l, r)
  if (!b) {
    console.log(Utils.show(l), "!=", Utils.show(r))
    if (info) {
      console.log(Utils.show(info))
    }
  }
  return b
}

function assert_eq<A>(l: A, r: A, info: any=undefined) {
  if (!eq(l, r, info)) {
    throw new Error('assert_eq')
  }
}

function replicate<A>(n: number, g: jsc.Arbitrary<A>): jsc.Arbitrary<A[]> {
  const gs = [] as jsc.Arbitrary<A>[]
  for(let i=0; i<n; ++i) {
    gs.push(g)
  }
  return jsc.tuple(gs) as jsc.Arbitrary<A[]>
}

const LaxDiff: jsc.Arbitrary<Spans.LaxDiff> =
  jsc.record({
    edit: alphabet('Abcd'),
    target: jsc.oneof([alphabet(':\| a1'), jsc.constant(undefined)]),
    ids: jsc.oneof([jsc.nearray(nealphabet('1234567890')), jsc.constant(undefined)]),
  })

type Rearrange = { kind: 'Rearrange', ixs: number[], side: boolean }
type Modify = { kind: 'Modify', ixs: number[], text: string }
type Api = Rearrange | Modify
//  Revert part of this API?

const Rearrange: jsc.Arbitrary<Rearrange> =
  jsc.record({
    kind: jsc.constant('Rearrange' as 'Rearrange'),
    ixs: replicate(3, jsc.nat),
    side: jsc.bool
  })

const Modify: jsc.Arbitrary<Modify> =
  jsc.record({
    kind: jsc.constant('Modify' as 'Modify'),
    ixs: replicate(2, jsc.nat),
    text: jsc.asciistring
  })

const Call: jsc.Arbitrary<Api> = jsc.either(Rearrange, Modify)
const Calls: jsc.Arbitrary<Api[]> = jsc.array(Call)

function restrictRearrange(spans: Spans.Span[], r: Rearrange): {begin: number, end: number, dest: number} | null {
  const jxs = Utils.numsort(r.ixs.map((i) => i % spans.length))
  let begin, end, dest: number
  if (r.side) {
    [begin,end,dest] = jxs
  } else {
    [dest,begin,end] = jxs
  }
  if (dest == begin || dest == end) {
    return null
  } else {
    return {begin, end, dest}
  }
}

// FIX: fail graciously if spans.length == 0
function restrictModify(spans: Spans.Span[], r: Modify): {begin: number, end: number} {
  const [begin, end] = Utils.numsort(r.ixs.map((i) => i % spans.length))
  return {begin, end}
}

describe("Utils", () => {
  jsc.property("multi_token_diff", jsc.nearray(nealphabet('ab ')), alphabet('ab '), (ss, s2) => {
    const md = Utils.multi_token_diff(ss, s2)
    const info = {ss, s2, md}
    return eq(md.map(Utils.dmp.diff_text1), ss, ['ss', info]) &&
           eq(Utils.dmp.diff_text2(Utils.flatten(md)), s2, ['s2', info]) &&
           eq(flatten(md), Utils.token_diff(ss.join(''), s2), ['flatten', info])
  })
})

describe("Spans", () => {
  jsc.property("generator conforms to invariant", arb_spans, (spans) => {
    return check(spans)
  })

  jsc.property("shrinking conforms to invariant", arb_spans, (spans) => {
    const shrunk = (arb_spans.shrink(spans) as any).headValue
    return (shrunk == undefined) || check(shrunk)
  })

  jsc.property("modify", arb_spans, Modify, (spans, m) => {
    const {begin, end} = restrictModify(spans, m)
    const mods = Spans.modify(spans, begin, end, m.text)
    const info = {spans, mods, text:m.text, begin, end}
    return check(mods, info) &&
      eq(Utils.ltrim(Spans.text(spans).slice(0,begin) + m.text + Spans.text(spans).slice(end)), Spans.text(mods), info)
  })

  describe('rearrange', () => {
    it('rearranges', () => {
      const spans = Spans.identity_spans('a b c d e f')
      assert_eq(Spans.text(Spans.rearrange(spans, 0, 1, 4)), 'c d a b e f ')
      assert_eq(Spans.text(Spans.rearrange(spans, 3, 4, 1)), 'a d e b c f ')
    })

    jsc.property("spec", arb_spans, Rearrange, (spans, m) => {
      const r = restrictRearrange(spans, m)
      if (!r) {
        return true
      } else {
        const {begin, dest, end} = r
        const mods = Spans.rearrange(spans, begin, end, dest)
        const w = end - begin
        const set_moved = spans.slice(begin,end).map((s: Spans.Span) => ({...s, moved: s.links.length > 0}))
        const info = {begin, end, dest, spans, mods, set_moved}
        return check(mods, info) &&
          eq(Spans.text_length(mods), Spans.text_length(spans), info) &&
          eq(set_moved, dest < begin ? mods.slice(dest,dest+w) : mods.slice(dest-w-1,dest-1), info)
      }
    })
  })

  describe("identity_spans", () => {
    jsc.property("invariant", jsc.asciistring, (s) =>
      check(Spans.identity_spans(s), s)
    )

    jsc.property("modify", tail_text, Modify, (s, m) => {
      const spans = Spans.identity_spans(s)
      const {begin, end} = restrictModify(spans, m)
      const mods = Spans.modify(spans, begin, end, m.text)
      return check(mods) && eq(Utils.ltrim(s.slice(0, begin) + m.text + s.slice(end) + ' '), Spans.text(mods))
    })
  })

  describe("auto_revert", () => {
    jsc.property("identity modify", tail_text, Modify, (s, m) => {
      const spans = Spans.identity_spans(s)
      const tokens = spans.map(s => s.text)
      const {begin, end} = restrictModify(spans, m)
      const text = s.slice(begin, end)
      const mods = Spans.auto_revert(Spans.modify(spans, begin, end, text), tokens)
      return check(mods) && eq(spans, mods)
    })
  })

  describe("escape_pipe", () => {
    jsc.property("invertible", pipe_text, (x) =>
      eq(x, Utils.unescape_pipe(Utils.escape_pipe(x)), Utils.escape_pipe(x))
    )
  })

  describe("pipesep", () => {
    jsc.property("invertible", jsc.array(pipe_text), (xs: string[]) => {
      const ps = Utils.pipesep(xs)
      const us = Utils.pipeunsep(ps)
      const info = {xs, ps, us}
      return eq(true, Utils.shallow_array_eq(xs, us), info)
    })
  })

  describe("pretty_lax", () => {
    jsc.property("invertible", LaxDiff, (d: Spans.LaxDiff) => {
      const pd = Spans.pretty_lax(d)
      const d2 = Spans.parse_lax(pd)
      return eq(true, isEqual(d, d2), {d, pd, d2})
    })
  })

  describe("diff", () => {
    jsc.property("invertible", arb_spans, jsc.nearray(nealphabet('|\\ab')), (spans, tokens) => {
      const max = Utils.flatten(spans.map(s => s.links)).reduce((x,y) => Math.max(x,y), 0)
      const tokens2 = Utils.cycle(max + 1, tokens)
      const spans2 = spans.map(s => ({...s, labels: []}))
      const diff = Spans.calculate_diff(spans, tokens2)
      const res = Spans.diff_to_spans(diff)
      const info = {} // {spans2, tokens2, diff, res}
      return eq(true, isEqual({spans: spans2, tokens: tokens2}, res), info)
    })
  })

  describe("xml diff", () => {
    jsc.property("invertible", arb_spans, jsc.nearray(nealphabet('|\\ab')), (spans, tokens) => {
      const max = Utils.flatten(spans.map(s => s.links)).reduce((x,y) => Math.max(x,y), 0)
      const tokens2 = Utils.cycle(max + 1, tokens)
      const spans2 = spans.map(s => ({...s, labels: []}))
      const diff = Spans.calculate_diff(spans, tokens2)
      const xml = Spans.diff_to_xml(diff)
      const xml_string = new XMLSerializer().serializeToString(xml)
      const diff2 = Spans.xml_to_diff(xml_string)
      const res = Spans.diff_to_spans(diff2)
      const info = {} // {spans2, tokens2, diff, diff2, res}
      return eq(true, isEqual({spans: spans2, tokens: tokens2}, res), info)
    })
  })

})

