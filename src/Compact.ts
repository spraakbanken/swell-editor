import * as R from 'ramda'
import * as util from 'util'
util.inspect.defaultOptions.depth = 5
util.inspect.defaultOptions.colors = true
const pp = (x: any) => (console.dir(x), console.log())

import {Parser} from 'parser-ts'
import * as p from 'parser-ts'
import * as pchar from 'parser-ts/lib/char'
import * as pstr from 'parser-ts/lib/string'
import * as T from './Token'

type Link = {tag: 'word'; word: string} | {tag: 'id'; id: string}

interface Attributes {
  ids: string[]
  labels: string[]
  links: Link[]
}

interface Unit extends Attributes {
  text: string
}

const space_padded = <A>(f: Parser<A>) =>
  pstr.spaces.chain(_ => f.chain(a => pstr.spaces.chain(_ => p.of(a))))

const word = pstr.doubleQuotedString.alt(pstr.many1(pchar.notOneOf(' \t\n":#^')))
const link = pchar
  .char('^')
  .chain(_ =>
    p.alt(word.map<Link>(word => ({tag: 'word', word})), id.map<Link>(id => ({tag: 'id', id})))
  )
const id = pchar.char('#').chain(_ => pstr.many1(pchar.alphanum))
const label = pchar.char(':').chain(_ => word)

type Attribute = Partial<Attributes>

export function alts<A>(...ps: Parser<A>[]): Parser<A> {
  return ps.reduce((p1, p2) => p1.alt(p2), p.fail)
}

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

const attribute: Parser<Attribute> = alts<Attribute>(
  link.map(x => [x]).map(links => ({links})),
  id.map(x => [x]).map(ids => ({ids})),
  label.map(x => [x]).map(labels => ({labels}))
)

function Unit(text: string, attrs: Attribute[]): Unit {
  const r = flatten(['ids', 'labels', 'links'], attrs)
  return {text, ...r}
}

const unit = word.chain(word => p.many(attribute).map(attrs => Unit(word, attrs)))
const units = space_padded(p.sepBy(pstr.spaces1, unit))

const test_input = `
  word
  words
  "words"
  "wo\\"rds"
  "wo\\\\rds"
  words#hej
  words:hej
  "words"#hej
  "words":hej
  _^jeeha
  -^jeeha^beba
  _^jeeha#beba
  _^"y:#x"^aoeu
  _#beba#cepa
  _#bbeeba13
  stuff^"y:#x"^aoeu
  stuff^"y:#x"^aoeu#id^hej#ids
  bil#12#etikett^bli^#15:Ort:Burk
`

// pp(units.run(test_input))

import * as G from './Graph'
import {Graph} from './Graph'

import * as Utils from './Utils'

function rev(us: Unit[]): Map<string, Unit> {
  const m = new Map<string, Unit>()
  us.forEach(u => u.ids.forEach(i => m.set(i, u)))
  return m
}

const identify = (prefix: string, us: Unit[]) =>
  us.map((u, i) => ({...u, ids: [prefix + i, ...u.ids]}))

const s = identify('s', (units.run('preamble apa bepacepa xu depa flepa')
  .value as any)[0] as Unit[])
const t = identify('t', (units.run('apa bpea cpea dpeaflpae xlbabulr postscriptum')
  .value as any)[0] as Unit[])

const rs = rev(s)
const rt = rev(t)

const slice = (u: Unit) => Utils.str_map(u.text, text => ({...u, text}))
const slices = (us: Unit[]) => us.map(slice)

const space = {text: ' ', ids: [], links: [], labels: []}

const punctuate = R.pipe(slices, R.intersperse([space]), R.flatten)

const ss = punctuate(s)
const tt = punctuate(t)

const h = Utils.hdiff(ss, tt, u => u.text, u => u.text)

const edges: Record<string, Set<string>> = {}

const uf = Utils.PolyUnionFind<string>(u => u)

h.forEach(c => {
  if (c.change == 0) {
    uf.unions([...c.a.ids, ...c.b.ids])
  }
})

pp({
  s: s.map(u => ({...u, ids: uf.find(u.ids[0])})),
  t: t.map(u => ({...u, ids: uf.find(u.ids[0])})),
})

function units_to_graph(source: Unit[], target: Unit[]): Graph {
  throw 'TODO'
}
