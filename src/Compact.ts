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

type Link = {tag: 'text'; text: string} | {tag: 'id'; id: string} | {tag: 'unlinked'}

const idLink = (id: string): Link => ({tag: 'id', id})

interface Attributes {
  ids: string[]
  labels: string[]
  links: Link[]
}

interface Unit extends Attributes {
  text: string
}

const parse = <A>(p: Parser<A>, input: string): A | null =>
  p.run(input).bimap(_ => null, x => x[0]).value

/**
  parse(space_, '_') // => '_'
  parse(space_, ' ') // => ' '
  parse(space_, '!') // => null
*/
const space_ = pchar.oneOf(' \n\t_')
const spaces_ = pstr.many(space_)
const spaces1_ = pstr.many1(space_)

const quote = pchar.char(`'`)

/**
  parse(quoted, `'apa'`) // => `apa`
  parse(quoted, `apa`) // => null
  parse(quoted, `'apa`) // => null
  parse(quoted, `apa'`) // => null
  parse(quoted, `'a'a'`) // => `a`
  parse(quoted, `'\\\\'`) // => `\\`
  parse(quoted, `'\\''`) // => `'`
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
  .chain(s => quote.chain(_ => p.of(s)))

const head = pchar.notOneOf(` '_\t\n:@^~`)
const tail = pstr.many(pchar.notOneOf(` _\t\n:@^~`))

/**
  parse(word, `'apa'`) // => `apa`
  parse(word, `apa`) // => `apa`
  parse(word, `'apa`) // => null
  parse(word, `apa'`) // => `apa'`
  parse(word, `'a'a'`) // => `a`
  parse(word, `'\\\\'`) // => `\\`
  parse(word, `'\\''`) // => `'`
  parse(word, `a b`) // => `a`
  parse(word, `a_b`) // => `a`
  parse(word, `a:b`) // => `a`
  parse(word, `a^b`) // => `a`
  parse(word, `a~b`) // => `a`
  parse(word, `a+b`) // => `a+b`
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
      p.of<Link>({tag: 'unlinked'})
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
  const expect = {
    text: `apa`,
    labels: [`bepa`],
    ids: [`cepa`],
    links: [{tag: 'text', text: `depa`}]
  }
  parse(unit, `'apa':'bepa'@'cepa'^'depa'`) // => expect
  parse(unit, `apa:bepa@cepa^depa`) // => expect
  parse(units, ` apa:bepa@cepa^depa 'apa':'bepa'@'cepa'^'depa' `) // => [expect, expect]
  parse(units, `_apa:bepa@cepa^depa_'apa':'bepa'@'cepa'^'depa'_`) // => [expect, expect]

  parse(units, `__one___two___three___`) // => `one two three`.split(' ').map(x => Unit(x, []))
  parse(units, `__one@0_two@1_three@2_`) // => `one two three`.split(' ').map((x, i) => Unit(x, [{ids: [i+'']}]))
  parse(units, `__one:0_two:1_three:2_`) // => `one two three`.split(' ').map((x, i) => Unit(x, [{labels: [i+'']}]))

  parse(units, `  one    two    three    `) // => `one two three`.split(' ').map(x => Unit(x, []))
  parse(units, `  one@0  two@1  three@2  `) // => `one two three`.split(' ').map((x, i) => Unit(x, [{ids: [i+'']}]))
  parse(units, `  one:0  two:1  three:2  `) // => `one two three`.split(' ').map((x, i) => Unit(x, [{labels: [i+'']}]))
*/
const unit = word.chain(word => p.many(attribute).map(attrs => Unit(word, attrs)))
const space_padded = <A>(f: Parser<A>) =>
  spaces_.chain(_ => f.chain(a => spaces_.chain(_ => p.of(a))))
const units = space_padded(p.sepBy(spaces1_, unit))

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
  s.forEach(u =>
    uf.unions([
      ...u.ids.map(idLink),
      {tag: 'text', text: u.text},
      ...u.links, // source text may have links
    ])
  )
  t.forEach(u =>
    uf.unions([
      ...u.ids.map(idLink),
      ...u.links,
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

export function units_to_graph(source: Unit[], target: Unit[]): Graph {
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

export const test_parse = (s: string) => units.run(s).getOrElseValue([[], ''])[0]

/*
import * as util from 'util'
util.inspect.defaultOptions.depth = 5
util.inspect.defaultOptions.colors = true
const pp = (x: any) => (console.dir(x), console.log())

const test_input = `
  word
  words
  "words"
  "wo\\"rds"
  words@hej
  words:hej
  "words"@hej
  "words":hej
  _^jeeha
  -^jeeha^beba
  _^jeeha@beba
  _^"y:@x"^aoeu
  _@beba@cepa
  _@bbeeba13
  stuff^"y:@x"^aoeu
  stuff^"y:@x"^aoeu@id^hej@ids
  bil@12@etikett^bli^@15:Ort:Burk
`

pp(test_parse(test_input))

const ex_s = test_parse('preamble apa:Ort bepacepa xu depa flepa:Comp florp^preamble')
const ex_t = test_parse('apa bpea cpea dpeaflpae xlbabulr postscriptum^preamble woop^')

pp(units_to_graph(ex_s, ex_t))
*/
