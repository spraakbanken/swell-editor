import * as R from 'ramda'
import * as G from './Graph'

export interface Data {
  graph: G.Graph
  anon_mode?: boolean
}

export const mode_anon = 'mode:anon '

export function data_to_string(d: Data): string {
  return (d.anon_mode ? mode_anon : '') + G.graph_to_compact(d.graph)
}

export function graph_to_data(graph: G.Graph, anon_mode: boolean): Data {
  return {graph, anon_mode}
}

export function string_to_data(query_string: string): Data {
  const [a, b] = R.splitAt(mode_anon.length, query_string)
  const anon_mode = a == mode_anon
  const s = anon_mode ? b : query_string
  return {graph: G.compact_to_graph(s), anon_mode}
}

// stored in png tEXt
export const key: string = 'swell0'
