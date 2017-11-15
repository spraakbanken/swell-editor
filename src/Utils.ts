
import * as Dmp from "diff-match-patch"
export const dmp = new Dmp.diff_match_patch()

export type TokenDiff = [number, string][]

export function token_diff(s1: string, s2: string) {
  const d = dmp.diff_main(s1, s2)
  dmp.diff_cleanupSemantic(d)
  return d
}

export const invert_token_diff = (ds : TokenDiff) => ds.map(([i, s]) => [-i, s] as [number, string])

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

/** Check if two lists are a permutation of each other */
export function array_multiset_eq(xs: number[], ys: number[]): boolean {
  return shallow_array_eq(numsort(xs), numsort(ys))
}

/** map for strings */
export function str_map<A>(s: string, f: (c: string, i: number) => A): A[] {
  const out = [] as A[];
  for (let i = 0; i < s.length; ++i) {
    out.push(f(s[i], i))
  }
  return out
}

/** Show a JSON object with indentation */
export function show(x: any): string {
  return JSON.stringify(x, undefined, 2)
}

/** Numeric sort */
export function numsort(xs: number[]): number[] {
  return xs.slice().sort((u,v) => u - v)
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

/** Splits a string up in the initial part and all trailing whitespace

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
  return xs.every((v, i) => i == 0 || v > xs[i-1])
}

/** Is every element exactly one larger than the previous?

  contiguous([1,2,3,4]) // => true
  contiguous([1,3,4,5]) // => false
  contiguous([3,1]    ) // => false
  contiguous([])        // => true

*/
export function contiguous(xs: number[]): boolean {
  return xs.every((x, i) => i == 0 || xs[i-1] + 1 == x)
}

/** Flatten an array of arrays */
export function flatten<A>(xss: A[][]): A[] {
  return ([] as any).concat(...xss)
}

/** Flatten an array of arrays */
export function flatMap<A, B>(xs: A[], f: (a: A) => B[]): B[] {
  return flatten(xs.map(f))
}


/** Split an array into two pieces */
export function splitAt<A>(xs: A[], i: number): [A[], A[]] {
  return [xs.slice(0, i), xs.slice(i)]
}

/** Split a string into two pieces */
export function stringSplitAt<A>(s: string, i: number): [string, string] {
  return [s.slice(0, i), s.slice(i)]
}

/** Split an array into three pieces

  splitAt3('0123456'.split(''), 2, 4).map(xs => xs.join('')) // => ['01', '23', '456']
  splitAt3('0123456'.split(''), 2, 2).map(xs => xs.join('')) // => ['01', '', '23456']
  splitAt3('0123456'.split(''), 2, 9).map(xs => xs.join('')) // => ['01', '23456', '']
  splitAt3('0123456'.split(''), 0, 2).map(xs => xs.join('')) // => ['', '01', '23456']

*/
export function splitAt3<A>(xs: A[], start: number, end: number): [A[], A[], A[]] {
  const [ab,c] = splitAt(xs, end)
  const [a,b] = splitAt(ab, start)
  return [a,b,c]
}

/** Split an array into three pieces

  stringSplitAt3('0123456', 2, 4) // => ['01', '23', '456']
  stringSplitAt3('0123456', 2, 2) // => ['01', '', '23456']
  stringSplitAt3('0123456', 2, 9) // => ['01', '23456', '']
  stringSplitAt3('0123456', 0, 2) // => ['', '01', '23456']

*/
export function stringSplitAt3(xs: string, start: number, end: number): [string, string, string] {
  const [ab,c] = stringSplitAt(xs, end)
  const [a,b] = stringSplitAt(ab, start)
  return [a,b,c]
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
    return m.slice(0, m.length - 1).map((x) => unescape_pipe(x.slice(1)))
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
  return xs.reduce((x,y) => Math.min(x,y), xs[0])
}

/** Maximum of a non-empty array */
export function maximum(xs: number[]) {
  return xs.reduce((x,y) => Math.max(x,y), xs[0])
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

/** Union-find data structure operations */
interface UnionFind {
  find(x: number): number,
  union(x: number, y: number): number,
  unions(xs: number[]): void,
}

/** Make a union-find data structure */
export function UnionFind(): UnionFind {
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
    return (m(), false)
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
