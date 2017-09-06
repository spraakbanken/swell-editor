
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

/** Is every element larger than the previous? */
export function increases(xs: number[]): boolean {
  return xs.every((v, i) => i == 0 || v > xs[i-1])
}

/** Is every element exactly one larger than the previous? */
export function contiguous(xs: number[]): boolean {
  return xs.every((x, i) => i == 0 || xs[i-1] + 1 == x)
}

/** Flatten an array of arrays */
export function flatten<A>(xss: A[][]): A[] {
  return ([] as any).concat(...xss)
}

/** Split an array into two pieces */
export function splitAt<A>(xs: A[], i: number): [A[], A[]] {
  return [xs.slice(0, i), xs.slice(i)]
}

/** Split an array into three pieces */
export function splitAt3<A>(xs: A[], start: number, end: number): [A[], A[], A[]] {
  const [ab,c] = splitAt(xs, end)
  const [a,b] = splitAt(ab, start)
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
