import * as C from './Compact'
import * as G from './Graph'

export interface Data {
  source_string: string
  target_string: string
  source: C.Unit[]
  target: C.Unit[]
  graph: G.Graph
}

// stored in png tEXt
export const key: string = 'swell0'
