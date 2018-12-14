import * as Utils from '../Utils'
import {onFile} from './png'

import * as minimist from 'minimist'
import {argv} from 'process'

const args: Record<string, string> = minimist(argv.slice(2))

const {
  set,
  get,
  to,
  out,
  _: [infile],
} = args
if (set && to && out && infile) {
  onFile.set(set, to, infile, out)
} else if (get && infile) {
  Utils.stdout(onFile.get(get, infile))
} else {
  console.error(`Usage:
    ts-node png-io.ts infile.png --set key --to value --out outfile.png
    ts-node png-io.ts infile.png --get key
  `)
  console.log({set, get, to, out, infile})
}
