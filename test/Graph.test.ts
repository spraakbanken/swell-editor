import * as G from "../src/Graph"
import { Graph } from "../src/Graph"
import * as Utils from "../src/Utils"
import * as test from 'tape'
;(global as any).it = () => { throw "don't use 'it'" }
import * as jsc from "jsverify"


function permute<A>(xs: A[]): jsc.Generator<A[]> {
  return jsc.generator.bless(() => {
    let ys = xs.slice()
    // fisher-yates shuffle
    for (let i = 0; i < ys.length - 1; i++) {
      const j = jsc.random(i + 1, ys.length - 1);
      [ys[i], ys[j]] = [ys[j], ys[i]]
    }
    return ys
  })
}

function quickCheck<A>(name: string, arb: jsc.Arbitrary<A>, k: (a: A, assert: test.Test) => boolean) {
  test(name, assert => {
    assert.is(jsc.checkForall(arb, a => k(a, assert)), true)
    assert.end()
  })
}

quickCheck('permute', jsc.array(jsc.integer),
  xs => Utils.array_multiset_eq(xs, permute(xs)(0))
)

function nearray<A>(g: jsc.Arbitrary<A>) {
  return jsc.pair(g, jsc.array(g)).smap<A[]>(
    ([a, as]) => [a].concat(as),
    as => [as[0], as.slice(1)])
}

quickCheck('nearray', nearray(jsc.integer),
  xs => xs.length > 0
)

function alphabet(cs: string): jsc.Arbitrary<string> {
  return jsc.array(
    jsc.oneof<string>(Utils.str_map(cs, c => jsc.constant(c)))
  ).smap((ss) => ss.join(''), (s) => Utils.str_map(s, c => c))
}

function nealphabet(cs: string): jsc.Arbitrary<string> {
  return nearray(
    jsc.oneof<string>(Utils.str_map(cs, c => jsc.constant(c)))
  ).smap((ss) => ss.join(''), (s) => Utils.str_map(s, c => c))
}

const token_text: jsc.Arbitrary<string> =
  jsc.pair(nealphabet('abc'), nealphabet(' '))
     .smap(([a, b]) => a + b, Utils.whitespace_split)

/** All numbers up to and excluding the argument number

  range(0) // => []
  range(1) // => [0]
  range(4) // => [0, 1, 2, 3]

*/
function range(to: number) {
  const out = []
  for (let i = 0; i < to; ++i) {
    out.push(i)
  }
  return out
}

function replicate<A>(n: number, g: jsc.Arbitrary<A>): jsc.Arbitrary<A[]> {
  const gs = [] as jsc.Arbitrary<A>[]
  for(let i=0; i<n; ++i) {
    gs.push(g)
  }
  return jsc.tuple(gs) as jsc.Arbitrary<A[]>
}


/** Generate a random graph */
const gen_graph = jsc.generator.bless(
  (sizein: number) => {
    const size = Math.max(2, Math.round(sizein / 8))
    const ssize = jsc.random(1, size - 1)
    const tsize = size - ssize
    const source = replicate(ssize, token_text).generator(sizein).map((text, i) => ({text, id: 's' + i}))
    const target = replicate(tsize, token_text).generator(sizein).map((text, i) => ({text, id: 't' + i}))
    const esize = jsc.random(1, Math.min(ssize, tsize))
    const edges = replicate(esize, token_text).generator(sizein).map((label) => ({labels: [label], ids: [] as string[]}))
    const sedges = permute(range(ssize).map(i => i % esize))(sizein)
    const tedges = permute(range(tsize).map(i => i % esize))(sizein)
    source.forEach(s => edges[sedges.pop() as number].ids.push(s.id))
    target.forEach(t => edges[tedges.pop() as number].ids.push(t.id))
    return {source, target, edges}
  }
)

const arb_graph: jsc.Arbitrary<Graph> =
  jsc.bless({
    generator: gen_graph,
    show: jsc.show.def,
    shrink: jsc.shrink.noop
  })

quickCheck('invariant', arb_graph, g =>
  G.check_invariant(g) == "ok"
)

{
  const arb_modify_tokens =
    jsc.record({
      g: arb_graph,
      from: jsc.nat,
      to: jsc.nat,
      text: alphabet('ab ')
    }).smap(({g, from, to, text}) => {
      const n = g.target.length
      const [a, b] = Utils.numsort([from % n, to % n])
      return {g, from: a, to: b, text}
    }, t => t)

  quickCheck('modify_tokens invariant', arb_modify_tokens, ({g, from, to, text}) =>
    G.check_invariant(G.modify_tokens(g, from, to, text)) == "ok"
  )

  quickCheck('modify_tokens content', arb_modify_tokens, ({g, from, to, text}, assert) => {
    const [a, mid, z] = Utils.splitAt3(G.target_texts(g), from, to)
    const lhs = a.concat([text], z).join('').trim()
    const rhs = G.target_text(G.modify_tokens(g, from, to, text)).trim()
    return lhs === rhs
  })

}

{
  const arb_modify =
    jsc.record({
      g: arb_graph,
      from: jsc.nat,
      to: jsc.nat,
      text: alphabet('ab ')
    }).smap(({g, from, to, text}) => {
      const n = g.target.map(t => t.text).join('').length
      const [a, b] = Utils.numsort([from % n, to % n])
      return {g, from: a, to: b, text}
    }, t => t)

  quickCheck('modify invariant', arb_modify, ({g, from, to, text}) =>
    G.check_invariant(G.modify(g, from, to, text)) == "ok"
  )

  quickCheck('modify content', arb_modify, ({g, from, to, text}, assert) => {
    const [a, mid, z] = Utils.stringSplitAt3(G.target_text(g), from, to)
    const lhs = (a + text + z).trim()
    const mod = G.modify(g, from, to, text)
    const rhs = mod.target.map(t => t.text).join('').trim()
    return lhs === rhs
  })

  quickCheck('modify links', arb_modify, ({g, from, to, text}, assert) => {
    const [a, mid, z] = Utils.stringSplitAt3(G.target_text(g), from, to)
    const lhs = (a + text + z).trim()
    const mod = G.modify(g, from, to, text)
    const rhs = G.target_text(mod).trim()
    return lhs === rhs
  })

  // properties about links:
  // within segment: superset of all links that are within bound
  // partially outside segment: now part of the new component
  // wholly outside segment: preserved
}
