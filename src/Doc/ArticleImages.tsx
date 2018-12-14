import {View, State} from './Article'
import {Image, ImageServer} from '../Image/ImageServer'

function string_to_data(query_string: string): State {
  return {only: parseInt(query_string, 10) || 0}
}

function data_to_react(state: State): React.ReactElement<{}> {
  return View(state)
}

export const image: Image<State> = {
  string_to_data,
  data_to_react,
  key: 'article_image',
}

export const serve = (port?: number) => ImageServer(image, port)

import {argv} from 'process'
if (argv[2] == '--serve') {
  serve(Number.parseInt(argv[3] || '3000', 10))
}
