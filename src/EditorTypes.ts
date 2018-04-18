import * as G from './Graph'

export interface Data {
  /** The graph: this is the only /real/ data, the other is meta-data */
  graph: G.Graph

  source_string: string
  target_string: string
  source: G.Unit[]
  target: G.Unit[]
}

// stored in png tEXt
export const key: string = 'swell0'
