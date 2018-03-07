import * as L from './LadderView'
import * as C from './Compact'
import * as G from './Graph'
import {Image, ImageServer} from './ImageServer'

import {Data, key} from './SpaghettiTypes'

function string_to_data(query_string: string) {
  const [source_string, target_string] = query_string.split('//', 2)
  if (source_string && target_string) {
    const source = C.parse(source_string)
    const target = C.parse(target_string)
    const graph = C.units_to_graph(source, target)
    return {source, target, graph, source_string, target_string}
  } else {
    return undefined
  }
}

function data_to_react(data: Data): React.ReactElement<{}> {
  return L.Ladder(data.graph)
}

const image: Image<Data> = {
  string_to_data,
  data_to_react,
  key,
}

ImageServer(image)
