import * as R from 'ramda'

import {Parser} from 'parser-ts'
import * as p from 'parser-ts'
import * as pchar from 'parser-ts/lib/char'
import * as pstr from 'parser-ts/lib/string'

import * as T from './Token'
import * as G from './Graph'
import {Graph, ST, Edge} from './Graph'
import * as Utils from './Utils'
import {UnionFind} from './Utils'
import * as D from './Diff'
import {Diff} from './Diff'
import * as record from './record'

type Link = {tag: 'text'; text: string} | {tag: 'id'; id: string} | {tag: 'unlinked'}

const idLink = (id: string): Link => ({tag: 'id', id})
const unlinked: Link = {tag: 'unlinked'}

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
  run_parser(text, `'apa'`) // => `apa`
  run_parser(text, `apa`) // => `apa`
  run_parser(text, `'apa`) // => null
  run_parser(text, `apa'`) // => `apa'`
  run_parser(text, `'a'a'`) // => `a`
  run_parser(text, `'\\\\'`) // => `\\`
  run_parser(text, `'\\''`) // => `'`
  run_parser(text, `a b`) // => `a`
  run_parser(text, `a_b`) // => `a`
  run_parser(text, `a:b`) // => `a`
  run_parser(text, `a^b`) // => `a`
  run_parser(text, `a~b`) // => `a`
  run_parser(text, `a+b`) // => `a+b`
*/
const text = p.alts<string>(quoted, head.chain(c => tail.map(s => c + s)))

/**
  drop_one_last_space('w ') // => 'w'
  drop_one_last_space('w  ') // => 'w '
  drop_one_last_space('w\n') // => 'w\n'
  drop_one_last_space('w \n') // => 'w \n'
  drop_one_last_space('w\n ') // => 'w\n'

  // should this one error instead?
  drop_one_last_space('w') // => 'w'
*/
function drop_one_last_space(s: string): string {
  return s.replace(/ +$/, x => x.slice(1))
}

/**
  add_one_last_space('w') // => 'w '
  add_one_last_space('w ') // => 'w  '
  add_one_last_space('w\n') // => 'w\n'
  add_one_last_space('w \n') // => 'w \n'
  add_one_last_space('w\n') // => 'w\n'

  // should this one error instead?
  add_one_last_space('w') // => 'w '
*/
function add_one_last_space(s: string): string {
  return s.match(/\S *$/) ? s + ' ' : s
}

/**
  run_parser(word, `'apa'`) // => `apa `
  run_parser(word, `apa`) // => `apa `
  run_parser(word, `'apa`) // => null
  run_parser(word, `apa'`) // => `apa' `
*/
const word = text.map(add_one_last_space)

const id = pchar.char('@').chain(_ => text)
const label = pchar.char(':').chain(_ => text)
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

export function Unit(text: string, attrs: Attribute[]): Unit {
  const r = flatten(['ids', 'labels', 'links'], attrs)
  return {text, ...r}
}

/**
  const expect: Unit = {
    text: `apa `,
    labels: [`bepa`],
    ids: [`cepa`],
    links: [{tag: 'text', text: `depa `}]
  }
  run_parser(unit, `'apa':'bepa'@'cepa'^'depa'`) // => expect
  run_parser(unit, `apa:bepa@cepa^depa`) // => expect

  const expect: Unit = {
    text: `apa `, labels: [], ids: [],
    links: [{tag: 'unlinked'}]
  }
  run_parser(unit, `apa^`) // => expect
*/

const unit = word.chain(word => p.many(attribute).map(attrs => Unit(word, attrs)))
const space_padded = <A>(f: Parser<A>) =>
  spaces_.chain(_ => f.chain(a => spaces_.chain(_ => p.succeed(a))))

/**
  const expect: Unit = {
    text: `apa `,
    labels: [`bepa`],
    ids: [`cepa`],
    links: [{tag: 'text', text: `depa `}]
  }
  run_parser(units, ` apa:bepa@cepa^depa 'apa':'bepa'@'cepa'^'depa' `) // => [expect, expect]
  run_parser(units, `_apa:bepa@cepa^depa_'apa':'bepa'@'cepa'^'depa'_`) // => [expect, expect]

  run_parser(units, `__one___two___three___`) // => `one two three`.split(' ').map(x => Unit(x + ' ', []))
  run_parser(units, `__one@0_two@1_three@2_`) // => `one two three`.split(' ').map((x, i) => Unit(x + ' ', [{ids: [i+'']}]))
  run_parser(units, `__one:0_two:1_three:2_`) // => `one two three`.split(' ').map((x, i) => Unit(x + ' ', [{labels: [i+'']}]))

  run_parser(units, `  one    two    three    `) // => `one two three`.split(' ').map(x => Unit(x + ' ', []))
  run_parser(units, `  one@0  two@1  three@2  `) // => `one two three`.split(' ').map((x, i) => Unit(x + ' ', [{ids: [i+'']}]))
  run_parser(units, `  one:0  two:1  three:2  `) // => `one two three`.split(' ').map((x, i) => Unit(x + ' ', [{labels: [i+'']}]))
*/
const units = space_padded(p.sepBy(spaces1_, unit))

export const parse = (s: string) => run_parser(units, s) || []
export const parse_strict = (s: string) => run_parser_strict(units, s)

const identify = (prefix: string, us: Unit[]) =>
  us.map((u, i) => ({...u, ids: [prefix + i, ...u.ids]}))
// could also put the user-supplied ids first and append the generated ID
// to try to preserve the user-supplied id
// one problem is possible name-collision

export function to_unaligned_graph(stu: STU): Graph {
  const s = identify('s', stu.source)
  const t = identify('t', stu.target)
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

  const proto_edges = {} as Record<string, G.Edge>

  function link(u: Unit): T.Token {
    const id = u.ids[0]
    const r = '' + uf.repr(idLink(id))
    record.modify(proto_edges, r, G.zero_edge, e =>
      G.merge_edges(e, G.Edge([id], u.labels, u.links.length > 0))
    )
    return T.Token(u.text, id)
  }

  const source = s.map(link)
  const target = t.map(link)
  const edges = G.edge_record(record.traverse(proto_edges, e => e))
  return {source, target, edges}
}

/**

  const norm = (g: Graph) => G.normalize(g)
  const s1 = parse_strict(`b~ cc d`)
  const t1 = parse_strict(`b cc d~`)
  norm(units_to_graph(s1, t1)) // => norm(units_to_graph(t1, s1))
  //
  const s2 = parse_strict(`aa@1 bb cc@2`)
  const t2 = parse_strict(`aa~aa bb cc~aa~cc`)
  norm(units_to_graph(s2, t2)) // => norm(units_to_graph(s2, parse_strict(`aa~aa~cc bb cc~aa`)))
  norm(units_to_graph(s2, t2)) // => norm(units_to_graph(s2, parse_strict(`aa~@1 bb cc~@1~@2`)))
  norm(units_to_graph(s2, t2)) // => norm(units_to_graph(s2, parse_strict(`aa~@1~@2 bb cc~@2`)))
  norm(units_to_graph(s2, t2)) // => norm(units_to_graph(s2, parse_strict(`aa~aa bb cc~@1~@2`)))
  norm(units_to_graph(s2, t2)) // => norm(units_to_graph(s2, parse_strict(`aa~@1~cc bb cc~cc`)))
  //
  const s3 = parse_strict(`apa bepa cepa`)
  const t3 = parse_strict(`apa bpea cpea`)
  norm(units_to_graph(s3, t3)) // => norm(units_to_graph(s3, parse_strict(`apa bpea~bepa cpea`)))
  norm(units_to_graph(s3, t3)) // => norm(units_to_graph(s3, parse_strict(`apa bpea cpea~cepa`)))
  norm(units_to_graph(s3, t3)) // => norm(units_to_graph(s3, parse_strict(`apa bpea~bepa cpea~cepa`)))
  norm(units_to_graph(s3, t3)) // => norm(units_to_graph(s3, parse_strict(`apa~apa bpea cpea`)))
  norm(units_to_graph(s3, t3)) // => norm(units_to_graph(s3, parse_strict(`apa~apa bpea~bepa cpea~cepa`)))
  //
  const s4 = parse_strict(`w1:L1 w2:L2 w3:L3 `)
  const t4 = parse_strict(`w1    w2    w3    `)
  norm(units_to_graph(s4, t4)) // => norm(units_to_graph(t4, s4))

*/
export function units_to_graph(source: Unit[], target: Unit[]): Graph {
  return G.align(to_unaligned_graph({source, target}))
}

export function unit_to_string(unit: Unit): string {
  const quote_as_necessary = (text: string) => {
    const escape = text.search(/[ '_\t\n:@^~]/)
    if (escape != -1) {
      const escaped = text.replace(/['\\']/g, s => '\\' + s)
      return `'${escaped}'`
    } else {
      return text
    }
  }
  const word = (text: string) => quote_as_necessary(drop_one_last_space(text))
  const text = word(unit.text)
  const ids = unit.ids.map(id => '@' + quote_as_necessary(id)).join('')
  const link_to_string = (link: Link): string => {
    if (link.tag == 'text') {
      return word(link.text)
    } else if (link.tag == 'id') {
      return '@' + quote_as_necessary(link.id)
    } else if (link.tag == 'unlinked') {
      return ''
    } else {
      return link
    }
  }
  const links = unit.links.map(link => '~' + link_to_string(link)).join('')
  const labels = unit.labels.map(label => ':' + quote_as_necessary(label)).join('')
  return text + ids + links + labels
}

export function units_to_string(units: Unit[], sep = ' ' as ' ' | '_') {
  return units.map(unit_to_string).join(sep)
}

type STU = ST<Unit[]>

/**

  ({
    source: [{text: 'word ', ids: ['s0'], labels: [], links: []}],
    target: [{text: 'word ', ids: ['t0'], labels: [], links: []}]
  }) // => proto_graph_to_units(G.init('word'))

  ({
    source: [{text: 'word ', ids: ['s0'], labels: [], links: [{tag: 'id', id: 's0'}]}],
    target: [{text: 'word ', ids: ['t0'], labels: [], links: [{tag: 'id', id: 's0'}]}]
  }) // => proto_graph_to_units(G.init('word', true))

*/
export function proto_graph_to_units(g: Graph): STU {
  const em = Utils.chain(G.edge_map(g), m => (id: string): G.Edge =>
    m.get(id) || Utils.raise(`Token id ${id} not in edge map`)
  )
  const first = Utils.unique_check<string>()
  return G.with_st(g, tokens =>
    tokens.map((token): Unit => {
      const e = em(token.id)
      const labels = first(e.id) ? e.labels : []
      const links = Utils.expr(() => {
        if (!e.manual) {
          return []
        }
        if (e.ids.length === 1) {
          return [unlinked]
        }
        // we sort because we want 's0' to be chosen instead of 't0'
        // in prefer_text_links because linked words always refer
        // to the source text
        return [idLink(e.ids.sort()[0])]
      })
      return Unit(token.text, [{ids: [token.id], links, labels}])
    })
  )
}

/**

  const With = {
    source: parse_strict(`w@1 w w@3`),
    target: parse_strict(`w@2 w w~@3`)
  }
  const Without = {
    source: parse_strict(`w w w@3`),
    target: parse_strict(`w w w~@3`)
  }
  minimize(With) // => Without

  const With = {
    source: parse_strict(`a b c@3`),
    target: parse_strict(`a b c~@3`)
  }
  const Without = {
    source: parse_strict(`a b c`),
    target: parse_strict(`a b c~c`)
  }
  minimize(With) // => Without


*/
export function minimize(stu: STU): STU {
  return remove_unused_ids(prefer_text_links(stu))
}

function prefer_text_links(stu: STU): STU {
  const count = Utils.Counter(stu.source.map(u => u.text))
  const repl = {} as Record<string, Link>
  stu.source.forEach(u => {
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
  return G.with_st(stu, units => units.map(u => ({...u, links: u.links.map(replace_link)})))
}

function remove_unused_ids(stu: STU): STU {
  const ids: string[] = []
  G.with_st(stu, units =>
    units.forEach(u => u.links.forEach(link => link.tag == 'id' && ids.push(link.id)))
  )
  const count = Utils.Counter(ids)
  return G.with_st(stu, units => units.map(u => ({...u, ids: u.ids.filter(id => count(id) > 0)})))
}

export function graph_to_units(g: Graph): ST<Unit[]> {
  return minimize(proto_graph_to_units(g))
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
