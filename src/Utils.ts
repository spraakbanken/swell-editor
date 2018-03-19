import * as record from './record'
import * as R from 'ramda'
import {Lens, Store} from 'reactive-lens'
import * as Dmp from 'diff-match-patch'
export const dmp = new Dmp.diff_match_patch() as Dmp.diff_match_patch

export type TokenDiff = [number, string][]

export function capitalize_head(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1)
}

export function debugName($debugName: string) {
  const env = process.env.NODE_ENV
  if (env === 'production') {
    return {}
  } else {
    return {$debugName}
  }
}

/** Make a stream of all unicode characters

We need this because the diff-match-patch library is hard-coded to work on characters.

To make a polymorphic diff each unique element is assigned a unique character.
We translate them back to the opaque type after diffing via the characters.
This is used in `hdiff`.

  const next = char_stream()
  next().charCodeAt(0) = 0
  next().charCodeAt(0) = 1
  next().charCodeAt(0) = 2
  next().charCodeAt(0) = 3

*/
export function char_stream(): () => string {
  let i = 0
  return () => {
    return String.fromCharCode(parseInt((i++).toString(), 16))
  }
}

export type ChangeInt = -1 | 0 | 1

/**

  raw_diff('abca'.split(''), 'bac'.split('')) // => [[-1, 'a'], [0, 'b'], [1, 'a'], [0, 'c'], [-1, 'a']]
  raw_diff('abc'.split(''), 'cab'.split('')) // => [[1, 'c'], [0, 'a'], [0, 'b'], [-1, 'c']]
  raw_diff('bca'.split(''), 'a1234bc'.split('')) // => [[1, 'a'], [1, '1'], [1, '2'], [1, '3'], [1, '4'], [0, 'b'], [0, 'c'], [-1, 'a']]
  raw_diff(['anything', 'everything'], ['anything']) // => [[0, 'anything'], [-1, 'everything']]
  const n = 10000
  raw_diff(range(n), range(2*n)) // => range(2*n).map(i => R.pair(i < n ? 0 : 1, i))

*/
export function raw_diff<A>(
  xs: A[],
  ys: A[],
  cmp: (a: A) => string = a => a.toString()
): R.KeyValuePair<ChangeInt, A>[] {
  return hdiff(xs, ys, cmp, cmp).map(c => R.pair(c.change, c.change == 1 ? c.b : c.a))
}

interface Deleted<A> {
  change: -1
  a: A
}

interface Constant<A, B> {
  change: 0
  a: A
  b: B
}

interface Inserted<B> {
  change: 1
  b: B
}

export type Change<A, B> = Deleted<A> | Constant<A, B> | Inserted<B>

/** Hetrogenuous diff

  const abca = 'abca'.split('')
  const BAC = 'BAC'.split('')
  const lower = (s: string) => s.toLowerCase()
  const expect = [
    {change: -1, a: 'a'},
    {change: 0, a: 'b', b: 'B'},
    {change: 1, b: 'A'},
    {change: 0, a: 'c', b: 'C'},
    {change: -1, a: 'a'}
  ] as Change<string, string>[]
  hdiff(abca, BAC, lower, lower) // => expect

*/
export function hdiff<A, B>(
  xs: A[],
  ys: B[],
  a_cmp: (a: A) => string = a => a.toString(),
  b_cmp: (b: B) => string = b => b.toString()
): Change<A, B>[] {
  const to = new Map<string, string>()
  const a_from = new Map<string, A[]>()
  const b_from = new Map<string, B[]>()
  const next = char_stream()
  function assign<C>(c: C, c_cmp: (c: C) => string, c_from: Map<string, C[]>): string {
    const s = c_cmp(c)
    let u = to.get(s)
    if (u === undefined) {
      u = next()
      to.set(s, u)
    }
    let arr = c_from.get(u)
    if (!arr) {
      arr = []
      c_from.set(u, arr)
    }
    arr.push(c)
    return u
  }
  const s1 = xs.map(a => assign(a, a_cmp, a_from)).join('')
  const s2 = ys.map(b => assign(b, b_cmp, b_from)).join('')
  const d = dmp.diff_main(s1, s2)
  return flatMap(d, ([change, cs]) => {
    return str_map(cs, (c: string) => {
      if (change == 0) {
        const a = (a_from.get(c) as A[]).shift() as A
        const b = (b_from.get(c) as B[]).shift() as B
        return {change: 0 as 0, a, b}
      } else if (change == -1) {
        const a = (a_from.get(c) as A[]).shift() as A
        return {change: -1 as -1, a}
      } else if (change == 1) {
        const b = (b_from.get(c) as B[]).shift() as B
        return {change: 1 as 1, b}
      }
      throw 'diff match patch returned change not in range [-1, 1]: ' + change
    })
  })
}

export function token_diff(s1: string, s2: string) {
  const d = dmp.diff_main(s1, s2)
  dmp.diff_cleanupSemantic(d)
  return d
}

export const invert_token_diff = (ds: TokenDiff) => ds.map(([i, s]) => [-i, s] as [number, string])

// ss must be nonempty and all strings must be nonempty
export function multi_token_diff(ss: string[], s2: string): TokenDiff[] {
  let lengths = ss.map(s => s.length)
  const diff = token_diff(ss.join(''), s2)
  let cur = [] as [number, string][]
  const out = [cur]
  diff.map(([i, s]) => {
    if (i == 0 || i == -1) {
      while (s.length > lengths[0]) {
        const n = lengths.shift()
        cur.push([i, s.slice(0, n)])
        cur = []
        out.push(cur)
        s = s.slice(n)
      }
      if (s.length > 0) {
        cur.push([i, s])
        lengths[0] -= s.length
      }
    } else {
      cur.push([i, s])
    }
  })
  return out
}

/** Compare two arrays for shallow equality */
export function shallow_array_eq<A>(xs: A[], ys: A[]): boolean {
  return xs.length == ys.length && xs.every((x, i) => x == ys[i])
}

/** Check if two lists are a permutation of each other

  array_multiset_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa', 'apa', 'apa']) // => false
  array_multiset_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa', 'apa']) // => true
  array_multiset_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa']) // => false
  array_multiset_eq(['apa', 'bepa', 'apa'], ['bepa']) // => false

*/
export function array_multiset_eq<A>(xs: A[], ys: A[]): boolean {
  const xm = new Map<A, number>()
  const ym = new Map<A, number>()
  let tmp
  xs.map(x => xm.set(x, ((tmp = xm.get(x)), tmp === undefined ? 1 : tmp + 1)))
  ys.map(y => ym.set(y, ((tmp = ym.get(y)), tmp === undefined ? 1 : tmp + 1)))
  return map_equal(xm, ym)
}

/** Are these two maps equal? */
export function map_equal<A, B>(a: Map<A, B>, b: Map<A, B>): boolean {
  let ok = true
  a.forEach((k, v) => (ok = ok && b.get(v) == k))
  b.forEach((k, v) => (ok = ok && a.get(v) == k))
  return ok
}

/** Are these two sets equal? */
export function set_equal<A>(a: Set<A>, b: Set<A>): boolean {
  let ok = true
  a.forEach(k => (ok = ok && b.has(k)))
  b.forEach(k => (ok = ok && a.has(k)))
  return ok
}

/** Check if two lists are a permutation of each other

  array_set_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa', 'apa', 'apa']) // => true
  array_set_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa', 'apa']) // => true
  array_set_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa']) // => true
  array_set_eq(['apa', 'bepa', 'apa'], ['bepa']) // => false

*/
export function array_set_eq<A>(xs: A[], ys: A[]): boolean {
  return set_equal(new Set(xs), new Set(ys))
}

/** map for strings */
export function str_map<A>(s: string, f: (c: string, i: number) => A): A[] {
  const out = [] as A[]
  for (let i = 0; i < s.length; ++i) {
    out.push(f(s[i], i))
  }
  return out
}

declare const require: (file: string) => any
const stringify = require('json-stringify-pretty-compact') as (s: any) => string

/** Show a JSON object with indentation */
export function show(x: any): string {
  return stringify(x)
  // return JSON.stringify(x, undefined, 2)
}

export function stderr(x: any): void {
  console.error(show(x))
  console.error()
}

export function stdout(x: any): void {
  console.log(show(x))
}

/** Numeric sort */
export function numsort(xs: number[]): number[] {
  return xs.slice().sort((u, v) => u - v)
}

/** Trims initial whitespace */
export function ltrim(s: string): string {
  const m = s.match(/^\s*(.*)$/)
  if (m) {
    return m[1]
  } else {
    return s // unreachable, the regex always matches
  }
}

/** Splits a string up in the initial part and all trailing whitespace

  whitespace_split('  XY  ') // => ['  XY', '  ']
  whitespace_split('XY  ') // => ['XY', '  ']
  whitespace_split('  XY') // => ['  XY', '']

*/
export function whitespace_split(s: string): [string, string] {
  const m = s.match(/^(.*?)(\s*)$/)
  if (m && m.length == 3) {
    return [m[1], m[2]]
  }
  return [s, ''] // unreachable (the regexp matches any string)
}

/** Splits a string up in the initial whitespace part and the rest of the string

  initial_whitespace_split('  XY  ') // => ['  ', 'XY  ']
  initial_whitespace_split('XY  ')   // => ['', 'XY  ']
  initial_whitespace_split('  XY')   // => ['  ', 'XY']

*/
export function initial_whitespace_split(s: string): [string, string] {
  const m = s.match(/^(\s*)(.*)$/)
  if (m && m.length == 3) {
    return [m[1], m[2]]
  }
  return [s, ''] // unreachable (the regexp matches any string)
}

/** Is every element larger than the previous?

  increases([1,2,3,4]) // => true
  increases([1,3,4,5]) // => true
  increases([3,1]    ) // => false
  increases([])        // => true

*/
export function increases(xs: number[]): boolean {
  return xs.every((v, i) => i == 0 || v > xs[i - 1])
}

/** Is every element exactly one larger than the previous?

  contiguous([1,2,3,4]) // => true
  contiguous([1,3,4,5]) // => false
  contiguous([3,1]    ) // => false
  contiguous([])        // => true

*/
export function contiguous(xs: number[]): boolean {
  return xs.every((x, i) => i == 0 || xs[i - 1] + 1 == x)
}

/** Flatten an array of arrays */
export function flatten<A>(xss: A[][]): A[] {
  return ([] as A[]).concat(...xss)
}

/** Flatten an array of arrays */
export function flatMap<A, B>(xs: A[], f: (a: A, index: number) => B[]): B[] {
  return flatten(xs.map(f))
}

/** Split an array into three pieces

  splitAt3('0123456'.split(''), 2, 4).map(xs => xs.join('')) // => ['01', '23', '456']
  splitAt3('0123456'.split(''), 2, 2).map(xs => xs.join('')) // => ['01', '', '23456']
  splitAt3('0123456'.split(''), 2, 9).map(xs => xs.join('')) // => ['01', '23456', '']
  splitAt3('0123456'.split(''), 0, 2).map(xs => xs.join('')) // => ['', '01', '23456']

*/
export function splitAt3<A>(xs: A[], start: number, end: number): [A[], A[], A[]] {
  const [ab, c] = R.splitAt(end, xs)
  const [a, b] = R.splitAt(start, ab)
  return [a, b, c]
}

/** Split an array into three pieces

  stringSplitAt3('0123456', 2, 4) // => ['01', '23', '456']
  stringSplitAt3('0123456', 2, 2) // => ['01', '', '23456']
  stringSplitAt3('0123456', 2, 9) // => ['01', '23456', '']
  stringSplitAt3('0123456', 0, 2) // => ['', '01', '23456']

*/
export function stringSplitAt3(xs: string, start: number, end: number): [string, string, string] {
  const [ab, c] = R.splitAt(end, xs)
  const [a, b] = R.splitAt(start, ab)
  return [a, b, c]
}

export function escape_pipe(x: string): string {
  return x.replace(/\\/g, '\\b').replace(/[|]/g, '\\|')
}

export function unescape_pipe(x: string): string {
  return x.replace(/\\[|]/g, '|').replace(/\\b/g, '\\')
}

export function pipesep(x: string[]): string {
  if (x.length == 0) {
    return '|'
  } else {
    return '|' + x.map(escape_pipe).join('|') + '|'
  }
}

export function pipeunsep(x: string): string[] {
  const m = x.match(/[|](?:\\[|]|[^|])*/g)
  if (!m || m[m.length - 1] != '|') {
    throw 'Not well-formed pipe-separated list: ' + x + ' ' + show(m)
  } else {
    return m.slice(0, m.length - 1).map(x => unescape_pipe(x.slice(1)))
  }
}

export function cat<A>(xs: (A | null)[]): A[] {
  const out = [] as A[]
  xs.map(x => x != null && out.push(x))
  return out
}

export function cycle<A>(n: number, xs: A[]): A[] {
  const out = [] as A[]
  let i = 0
  while (out.length < n) {
    out.push(xs[i])
    i++
    if (i >= xs.length) {
      i = 0
    }
  }
  return out
}

/** Minimum of a non-empty array */
export function minimum(xs: number[]) {
  return xs.reduce((x, y) => Math.min(x, y), xs[0])
}

/** Maximum of a non-empty array */
export function maximum(xs: number[]) {
  return xs.reduce((x, y) => Math.max(x, y), xs[0])
}

/** Sum the numbers in an array */
export function sum(xs: number[]) {
  return xs.reduce((x, y) => x + y, 0)
}

/** Minimum of a non-empty array */
export function minimumBy<A>(inj: (a: A) => R.Ordered, [hd, ...tl]: A[]): A {
  return R.reduce(R.minBy(inj), hd, tl)
}

/** Maximum of a non-empty array */
export function maximumBy<A>(inj: (a: A) => R.Ordered, [hd, ...tl]: A[]): A {
  return R.reduce(R.maxBy(inj), hd, tl)
}

/** Returns a copy of the array with duplicates removed, via toString */
export function uniq<A>(xs: A[]): A[] {
  const seen = {} as Record<string, boolean>
  return xs.filter(x => {
    const s = x.toString()
    const duplicate = s in seen
    seen[s] = true
    return !duplicate
  })
}

/** Removes adjacent elements that are equal, using === */
export function drop_adjacent_equal<A>(xs: A[]): A[] {
  return xs.filter((x, i) => i == 0 || x !== xs[i - 1])
}

/** Union-find data structure operations */
export interface UnionFind<A> {
  find(x: A): A
  union(x: A, y: A): A
  unions(xs: A[]): void
}

/** Make a union-find data structure */
export function UnionFind(): UnionFind<number> {
  const rev = [] as number[]
  const find = (x: number) => {
    if (rev[x] == undefined) {
      rev[x] = x
    } else if (rev[x] != x) {
      rev[x] = find(rev[x])
    }
    return rev[x]
  }
  const union = (x: number, y: number) => {
    const find_x = find(x)
    const find_y = find(y)
    if (find_x != find_y) {
      rev[find_y] = find_x
    }
    return find_x
  }
  const unions = (xs: number[]) => {
    if (xs.length > 0) {
      xs.reduce(union, xs[0])
    }
  }
  return {find, union, unions}
}

/** Assign unique numbers to each distinct element */
export function Renumber<A>(serialize = (a: A) => JSON.stringify(a)) {
  const bw: Record<string, number> = {}
  const fw: Record<string, A> = {}
  let i = 0
  return {
    num(a: A) {
      const s = serialize(a)
      if (!(s in bw)) {
        fw[i] = a
        bw[s] = i++
      }
      return bw[s]
    },
    un(n: number) {
      return fw[n]
    },
  }
}

/** Make a polymorphic union-find data structure */
export function PolyUnionFind<A>(
  serialize = (a: A) => JSON.stringify(a)
): UnionFind<A> & {repr: (a: A) => number} {
  const {un, num} = Renumber(serialize)
  const uf = UnionFind()
  return {
    repr: x => uf.find(num(x)),
    find: x => un(uf.find(num(x))),
    union: (x, y) => un(uf.union(num(x), num(y))),
    unions: xs => uf.unions(xs.map(num)),
  }
}

export function guard<A>(p: boolean | string | undefined, x: A): A[] {
  return p ? [x] : []
}

export function Counter<A>(xs: A[], serialize = (a: A) => JSON.stringify(a)) {
  const count: Record<string, number> = {}
  const insert = (x: A) => {
    const s = serialize(x)
    count[s] = 1 + (count[s] || 0)
  }
  xs.forEach(insert)
  return (x: A) => count[serialize(x)] || 0
}

/**

  const [ex, rm] = splice('abcdef'.split(''), 3, 1, ' ', '_')
  ex.join('') // => 'abc _ef'
  rm.join('') // => 'd'

  const [ex, rm] = splice('abcdef'.split(''), 3, 2, ' ', '_')
  ex.join('') // => 'abc _f'
  rm.join('') // => 'de'


*/
export function splice<A>(xs: A[], start: number, count: number, ...insert: A[]): [A[], A[]] {
  const ys = xs.slice()
  const zs = ys.splice(start, count, ...insert)
  return [ys, zs]
}

/** True iff this function throws an exception

  throws(() => '123')        // => false
  throws(() => raise('123')) // => true

*/
export function throws(m: () => any): boolean {
  try {
    return m(), false
  } catch (e) {
    return true
  }
}

/**

  const u = unique_check()
  u(1) // => true
  u(1) // => false
  u(1) // => false
  u(2) // => true
  u(3) // => true
  u(2) // => false

*/
export function unique_check<S>(): (s: S) => boolean {
  const seen = new Set<S>()
  return s => {
    if (seen.has(s)) {
      return false
    }
    seen.add(s)
    return true
  }
}

/** Raise an exception */
export function raise(s: string): any {
  throw s
}

export function overlaps<A>(s: Set<A>, t: Set<A>) {
  return [...s.keys()].some(k => t.has(k))
}

/** Moves a slice of the items and puts back them at some destination.

  rearrange([0, 1, 2, 3], 1, 2, 0) // => [1, 2, 0, 3]
  rearrange([0, 1, 2, 3], 1, 2, 3) // => [0, 3, 1, 2]

  rearrange([0, 1, 2, 3], 1, 2, 1) // => [0, 1, 2, 3]
  rearrange([0, 1, 2, 3], 1, 2, 2) // => [0, 1, 2, 3]

*/
export function rearrange<A>(xs: A[], begin: number, end: number, dest: number): A[] {
  const [a, mid, z] = splitAt3(xs, begin, end + 1)
  const w = end - begin
  if (dest > begin) {
    dest -= w
  }
  const [pre, post] = R.splitAt(dest, a.concat(z))
  return pre.concat(mid, post)
}

/** All numbers up to and excluding the argument number

  range(0) // => []
  range(1) // => [0]
  range(4) // => [0, 1, 2, 3]

*/
export function range(to: number) {
  const out = []
  for (let i = 0; i < to; ++i) {
    out.push(i)
  }
  return out
}

export function fromTo(begin: number, end: number) {
  const out = []
  for (let i = begin; i < end; ++i) {
    out.push(i)
  }
  return out
}

/** Calculate the next id to use from these identifiers

  next_id([]) // => 0
  next_id(['t1', 't2', 't3']) // => 4
  next_id(['u2v5k1', 'b3', 'a0']) // => 6
  next_id(['77j66']) // => 78

*/
export function next_id(xs: string[]): number {
  let max = -1
  xs.forEach(x => (x.match(/\d+/g) || []).forEach(i => (max = Math.max(max, parseInt(i)))))
  return max + 1
}

/** Reductio ad Absurdum */
export function absurd<A>(c: never): A {
  return c
}

// Store stuff

/**

    const store = Store.init('apa bepa cepa'.split(' '))
    const bepa = array_store_key(store, 'bepa')
    bepa.get() // => true
    bepa.set(false)
    store.get() // => ['apa', 'cepa']
    bepa.set(true)
    store.get() // => ['apa', 'cepa', 'bepa']
    store.set(['bepa'])
    bepa.get() // => true
    store.set(['bepa', 'bepa'])
    bepa.get() // => true
    bepa.set(true)
    store.get() // => ['bepa']
    bepa.set(false)
    store.get() // => []

This only obeys store laws if the equality of the store is relaxed to array set equality

*/
export function array_store_key(store: Store<string[]>, key: string): Store<boolean> {
  return array_store(store)
    .via(Lens.key(key))
    .via(Lens.iso((tu: true | undefined) => tu || false, (b: boolean) => b || undefined))
}

export function fromPairs<A extends string, B>(xs: [A, B][]): Record<A, B> {
  return Object.assign({}, ...xs.map(([a, b]) => ({[a as string]: b})))
}

export function array_store(store: Store<string[]>): Store<Record<string, true>> {
  return store.via(
    Lens.iso(
      (xs: string[]) => fromPairs(xs.map(x => [x, true] as [string, true])),
      (r: Record<string, true>) => record.traverse(r, (_, s) => s)
    )
  )
}

/**

    const store = Store.init('apa bepa cepa'.split(' '))
    const str = store_join(store)
    str.get() // => 'apa bepa cepa'
    str.set('cepa apa bepa')
    store.get() // => ['cepa', 'apa', 'bepa']
    str.set('  cepa         apa     bepa  ')
    store.get() // => ['', 'cepa', 'apa', 'bepa', '']
    str.get() // => ' cepa apa bepa '
    str.set('apa')
    str.modify(x => x + ' ')
    store.get() // => ['apa', '']
    str.modify(x => x + 'z')
    store.get() // => ['apa', 'z']

This only obeys store laws if the equality of the store is relaxed about
whitespace and strings do not mix whitespace and non-whitespace
*/
export function store_join(store: Store<string[]>): Store<string> {
  return store.via(Lens.iso((ss: string[]) => ss.join(' '), s => s.split(/\s+/g)))
}

/** POST request */
export function POST(
  url: string,
  data: any,
  k: (response: any) => void,
  k_err: (response: any, code: number) => void = () => {
    return
  }
): void {
  const r = new XMLHttpRequest()
  r.onreadystatechange = () => {
    if (r.readyState == 4 && r.status == 200) {
      k(r.response)
    }
    if (r.readyState == 4 && r.status > 200) {
      k_err(r.response, r.status)
    }
  }
  r.open('POST', url, true)
  r.setRequestHeader('Content-Type', 'application/json')
  r.send(JSON.stringify(data))
}

/** GET request */
export function GET(
  url: string,
  k: (response: any) => void,
  k_err: (response: any, code: number) => void = () => {
    return
  }
): void {
  const r = new XMLHttpRequest()
  r.onreadystatechange = () => {
    if (r.readyState == 4 && r.status == 200) {
      k(r.response)
    }
    if (r.readyState == 4 && r.status > 200) {
      k_err(r.response, r.status)
    }
  }
  r.open('GET', url, true)
  r.setRequestHeader('Content-Type', 'application/json')
  r.send()
}

/** Debounce from underscore.js

Returns a function, that, as long as it continues to be invoked, will not
be triggered. The function will be called after it stops being called for
N milliseconds.
*/
export function debounce(wait: number, k: (...args: any[]) => void): (...args: any[]) => void {
  let id: any | null
  return (...args: any[]) => {
    if (id != null) {
      clearTimeout(id)
    }
    id = setTimeout(() => {
      id = null
      k(...args)
    }, wait) as any
  }
}

/** Iterate a function f until a fixpoint x is reached (i.e. f(x) = x)

  fix(1234, x => Math.round(x / 2)) // => 1
  fix(1234, x => Math.floor(x / 2)) // => 0

*/
export function fix<A>(init: A, f: (a: A) => A): A {
  let v = init
  let last = v
  do {
    last = v
    v = f(v)
  } while (!R.equals(v, last))
  return v
}

export function cartesian<T, Ks extends keyof T>(r: {[K in Ks]: T[K][]}): {[K in Ks]: T[K]}[] {
  const ks = Object.keys(r)
  if (ks.length == 0) {
    return [{} as any]
  } else {
    const k = ks[0]
    const {[k]: vs, ...rest} = r as any
    return flatten(cartesian(rest).map(cr => vs.map((v: any) => ({[k]: v, ...cr})))) as any
  }
}

export function upper_triangular<A>(xs: A[]): [A, A][] {
  const out: [A, A][] = []
  xs.forEach((x, i) => xs.forEach((y, j) => j > i && out.push([x, y])))
  return out
}

/** Very inefficient implementation of pairing up equal series

  merge_series({x: [1,2,1,3],y: [2,1,3,1]}, sum, (a: number, b: number) => a == b) // => [{x: 3,y: 3},{x: 4,y: 4}]

  merge_series({x: [1,1,5,3],y: [1,1,3,5]}, sum, (a: number, b: number) => a == b) // => [{x: 1,y: 1},{x: 1,y: 1},{x: 8,y: 8}]

  merge_series({
    x: [1,2,5,3],
    y: [2,1,3,5],
    z: [1,1,1,2,4,2]
  }, sum, (a: number, b: number) => a == b) // => [{x: 3,y: 3,z: 3},{x: 8,y: 8,z: 8}]

*/
export function merge_series<K extends string, S, A>(
  r: Record<K, S[]>,
  concat: (xs: S[]) => A,
  cmp: (a: A, b: A) => boolean
): Record<K, A>[] {
  const coords = cartesian<Record<K, number>, K>(
    record.map(r, (ss: S[]) => ss.map((_, i) => i))
  ).sort((a, b) => sum(Object.values(a)) - sum(Object.values(b)))
  const prev = record.map(r, _ => 0)
  const out: Record<K, A>[] = []
  coords.forEach(coord => {
    if (record.traverse(coord, (i: number, k: K) => i >= prev[k]).every((b: boolean) => b)) {
      const a = record.map(r, (s, k) => concat(fromTo(prev[k], coord[k] + 1).map(i => s[i])))
      if (upper_triangular<A>(Object.values(a)).every(([x, y]) => cmp(x, y))) {
        record.forEach(coord, (i: number, k: K) => (prev[k] = i + 1))
        out.push(a)
      }
    }
  })
  return out
}

export function zipWithPrevious<A, B>(
  xs: A[],
  k: (x: A, prev: A | undefined, i: number) => B
): B[] {
  return xs.map((x, i) => k(x, xs[i - 1], i))
}

export interface KV<K, V> {
  has(k: K): boolean
  get(k: K): V | undefined
  set(k: K, v: V): void
  forEach(f: (v: V, k: K) => void): void
  batch(kvs: {key: K; value: V}[]): void
  obj: Record<string, V>
}

export function KV<K, V>(s: (k: K) => string = JSON.stringify): KV<K, V> {
  const obj = {} as Record<string, V>
  const krev = {} as Record<string, K>
  const api: KV<K, V> = {
    has(k: K) {
      return s(k) in obj
    },
    get(k: K): V | undefined {
      return obj[s(k)]
    },
    set(k: K, v: V) {
      obj[s(k)] = v
      krev[s(k)] = k
    },
    forEach(f) {
      Object.keys(obj).map(sk => f(obj[sk], krev[sk]))
    },
    batch(kvs) {
      kvs.map(m => api.set(m.key, m.value))
    },
    obj,
  }
  return api
}

export function memo<A, B>(f: (a: A) => B, s: (a: A) => string = JSON.stringify): (a: A) => B {
  const mem = KV<A, B>()
  function ff(a: A): B {
    const m = mem.get(a)
    if (m) {
      return m
    }
    const ret = f(a)
    mem.set(a, ret)
    return ret
  }
  return ff
}

export function memo2<A1, A2, B>(
  f: (a1: A1, a2: A2) => B,
  s: (a1: A1, a2: A2) => string = (a1, a2) => JSON.stringify([a1, a2])
): (a1: A1, a2: A2) => B {
  const ff = memo<[A1, A2], B>(a => f(a[0], a[1]))
  return (a1, a2) => ff([a1, a2])
}

export type SnocList<A> = Snoc<A> | null
export interface Snoc<A> {
  0: SnocList<A>
  1: A
}
export function snoc<A>(xs: SnocList<A>, x: A): SnocList<A> {
  return [xs, x]
}

export function snocs<A>(xs: SnocList<A>, ys: A[]): SnocList<A> {
  return ys.reduce((xs, y) => snoc(xs, y), xs)
}

export function snocsToArray<A>(xs: SnocList<A>): A[] {
  const out: A[] = []
  while (xs !== null) {
    out.push(xs[1])
    xs = xs[0]
  }
  return out.reverse()
}

export function expr<R>(k: () => R): R {
  return k()
}

export function chain<A, B>(a: A, f: (a: A) => B): B {
  return f(a)
}

export function push<K extends string, V>(obj: Record<K, V[]>, k: string, ...vs: V[]) {
  const _obj = (obj as any) as Record<string, V[]>
  ;(_obj[k] || (_obj[k] = [])).push(...vs)
}

// ADTs
export interface ADT<
  TagName extends string,
  Ty,
  Cons extends Record<string, {con: any; params: any}>
> {
  Ty: Ty
  Params: {[K in keyof Cons]: Cons[K]['params']}
  Cons: {[K in keyof Cons]: Cons[K]['con']}
  cons: {[K in keyof Cons]: (a: Cons[K]['params']) => Cons[K]['con']}
  alt<K extends string>(
    k: K
  ): <A>() => ADT<
    TagName,
    ({[T in TagName]: K} & A) | Ty,
    {[k in K]: {con: {[T in TagName]: K} & A; params: A}} & Cons
  >

  match<R>(
    cases:
      | {[K in keyof Cons]: (a: Cons[K]['con']) => R}
      | ({[K in keyof Cons]?: (a: Cons[K]['con']) => R} & {default(d: Ty): R})
  ): (a: Ty) => R

  // todo: implement partition
  // partition: (xs: Ty[]) => {[K in keyof Cons]: Cons[K]['con'][]}
}

export function ADT<TagName extends string>(tag_name: TagName): ADT<TagName, never, {}> {
  return adt(tag_name, [])
}

function adt<TagName extends string, Ty, Cons extends Record<string, {con: any; params: any}>>(
  tag_name: string,
  ctors: (keyof Cons)[]
): ADT<TagName, Ty, Cons> {
  const cons = {} as any
  for (const ctor of ctors) {
    cons[ctor] = (d: any) => ({...d, [tag_name as string]: ctor})
  }
  return {
    Ty: undefined as any,
    Params: undefined as any,
    Cons: undefined as any,
    cons,
    alt: k => () => adt(tag_name, ctors.concat([k])) as any,
    match: cases => a => {
      const tag = (a as any)[tag_name]
      if (tag in cases) {
        return (cases as any)[tag](a)
      } else if ('default' in cases) {
        return (cases as any).default(a)
      } else {
        console.dir({msg: 'Irrefutable pattern', a, cons: Object.keys(cons), tag_name})
        console.trace()
        throw 'Irrefutable pattern'
      }
    },
  }
}
