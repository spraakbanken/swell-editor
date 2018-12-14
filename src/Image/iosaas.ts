import * as React from 'react'
import * as GV from '../GraphView'
import * as G from '../Graph'
import {pseudonymizeToken} from '../Editor/Model'
import {Image, ImageServer} from './ImageServer'

import {Data, key, string_to_data} from '../EditorTypes'
export * from '../EditorTypes'

function data_to_react(data: Data): React.ReactElement<{}> {
  return React.createElement(
    'div',
    {className: 'NoManualBlue'},
    GV.graphView(G.anonymize_when(data.anon_mode, pseudonymizeToken)(data.graph))
  )
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
