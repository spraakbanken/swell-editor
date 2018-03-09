import {qc, graph_no_ws} from './Common'
import {Gen} from 'ts-quickcheck'
import * as QC from 'ts-quickcheck'
import * as G from '../src/Graph'

import * as iosaas from '../src/iosaas'
import * as png from '../src/png'

import "mocha"
import {expect} from "chai"

import * as http from 'http'
import * as fs from 'fs'
import * as Utils from '../src/Utils'

describe('png metadata (note: whitespace normalized, only .graph considered)', async () => {
  const port = 3001
  const url = (d: iosaas.Data) => `http://localhost:${port}/i.png?${encodeURIComponent(d.source_string)}//${encodeURIComponent(d.target_string)}`
  let shutdown: () => Promise<void>
  before(async () => {
    shutdown = await iosaas.serve(3001)
  })
  Utils.range(8).map(s0 => {
    const size = s0 * 10
    it(`roundtrips graph of size ${size}`, async () => {
      const g = graph_no_ws.sample(size)
      const data = iosaas.graph_to_data(g)
      const buf = await new Promise<Buffer>(
        (resolve, reject) =>
          http.get(url(data), res => {
            res.on('data', chunk => typeof chunk === 'string' ?
              reject('chunk not a buffer') :
              resolve(chunk))
            }))

      fs.writeFileSync(`i${size}.png`, buf)
      const data2 = png.onBuffer.get(iosaas.key, buf)
      expect(data2.graph).to.deep.equal(data.graph)
    })
  })
  after(async () => {
    await shutdown()
  })
})
