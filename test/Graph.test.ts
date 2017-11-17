;(global as any).it = () => { throw "don't use 'it'" }
import * as jsc from "jsverify"
import * as test from 'tape'

import * as T from "../src/Token"
import * as G from "../src/Graph"
import { Graph } from "../src/Graph"
import * as Utils from "../src/Utils"
import { range } from "../src/Utils"

function permute<A>(xs: A[]): jsc.Generator<A[]> {
  return jsc.generator.bless(() => {
    let ys = xs.slice()
    // Fisher-Yates shuffle
    for (let i = 0; i < ys.length - 1; i++) {
      const j = jsc.random(i + 1, ys.length - 1);
      [ys[i], ys[j]] = [ys[j], ys[i]]
    }
    return ys
  })
}

function quickCheck<A>(name: string, arb: jsc.Arbitrary<A>, k: (a: A, assert: test.Test, skip: (reason?: string) => void, count: () => void) => boolean) {
  let skips = 0
  let counted = 0
  const skip = (reason: string = '') => {
    skips++
  }
  test(name, assert => {
    assert.is(jsc.checkForall(arb, a => k(a, assert, skip, () => counted++)), true)
    assert.end()
    if (counted > 0) {
      console.warn()
      console.warn(name, 'skipped: ' + skips + '/' + counted + ' (' + Math.round((skips * 100.0) / counted) + '%)')
      console.warn()
    }
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

const Ss_text: jsc.Arbitrary<string> =
  jsc.pair(nealphabet('abc'), nealphabet(' '))
     .smap(([a, b]) => a + b, Utils.whitespace_split)

const token_text: jsc.Arbitrary<string> =
  jsc.pair(alphabet(' '), Ss_text)
     .smap(([a, b]) => a + b, Utils.initial_whitespace_split)

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
    const size = Math.max(2, Math.round(sizein))
    const ssize = jsc.random(1, size - 1)
    const tsize = size - ssize
    const source = replicate(ssize, token_text).generator(sizein).map((text, i) => ({text, id: 's' + i}))
    const target = replicate(tsize, token_text).generator(sizein).map((text, i) => ({text, id: 't' + i}))
    const esize = jsc.random(1, Math.min(ssize, tsize))
    const proto_edges = replicate(esize, token_text).generator(sizein).map((label) => ({ids: [] as string[], labels: [label]}))
    const sedges = permute(range(ssize).map(i => i % esize))(sizein)
    const tedges = permute(range(tsize).map(i => i % esize))(sizein)
    source.forEach(s => proto_edges[sedges.pop() as number].ids.push(s.id))
    target.forEach(t => proto_edges[tedges.pop() as number].ids.push(t.id))
    return {source, target, edges: G.edge_record(proto_edges.map(e => G.Edge(e.ids, e.labels)))}
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
    const lhs = a.concat([text], z).join('')
    const mod = G.modify_tokens(g, from, to, text)
    const rhs = G.target_text(mod)
    // assert.equal(lhs, rhs)
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
    const lhs0 = (a + text + z)
    const lhs = lhs0.match(/^\s*$/) ? '' : lhs0
    const mod = G.modify(g, from, to, text)
    const rhs = G.target_text(mod)
    console.log(Utils.show({g, from, to, text, mod, a, mid, z, lhs, rhs}))
    assert.equal(lhs, rhs)
    return lhs === rhs
  })

  quickCheck('modify links', arb_modify, ({g, from, to, text}, assert, skip, count) => {
    // properties about links:
    // within segment: superset of all links that are within bound
    // partially outside segment: now part of the new component
    // wholly outside segment: preserved

    if (text.match(/^\s*$/)) {
      skip('whitespace-only replacement')
      return true
    }
    const mod = G.modify(g, from, to, text)
    const inside_before = new Set<string>()
    for (let i = from; i <= to; i++) {
      G.related(g, T.token_at(G.target_texts(g), i).token).forEach(id => inside_before.add(id))
    }
    const inside_after = new Set<string>()
    for (let i = from; i <= from + text.length; i++) {
      if (i >= G.target_text(mod).length) {
        skip('too big!')
        continue
      }
      G.related(mod, T.token_at(G.target_texts(mod), i).token).forEach(id => inside_after.add(id))
    }
    const w = to - from
    for (const before of range(G.target_text(g).length)) {
      // console.log(Utils.show({g, from, to, text, mod, before}))
      let after
      if (before < from) {
        after = before
        assert.equal(G.target_text(g)[before], G.target_text(g)[after], "pre " + after)
      } else if (before >= to) {
        after = before - w + text.length
        if (after >= G.target_text(mod).length) {
          skip('post')
          continue
        }
        assert.equal(G.target_text(g)[before], G.target_text(mod)[after], "post: " + after)
      } else {
        after = before
        if (after >= from + text.length) {
          skip('replaced')
          continue
        }
        if (after >= G.target_text(mod).length) {
          console.error('replaced')
          continue
        }
        assert.equal(text[before - from], G.target_text(mod)[after], "replaced: " + after)
      }
      // console.log(Utils.show({after}))
      if (after >= G.target_text(mod).length) {
        skip('after too big')
        continue
      }
      const rel_before = new Set(G.related(g, T.token_at(G.target_texts(g), before).token))
      const rel_after = new Set(G.related(mod, T.token_at(G.target_texts(mod), after).token))
      const sets = {
        inside_before: [...inside_before.keys()],
        inside_after: [...inside_after.keys()],
        rel_before: [...rel_before.keys()],
        rel_after: [...rel_after.keys()]
      }
      const overlaps = {
        before: Utils.overlaps(rel_before, inside_before),
        after: Utils.overlaps(rel_after, inside_after)
      }
      // console.log(Utils.show({sets, overlaps}))
      assert.equal(overlaps.before, overlaps.after)
      count()
    }
    return true
  })

}

{
  const arb_rearrange =
    jsc.record({
      g: arb_graph,
      begin: jsc.nat,
      end: jsc.nat,
      dest: jsc.nat,
    }).smap(({g, begin, end, dest}) => {
      const n = g.target.length
      const [a, b] = Utils.numsort([begin % n, end % n])
      return {g, begin: a, end: b, dest: dest % n}
    }, t => t)

  quickCheck('rearrange invariant', arb_rearrange, ({g, begin, end, dest}) =>
    G.check_invariant(G.rearrange(g, begin, end, dest)) == "ok"
  )

  quickCheck('rearrange length', arb_rearrange, ({g, begin, end, dest}) => {
    const mod = G.rearrange(g, begin, end, dest)
    return G.target_text(mod).length == G.target_text(g).length
  })

  quickCheck('rearrange tokens', arb_rearrange, ({g, begin, end, dest}) => {
    const mod = G.rearrange(g, begin, end, dest)
    return G.target_texts(mod).length == G.target_texts(g).length
  })

  quickCheck('rearrange permutation', arb_rearrange, ({g, begin, end, dest}) => {
    const mod = G.rearrange(g, begin, end, dest)
    return Utils.array_multiset_eq(G.target_texts(mod), G.target_texts(g))
  })
}

{
  quickCheck('diff target text preversed', arb_graph, g => {
    const diff = G.calculate_diff(g)
    const target = Utils.flatMap(diff, d => {
      if (d.edit == 'Dropped') {
        return [d.target]
      } else if (d.edit == 'Edited') {
        return d.target
      } else {
        return []
      }
    })
    return G.target_text(g) == T.text(target)
  })

  quickCheck('diff source text preversed', arb_graph, g => {
    const diff = G.calculate_diff(g)
    const source = Utils.flatMap(diff, d => {
      if (d.edit == 'Dragged') {
        return [d.source]
      } else if (d.edit == 'Edited') {
        return d.source
      } else {
        return []
      }
    })
    return G.source_text(g) == T.text(source)
  })

  quickCheck('diff edge set preserved', arb_graph, g => {
    const diff = G.calculate_diff(g)
    const edge_ids = diff.map(d => d.id)
    return Utils.array_set_eq(edge_ids, Utils.record_traverse(g.edges, e => e.id))
  })
}

{
  const arb_sentence =
    jsc.record({
      g: arb_graph,
      i: jsc.nat,
    }).smap(
      ({g, i}) => ({g, i: i % g.target.length}),
      t => t
    )

  quickCheck('sentence subgraph invariant', arb_sentence, ({g, i}) =>
    G.check_invariant(G.subgraph(g, G.sentence(g, i))) === 'ok'
  )
}
