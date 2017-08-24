
import * as Spans from "./Spans"
import * as jsc from "jsverify"
import "mocha"
import { isEqual } from "lodash"

function increasing(arr: number[][]): number[][] {
  let s = 0
  return arr.map(row => row.map(cell => {
    s += 1 + Math.abs(cell)
    return s
  }))
}

describe('increasing', () => {
  jsc.property('increases', jsc.array(jsc.array(jsc.integer)), arr => {
    return Spans.increases(Spans.flatten(increasing(arr)))
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

function array_set_eq(xs: number[], ys: number[]): boolean {
  return isEqual(Spans.numsort(xs), Spans.numsort(ys))
}

describe('permute', () =>
  jsc.property('permutes',
    jsc.array(jsc.integer),
    xs => array_set_eq(xs, permute(xs)(0)))
)

/** Text not starting with whitespace */
const gen_text: jsc.Arbitrary<string> =
  jsc.suchthat(jsc.asciinestring, s => -1 == '\n\t '.indexOf(s[0]))

class Pair<A,B> {
  constructor(public readonly first: A, public readonly second: B) {}
}

const gen_spans: jsc.Generator<Spans.Span[]> = jsc.generator.bless(
  (size : number) => {
    const head = jsc.asciinestring.generator(size)
    const rest = jsc.array(gen_text).generator(Math.pow(2,size))
    const texts = [head].concat(rest).map((text) => text + ' ') // each text segment ends with whitespace
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
        return new Pair(links[index], false)
      }
    })
    return texts.map((t, i) => ({
      text: t,
      links: links_moves[i].first,
      moved: links_moves[i].second || !Spans.contiguous(links_moves[i].first),
      labels: jsc.small(jsc.array(gen_text)).generator(size)
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



const arb_spans: jsc.Arbitrary<Spans.Span[]> =
  jsc.bless({
    generator: gen_spans,
    show: (s) => jsc.show.def(s),
    shrink: jsc.shrink.nearray(
      shrink_record({
        text: shrink_mid_string,
        labels: jsc.shrink.array(shrink_mid_string),
        links: shrink_array_ends<number>(),
        moved: jsc.shrink.noop
      }))
    })

function show(x: any): string {
  return JSON.stringify(x, undefined, 2)
}

function check(spans: Spans.Span[], info: any=undefined): boolean {
  return eq('', Spans.check_invariant(spans), [spans, info])
}

function eq<A>(l: A, r: A, info: any=undefined) {
  const b = isEqual(l, r)
  if (!b) {
    console.log(show(l), "!=", show(r))
    if (info) {
      console.log(show(info))
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

describe("Spans", () => {
  jsc.property("generator conforms to invariant", arb_spans, (spans) => {
    return check(spans)
  })

  jsc.property("shrinking conforms to invariant", arb_spans, (spans) => {
    const shrunk = (arb_spans.shrink(spans) as any).headValue
    return (shrunk == undefined) || check(shrunk)
  })

  jsc.property("modify", arb_spans, jsc.asciistring, jsc.nat, jsc.nat, (spans, text, i, j) => {
    const [a,b] = Spans.numsort([i,j].map((c) => c % (Spans.text_length(spans) - 1)))
    const mods = Spans.modify(spans, a, b, text)
    return check(mods, {spans:spans, text:text, i:i, j:j}) &&
      eq(Spans.text_length(spans) - (b - a), Spans.text_length(mods) - text.length) &&
      eq(Spans.text(spans).slice(0,a) + text + Spans.text(spans).slice(b), Spans.text(mods))
  })

  describe('rearrange', () => {
    it('rearranges', () => {
      const spans = Spans.identity_spans('a b c d e f')
      assert_eq(Spans.text(Spans.rearrange(spans, 0, 1, 4)), 'c d a b e f ')
      assert_eq(Spans.text(Spans.rearrange(spans, 3, 4, 1)), 'a d e b c f ')
    })

    jsc.property("spec", arb_spans, replicate(3, jsc.nat), jsc.bool, (spans, ixs, side) => {
      const jxs = Spans.numsort(ixs.map((i) => i % spans.length))
      let a,b,d
      if (side) {
        [a,b,d] = jxs
      } else {
        [d,a,b] = jxs
      }
      if (d == a || d == b) {
        return true
      } else {
        const mods = Spans.rearrange(spans, a, b, d)
        const w = b - a
        const set_moved = spans.slice(a,b).map((s: Spans.Span) => ({...s, moved: s.links.length > 0}))
        return check(mods) &&
          eq(Spans.text_length(mods), Spans.text_length(spans)) &&
          eq(set_moved, d < a ? mods.slice(d,d+w) : mods.slice(d-w-1,d-1),
            [a,b,d, spans, mods, set_moved])
      }
    })
  })

  describe("identity_spans", () => {
    jsc.property("invariant", jsc.asciinestring, (s) =>
      check(Spans.identity_spans(s))
    )

    jsc.property("modify", jsc.asciinestring, jsc.asciinestring, replicate(2, jsc.nat), (s, text, ixs) => {
      const [a,b] = Spans.numsort(ixs.map((i) => i % s.length))
      const spans = Spans.identity_spans(s)
      const mods = Spans.modify(spans, a, b, text)
      return check(mods) && eq(s.slice(0, a) + text + s.slice(b) + ' ', Spans.text(mods))
    })
  })

  describe("auto_revert", () => {
    jsc.property("modify", jsc.asciinestring, replicate(2, jsc.nat), (s, ixs) => {
      const [a,b] = Spans.numsort(ixs.map((i) => i % s.length))
      const spans = Spans.identity_spans(s)
      const tokens = spans.map(s => s.text)
      const text = s.slice(a, b)
      const mods = Spans.auto_revert(Spans.modify(spans, a, b, text), tokens)
      return check(mods) && eq(spans, mods)
    })
  })
})

