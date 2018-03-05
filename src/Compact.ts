import * as R from 'ramda'

import {Parser} from 'parser-ts'
import * as p from 'parser-ts'
import * as pchar from 'parser-ts/lib/char'
import * as pstr from 'parser-ts/lib/string'

import * as T from './Token'
import * as G from './Graph'
import {Graph} from './Graph'
import * as Utils from './Utils'
import {UnionFind} from './Utils'
import * as D from './Diff'
import {Diff} from './Diff'

type Link = {tag: 'text'; text: string} | {tag: 'id'; id: string} | {tag: 'unlinked'}

const idLink = (id: string): Link => ({tag: 'id', id})

interface Attributes {
  ids: string[]
  labels: string[]
  links: Link[]
}

export interface Unit extends Attributes {
  text: string
}

const run_parser = <A>(p: Parser<A>, input: string): A | null =>
  p.run(input).bimap(_ => null, x => x[0]).value

const run_parser_strict = <A>(p: Parser<A>, input: string): A => {
  const r = run_parser(p, input)
  if (r === null) {
    throw 'Parse failed on input: ' + input
  } else {
    return r
  }
}

/**
  run_parser(space_, '_') // => '_'
  run_parser(space_, ' ') // => ' '
  run_parser(space_, '!') // => null
*/
const space_ = pchar.oneOf(' \n\t_')
const spaces_ = pstr.many(space_)
const spaces1_ = pstr.many1(space_)

const quote = pchar.char(`'`)

/**
  run_parser(quoted, `'apa'`) // => `apa`
  run_parser(quoted, `apa`) // => null
  run_parser(quoted, `'apa`) // => null
  run_parser(quoted, `apa'`) // => null
  run_parser(quoted, `'a'a'`) // => `a`
  run_parser(quoted, `'\\\\'`) // => `\\`
  run_parser(quoted, `'\\''`) // => `'`
*/
const quoted = quote
  .chain(_ =>
    pstr.many(
      p.alts(
        pstr.string(`\\\\`).map(_ => `\\`),
        pstr.string(`\\'`).map(_ => `'`),
        pchar.notOneOf(`'\\`)
      )
    )
  )
  .chain(s => quote.chain(_ => p.succeed(s)))

const head = pchar.notOneOf(` '_\t\n:@^~`)
const tail = pstr.many(pchar.notOneOf(` _\t\n:@^~`))

/**
  run_parser(word, `'apa'`) // => `apa`
  run_parser(word, `apa`) // => `apa`
  run_parser(word, `'apa`) // => null
  run_parser(word, `apa'`) // => `apa'`
  run_parser(word, `'a'a'`) // => `a`
  run_parser(word, `'\\\\'`) // => `\\`
  run_parser(word, `'\\''`) // => `'`
  run_parser(word, `a b`) // => `a`
  run_parser(word, `a_b`) // => `a`
  run_parser(word, `a:b`) // => `a`
  run_parser(word, `a^b`) // => `a`
  run_parser(word, `a~b`) // => `a`
  run_parser(word, `a+b`) // => `a+b`
*/
const word = p.alts<string>(quoted, head.chain(c => tail.map(s => c + s)))
const id = pchar.char('@').chain(_ => word)
const label = pchar.char(':').chain(_ => word)
const link = pchar
  .oneOf('^~')
  .chain(_ =>
    p.alts<Link>(
      word.map<Link>(text => ({tag: 'text', text})),
      id.map(idLink),
      p.succeed<Link>({tag: 'unlinked'})
    )
  )

type Attribute = Partial<Attributes>

function flatten<K extends string, T extends Record<K, any[]>>(keys: K[], parts: Partial<T>[]): T {
  const out: T = {} as any
  keys.forEach(k => (out[k] = []))
  parts.forEach(part => {
    for (const k in part) {
      const v = part[k]
      if (v !== undefined) {
        out[k].push(...(v as any[]))
      }
    }
  })
  return out
}

const attribute: Parser<Attribute> = p.alts<Attribute>(
  id.map(x => [x]).map(ids => ({ids})),
  label.map(x => [x]).map(labels => ({labels})),
  link.map(x => [x]).map(links => ({links}))
)

function Unit(text: string, attrs: Attribute[]): Unit {
  const r = flatten(['ids', 'labels', 'links'], attrs)
  return {text, ...r}
}

/**
  const expect: Unit = {
    text: `apa`,
    labels: [`bepa`],
    ids: [`cepa`],
    links: [{tag: 'text', text: `depa`}]
  }
  run_parser(unit, `'apa':'bepa'@'cepa'^'depa'`) // => expect
  run_parser(unit, `apa:bepa@cepa^depa`) // => expect

  const expect: Unit = {
    text: `apa`, labels: [], ids: [],
    links: [{tag: 'unlinked'}]
  }
  run_parser(unit, `apa^`) // => expect
*/

const unit = word.chain(word => p.many(attribute).map(attrs => Unit(word, attrs)))
const space_padded = <A>(f: Parser<A>) =>
  spaces_.chain(_ => f.chain(a => spaces_.chain(_ => p.succeed(a))))

/**
  const expect: Unit = {
    text: `apa`,
    labels: [`bepa`],
    ids: [`cepa`],
    links: [{tag: 'text', text: `depa`}]
  }
  run_parser(units, ` apa:bepa@cepa^depa 'apa':'bepa'@'cepa'^'depa' `) // => [expect, expect]
  run_parser(units, `_apa:bepa@cepa^depa_'apa':'bepa'@'cepa'^'depa'_`) // => [expect, expect]

  run_parser(units, `__one___two___three___`) // => `one two three`.split(' ').map(x => Unit(x, []))
  run_parser(units, `__one@0_two@1_three@2_`) // => `one two three`.split(' ').map((x, i) => Unit(x, [{ids: [i+'']}]))
  run_parser(units, `__one:0_two:1_three:2_`) // => `one two three`.split(' ').map((x, i) => Unit(x, [{labels: [i+'']}]))

  run_parser(units, `  one    two    three    `) // => `one two three`.split(' ').map(x => Unit(x, []))
  run_parser(units, `  one@0  two@1  three@2  `) // => `one two three`.split(' ').map((x, i) => Unit(x, [{ids: [i+'']}]))
  run_parser(units, `  one:0  two:1  three:2  `) // => `one two three`.split(' ').map((x, i) => Unit(x, [{labels: [i+'']}]))
*/
const units = space_padded(p.sepBy(spaces1_, unit))

export const parse = (s: string) => run_parser(units, s) || []
export const parse_strict = (s: string) => run_parser_strict(units, s)

// these link to a representatitive for the whole edge group
type Simple = {text: string; labels: string[]; id: string; link?: string}
function Simple(text: string, labels: string[], id: string, link?: string): Simple {
  return {text, labels, id, link}
}

const identify = (prefix: string, us: Unit[]) =>
  us.map((u, i) => ({...u, ids: [prefix + i, ...u.ids]}))
// could also put the user-supplied ids first and append the generated ID
// to try to preserve the user-supplied id
// one problem is possible name-collision

function assign_ids_and_manual_alignments(
  source: Unit[],
  target: Unit[]
): {source: Simple[]; target: Simple[]} {
  const s = identify('s', source)
  const t = identify('t', target)
  const uf = Utils.PolyUnionFind<Link>()
  const count = Utils.Counter(s.map(u => u.text))
  s.forEach(u =>
    uf.unions([
      ...u.ids.map(idLink),
      ...u.links.filter(link => link.tag != 'unlinked'),
      // one may link to the text if it is unique
      ...Utils.guard(count(u.text) == 1, {tag: 'text' as 'text', text: u.text}),
    ])
  )
  t.forEach(u =>
    uf.unions([
      ...u.ids.map(idLink),
      ...u.links.filter(link => link.tag != 'unlinked'),
      // the text of a target text cannot be referred to
    ])
  )
  const repr = (u: Unit) => uf.repr(idLink(u.ids[0]))
  const s_reprs = new Map(s.map(u => [repr(u), u.ids[0]] as [number, string]))
  const linked = new Set(t.map(repr).filter(tr => s_reprs.has(tr)))
  function link(u: Unit): Simple {
    const r = repr(u)
    if (linked.has(r)) {
      return Simple(u.text, u.labels, u.ids[0], s_reprs.get(r))
    } else if (u.links.some(l => l.tag == 'unlinked')) {
      return Simple(u.text, u.labels, u.ids[0], u.ids[0])
    } else {
      return Simple(u.text, u.labels, u.ids[0])
    }
  }
  return {source: s.map(link), target: t.map(link)}
}

const space_id = '<space>'

/**

  const example = [
    Simple('a', [], 'x'),
    Simple('ja', [], 'y')
  ]
  const expect = [
    Simple('a', [], 'x'),
    Simple(' ', [], space_id),
    Simple('j', [], 'y'),
    Simple('a', [], 'y'),
  })
  punctuate(example) // => expect

*/
function punctuate(units: Simple[]): Simple[] {
  const slice = (u: Simple) => Utils.str_map(u.text, text => ({...u, text}))
  const slices = (us: Simple[]): Simple[][] => us.map(slice)
  const space = Simple(' ', [], space_id)
  return R.pipe(slices, R.intersperse([space]), R.flatten)(units)
}

const is_auto = (u: Simple) => u.link === undefined

function automatic_alignments(source: Simple[], target: Simple[]): UnionFind<string> {
  const uf = Utils.PolyUnionFind<string>(u => u)
  const s = punctuate(source.filter(is_auto))
  const t = punctuate(target.filter(is_auto))
  const char_diff = Utils.hdiff(s, t, u => u.text, u => u.text)

  char_diff.forEach(c => {
    if (c.change == 0) {
      if (c.a.id != space_id && c.b.id != space_id) {
        uf.union(c.a.id, c.b.id)
      }
    }
  })

  return uf
}

export type STU = {source: Unit[]; target: Unit[]}
export function STU(source: Unit[], target: Unit[]): STU {
  return {source, target}
}
const onSTU = <A>(f: (stu: STU) => A) => (source: Unit[], target: Unit[]) => f(STU(source, target))

export function stu_to_graph({source, target}: STU): Graph {
  const r = assign_ids_and_manual_alignments(source, target)
  const auto = automatic_alignments(r.source, r.target)
  const edge_targets = {} as Record<string, string[]>
  const edge_labels = {} as Record<string, string[]>
  const assign = (u: Simple) => {
    if (u.id) {
      const edge_repr = u.link || auto.find(u.id)
      Utils.push(edge_targets, edge_repr, u.id)
      Utils.push(edge_labels, edge_repr, ...u.labels)
    }
  }
  r.source.forEach(assign)
  r.target.forEach(assign)
  const edges: Record<string, G.Edge> = {}
  Utils.record_forEach(edge_targets, (ids, repr) => {
    const edge = G.Edge(ids, edge_labels[repr] || [])
    edges[edge.id] = edge
  })
  return {
    source: r.source.map(t => T.Token(t.text + ' ', t.id)),
    target: r.target.map(t => T.Token(t.text + ' ', t.id)),
    edges,
  }
}

/**

  const s1 = parse_strict(`b~ cc d`)
  const t1 = parse_strict(`b cc d~`)
  const s2 = parse_strict(`b cc d~`)
  const t2 = parse_strict(`b~ cc d`)
  units_to_graph(s1, t1) // => units_to_graph(s2, t2)

  const s1 = parse_strict(`aa@1 bb cc@2`)
  const t1 = parse_strict(`aa~aa bb cc~aa~cc`)
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`aa~aa~cc bb cc~aa`))
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`aa~@1 bb cc~@1~@2`))
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`aa~@1~@2 bb cc~@2`))
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`aa~aa bb cc~@1~@2`))
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`aa~@1~cc bb cc~cc`))

  const s1 = parse_strict(`apa bepa cepa`)
  const t1 = parse_strict(`apa bpea cpea`)
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`apa bpea~bepa cpea`))
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`apa bpea cpea~cepa`))
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`apa bpea~bepa cpea~cepa`))
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`apa~apa bpea cpea`))
  units_to_graph(s1, t1) // => units_to_graph(s1, parse_strict(`apa~apa bpea~bepa cpea~cepa`))

  const s1 = parse_strict(`w1:L1 w2:L2 w3:L3 `)
  const t1 = parse_strict(`w1    w2    w3    `)
  units_to_graph(s1, t1) // => units_to_graph(t1, s1)

  const ex_s = parse_strict('preamble apa:Ort bepacepa xu depa flepa:Comp florp^preamble')
  const ex_t = parse_strict('apa bpea cpea dpeaflpae xlbabulr postscriptum^preamble woop^')

*/
export const units_to_graph = onSTU(stu_to_graph)

export function unit_to_string(unit: Unit): string {
  const text_to_string = (text0: string) => {
    const text = text0.trim()
    const escape = text.search(/[ '_\t\n:@^~]/)
    return escape != -1 ? `'${text.replace(/['\\']/g, s => '\\' + s)}'` : text
  }
  const text = text_to_string(unit.text)
  const ids = unit.ids.map(id => '@' + text_to_string(id)).join('')
  const link_to_string = (link: Link): string => {
    if (link.tag == 'text') {
      return text_to_string(link.text)
    } else if (link.tag == 'id') {
      return '@' + text_to_string(link.id)
    } else if (link.tag == 'unlinked') {
      return ''
    } else {
      return link
    }
  }
  const links = unit.links.map(link => '~' + link_to_string(link)).join('')
  const labels = unit.labels.map(label => ':' + text_to_string(label)).join('')
  return text + ids + links + labels
}

export function units_to_string(units: Unit[]) {
  return units.map(unit_to_string).join(' ')
}

export type STS = {source: Simple[]; target: Simple[]}

export function simple_to_unit(s: Simple): Unit {
  return {
    text: s.text,
    ids: [s.id],
    links: s.link ? [{tag: 'id', id: s.link}] : [],
    labels: s.labels,
  }
}

export function diff_to_units(diff: Diff[], g: Graph): STU {
  const source: Unit[] = []
  const target: Unit[] = []
  let count = 1
  const seen: Record<string, string> = {}
  const unit = (d: Diff) => (tok: T.Token): Unit => ({
    text: tok.text,
    labels: !seen[d.id] ? g.edges[d.id].labels : [],
    links: seen[d.id] ? [{tag: 'id' as 'id', id: seen[d.id]}] : [],
    ids: !seen[d.id] ? [(seen[d.id] = count++ + '')] : [],
  })
  diff.forEach(
    D.match({
      Edited(d) {
        source.push(...d.source.map(unit(d)))
        target.push(...d.target.map(unit(d)))
      },
      Dropped(d) {
        target.push(unit(d)(d.target))
      },
      Dragged(d) {
        source.push(unit(d)(d.source))
      },
    })
  )
  return {source, target}
}

function prefer_text_links({source, target}: STU): STU {
  const count = Utils.Counter(source.map(u => u.text))
  const repl = {} as Record<string, Link>
  source.forEach(u => {
    if (count(u.text) == 1) {
      u.ids.forEach(id => (repl[id] = {tag: 'text', text: u.text}))
    }
  })
  const replace_link = (link: Link) => {
    if (link.tag == 'id' && repl[link.id]) {
      return repl[link.id]
    } else {
      return link
    }
  }
  return {
    source: source.map(u => ({...u, links: u.links.map(replace_link)})),
    target: target.map(u => ({...u, links: u.links.map(replace_link)})),
  }
}

function remove_unused_ids({source, target}: STU): STU {
  const ids: string[] = []
  source.forEach(u => u.links.forEach(link => link.tag == 'id' && ids.push(link.id)))
  target.forEach(u => u.links.forEach(link => link.tag == 'id' && ids.push(link.id)))
  const count = Utils.Counter(ids)
  return {
    source: source.map(u => ({...u, ids: u.ids.filter(id => count(id) > 0)})),
    target: target.map(u => ({...u, ids: u.ids.filter(id => count(id) > 0)})),
  }
}

type LazyRoseTree<A> = {node: A; force(): LazyRoseTree<A>[]}

// assumes t is ok to start with
function dfs<A>(t: LazyRoseTree<A>, ok: (a: A) => boolean, fuel = -1): A {
  if (fuel == 0) {
    return t.node
  }
  const ts = t.force()
  for (const child of ts) {
    if (ok(child.node)) {
      return dfs(child, ok, fuel - 1)
    }
  }
  return t.node
}

function reduce_links({source, target}: STU, skip = 0): LazyRoseTree<STU> {
  return {
    node: {source, target},
    force() {
      const out: STU[] = []
      source.forEach((u, i) =>
        u.links.forEach((_, j) => {
          const u2: Unit = {...u, links: Utils.splice(u.links, j, 1)[0]}
          const s2 = Utils.splice(source, i, 1, u2)[0]
          out.push({source: s2, target})
        })
      )
      target.forEach((u, i) =>
        u.links.forEach((_, j) => {
          const u2: Unit = {...u, links: Utils.splice(u.links, j, 1)[0]}
          const t2 = Utils.splice(target, i, 1, u2)[0]
          out.push({source, target: t2})
        })
      )
      return out.slice(skip).map((t, i) => reduce_links(t, i))
    },
  }
}

/**

  const source = parse_strict(`w1    w2    w3`)
  const target = parse_strict(`w1~w1 w2~w2 w3~w3`)
  minimize({source, target}) // => {source, target: source}

*/
export function minimize(stu0: STU): STU {
  const g0 = stu_to_graph(stu0)
  return remove_unused_ids(
    prefer_text_links(dfs(reduce_links(stu0), stu => G.equal(g0, stu_to_graph(stu))))
  )
}

export function graph_to_units(g: Graph): STU {
  return diff_to_units(G.calculate_diff(g), g)
}

function testing() {
  const source = parse_strict(`a b c@u c@z`)
  const target = parse_strict(`a~@u b c~b`)
  const m = minimize({source, target})
  Utils.stderr(units_to_string(m.source))
  Utils.stderr(units_to_string(m.target))
  // Utils.stderr(units_to_graph(source, target))
  // Utils.stderr(units_to_graph(m.source, m.target))
  return 'ok'
}
