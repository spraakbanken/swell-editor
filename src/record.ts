export function create<K extends string, A>(ks: K[], f: (k: K, index: number) => A): Record<K, A> {
  const obj = {} as Record<K, A>
  ks.forEach((k, i) => (obj[k] = f(k, i)))
  return obj
}

export function init<K extends string, V>(kvs: {k: K; v: V}[]): Record<K, V> {
  const obj = {} as Record<K, V>
  kvs.forEach(({k, v}) => (obj[k] = v))
  return obj
}

export function flatten<O extends Record<string, any>>(oss: O[]): O {
  const obj = {} as O
  oss.forEach(os => forEach(os, (v: string, k: any) => (obj[k] = v)))
  return obj
}

export function forEach<K extends string, A>(x: Record<K, A>, k: (a: A, id: K) => void): void {
  ;(Object.keys(x) as K[]).forEach((id: K) => k(x[id], id))
}

export function traverse<K extends string, A, B>(
  x: Record<K, A>,
  k: (a: A, id: K) => B,
  sort_keys: boolean = false
): B[] {
  const ks = Object.keys(x) as K[]
  if (sort_keys) {
    ks.sort()
  }
  return ks.map((id: K) => k(x[id], id))
}

export function map<K extends string, A, B>(x: Record<K, A>, k: (a: A, id: K) => B): Record<K, B> {
  const out = {} as Record<K, B>
  forEach(x, (a, id) => (out[id] = k(a, id)))
  return out
}

export function filter<K extends string, A>(
  x: Record<K, A>,
  k: (a: A, id: string) => boolean
): Record<K, A> {
  const out = {} as Record<K, A>
  forEach(x, (a, id) => k(a, id) && (out[id] = a))
  return out
}

export function lookup<K extends string, V>(x: Record<K, V>, k: K, def: V): V {
  return x[k] || def
}

export function modify<K extends string, V>(x: Record<K, V>, k: K, def: V, f: (v: V) => V): V {
  return (x[k] = f(x[k] || def))
}

export function reverse_lookup<K extends string, V extends string>(
  x: Record<K, V>,
  v: V
): K | undefined {
  return traverse(filter(x, v2 => v == v2), (v, k: K) => k)[0]
}
