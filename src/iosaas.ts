import * as GV from './GraphView'
import * as G from './Graph'
import {Image, ImageServer} from './ImageServer'

import {Data, key} from './EditorTypes'
export {Data, key}

export function graph_to_data(graph: G.Graph): Data {
  return {graph}
}

export function data_to_string(d: Data): string {
  return G.graph_to_compact(d.graph)
}

function string_to_data(query_string: string): Data {
  return {graph: G.compact_to_graph(query_string)}
}

function data_to_react(data: Data): React.ReactElement<{}> {
  return GV.graphView(data.graph)
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
