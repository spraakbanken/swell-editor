import * as L from './LadderView'
import * as G from './Graph'
import {Image, ImageServer} from './ImageServer'

import {Data, key} from './SpaghettiTypes'
export {Data, key}

export function graph_to_data(graph: G.Graph): Data {
  const stu = G.graph_to_units(graph)
  const {source, target} = stu
  return {
    graph,
    ...stu,

    source_string: G.units_to_string(source),

    target_string: G.units_to_string(target),
  }
}

function string_to_data(query_string: string): Data {
  const [source_string, target_string] = query_string.split('//', 2)
  if (source_string && target_string) {
    const source = G.parse(source_string)
    const target = G.parse(target_string)
    const graph = G.units_to_graph(source, target)
    return {source, target, graph, source_string, target_string}
  } else {
    throw new Error('Need two // separated strings')
  }
}

function data_to_react(data: Data): React.ReactElement<{}> {
  return L.ladder(data.graph)
}

export const image: Image<Data> = {
  string_to_data,
  data_to_react,
  key,
}

export const serve = (port?: number) => ImageServer(image, port)

import {argv} from 'process'
if (argv[2] == '--serve') {
  serve(Number.parseInt(argv[3] || '3000', 10))
}
