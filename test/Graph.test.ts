import {qc} from './Common'
import * as QC from 'proptest'
import {Gen} from 'proptest'

import {graph, insert_text} from './Common'

import * as G from '../src/Graph'
import {Graph} from '../src/Graph'
import * as record from '../src/record'
import * as Utils from '../src/Utils'
import {range} from '../src/Utils'

qc('invariant', graph, (g, p) => p.equals(G.check_invariant(g), 'ok'))

import 'mocha'
import * as chai from 'chai'

const end_with_space = QC.char('ab ')
  .nestring()
  .map(Utils.end_with_space)

G.sides.forEach(side => {
  describe('set side ' + side, () => {
    qc(
      'from init',
      end_with_space.two(),
      ([a, b]) => G.get_side_text(G.set_side(G.init(a), side, b), side) === b
    )

    const gen = QC.record({graph, s: end_with_space})

    qc('sets', gen, ({graph, s}) => G.get_side_text(G.set_side(graph, side, s), side) === s)

    qc(
      'preserves opposite',
      gen,
      ({graph, s}) =>
        G.get_side_text(G.set_side(graph, side, s), G.opposite(side)) ===
        G.get_side_text(graph, G.opposite(side))
    )

    qc('preserves invariant', gen, ({graph, s}, p) =>
      p.equals('ok', G.check_invariant(p.tap(G.set_side(graph, side, s))))
    )
  })
})

describe('modify_tokens', () => {
  const modify = graph.chain(g =>
    QC.range(g.target.length)
      .replicate(2)
      .map(Utils.numsort)
      .chain(([from, to]) => insert_text.map(text => ({g, from, to, text})))
  )

  qc('modify_tokens invariant', modify, ({g, from, to, text}, p) =>
    p.equals(G.check_invariant(G.modify_tokens(g, from, to, text)), 'ok')
  )

  qc('modify_tokens content', modify, ({g, from, to, text}, p) => {
    const [a, mid, z] = Utils.splitAt3(G.target_texts(g), from, to)
    const lhs = Utils.end_with_space([...a, text, ...z].join(''))
    const mod = G.modify_tokens(g, from, to, text)
    const rhs = G.target_text(mod)
    return p.equals(lhs, rhs)
  })
})

describe('invert', () =>
  qc('is not involutive', graph, (g, p) => p.equals(G.invert(G.invert(g)), g), QC.expectFailure))

describe('unaligned_invert', () =>
  qc('is involutive', graph, (g, p) => p.equals(G.unaligned_invert(G.unaligned_invert(g)), g)))

interface Modify {
  g: Graph
  from: number
  to: number
  text: string
}

describe('modify', () => {
  function use_gen(modify: QC.Gen<Modify>, suffix = '') {
    qc('modify invariant' + suffix, modify, ({g, from, to, text}, p) =>
      p.equals(G.check_invariant(p.tap(G.modify(g, from, to, text))), 'ok')
    )

    qc('modify content' + suffix, modify, ({g, from, to, text}, p) => {
      const [a, mid, z] = Utils.stringSplitAt3(G.target_text(g), from, to)
      const lhs = Utils.end_with_space(a + text + z)
      const mod = G.modify(g, from, to, text)
      const rhs = G.target_text(mod)
      // Utils.stdout({g, from, to, text, mod, a, mid, z, lhs, rhs})
      return p.equals(lhs, rhs)
    })
  }

  use_gen(
    graph.chain(g =>
      QC.range(G.target_text(g).length + 1)
        .replicate(2)
        .map(Utils.numsort)
        .chain(([from, to]) => insert_text.map(text => ({g, from, to, text})))
    )
  )

  use_gen(
    graph.chain(g =>
      QC.between(Math.max(0, G.target_text(g).length - 1), G.target_text(g).length)
        .replicate(2)
        .map(Utils.numsort)
        .chain(([from, to]) => insert_text.map(text => ({g, from, to, text})))
    ),
    ' at end'
  )

  use_gen(
    graph.chain(g =>
      QC.between(0, 1)
        .replicate(2)
        .map(Utils.numsort)
        .chain(([from, to]) => insert_text.map(text => ({g, from, to, text})))
    ),
    ' in the beginning'
  )

  /*
  quickCheck('modify links', modify, ({g, from, to, text}, assert, skip, count) => {
    // properties about links:
    // within segment: superset of all links that are within bound
    // partially outside segment: now part of the new component
    // wholly outside segment: preserved

    // const cov = (pred: boolean, pct: number, s: string) => (p.cover(!pred, pct, s), pred)
    //
    // if (cov(null != text.match(/^\s*$/), 80, 'whitespace-only replacement')) {
    //   return true
    // }

    if (text.match(/^\s*$/)) {
      skip('whitespace-only replacement')
      return true
    }
    const mod = G.modify(g, from, to, text)
    const inside_before = new Set<string>()
    for (let i = from; i <= to; i++) {
      G.related(g, G.token_at(G.target_texts(g), i).token).forEach(id => inside_before.add(id))
    }
    const inside_after = new Set<string>()
    for (let i = from; i <= from + text.length; i++) {
      if (i >= G.target_text(mod).length) {
        skip('too big!')
        continue
      }
      G.related(mod, G.token_at(G.target_texts(mod), i).token).forEach(id => inside_after.add(id))
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
      const rel_before = new Set(G.related(g, G.token_at(G.target_texts(g), before).token))
      const rel_after = new Set(G.related(mod, G.token_at(G.target_texts(mod), after).token))
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
  */
})

describe('rearrange', () => {
  const rearrange = graph.chain(g =>
    QC.range(g.target.length).chain(dest =>
      QC.range(g.target.length)
        .replicate(2)
        .map(Utils.numsort)
        .map(([begin, end]) => ({g, begin, end, dest}))
    )
  )

  qc('rearrange invariant', rearrange, ({g, begin, end, dest}, p) =>
    p.equals(G.check_invariant(G.rearrange(g, begin, end, dest)), 'ok')
  )

  qc('rearrange length', rearrange, ({g, begin, end, dest}) => {
    const mod = G.rearrange(g, begin, end, dest)
    return G.target_text(mod).length == G.target_text(g).length
  })

  qc('rearrange tokens', rearrange, ({g, begin, end, dest}) => {
    const mod = G.rearrange(g, begin, end, dest)
    return G.target_texts(mod).length == G.target_texts(g).length
  })

  qc('rearrange permutation', rearrange, ({g, begin, end, dest}) => {
    const mod = G.rearrange(g, begin, end, dest)
    return Utils.array_multiset_eq(G.target_texts(mod), G.target_texts(g))
  })
})

describe('diff', () => {
  qc('diff roundtrip', graph, (g, p) => p.equals(g, G.diff_to_graph(G.calculate_diff(g), g.edges)))

  qc('diff target text preversed', graph, g => {
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
    return G.target_text(g) == G.text(target)
  })

  qc('diff source text preversed', graph, g => {
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
    return G.source_text(g) == G.text(source)
  })

  qc('diff edge set preserved', graph, g => {
    const diff = G.calculate_diff(g)
    const edge_ids = diff.map(d => d.id)
    return Utils.array_set_eq(edge_ids, record.traverse(g.edges, e => e.id))
  })
})

{
  const sentence = graph.chain(g => QC.between(0, g.target.length).map(i => ({g, i})))

  qc('sentences subgraph invariant', sentence, ({g, i}, p) =>
    p.equals(G.check_invariant(G.subgraph(g, p.tap(G.sentences(g, i)))), 'ok')
  )
}

{
  const graph_and_edge = graph.chain(g =>
    QC.choose(Object.values(g.edges)).map(edge => ({g, edge}))
  )

  qc('revert preserves invariant', graph_and_edge, ({g, edge}, p) => {
    const reverted = G.revert(g, [edge.id])
    return p.equals(G.check_invariant(reverted), 'ok')
  })

  qc('revert preservers source text', graph_and_edge, ({g, edge}, p) => {
    const reverted = G.revert(g, [edge.id])
    const rsource = G.source_texts(reverted)
    const source = G.source_texts(g)
    return p.equals(rsource, source)
  })

  qc('revert everything', graph, (g, p) =>
    G.equal(
      p.tap(G.init_from(G.source_texts(g)), 'init'),
      p.tap(G.revert(g, Object.keys(g.edges)), 'reverted')
    )
  )
}
