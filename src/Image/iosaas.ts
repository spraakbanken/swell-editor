import * as React from 'react'
import * as GV from '../GraphView'
import {Store} from 'reactive-lens'
import {anonymize_when} from '../Editor/Anonymization'
import {Image, ImageServer} from './ImageServer'

import {Data, key, string_to_data} from '../EditorTypes'
export * from '../EditorTypes'

function data_to_react(data: Data): React.ReactElement<{}> {
  const pstore = Store.init({}) as Store<Record<string, string>>
  return React.createElement(
    'div',
    {className: 'NoManualBlue'},
    GV.graphView(anonymize_when(data.anon_mode)(data.graph, pstore))
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
