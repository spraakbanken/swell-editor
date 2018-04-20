import {qc, graph_one_space} from './Common'
import {Gen} from 'proptest'
import * as QC from 'proptest'
import * as G from '../src/Graph'

import * as iosaas from '../src/iosaas'
import * as png from '../src/png'
import * as ImageServer from '../src/ImageServer'
import fetch from 'node-fetch'

import 'mocha'
import {expect} from 'chai'

import * as http from 'http'
import * as fs from 'fs'
import * as Utils from '../src/Utils'

describe('png metadata via webserver', async () => {
  const port = 3001
  const server = `http://localhost:${port}`
  const png_url = (d: iosaas.Data) => `${server}/i.png?${encodeURIComponent(iosaas.data_to_string(d))}`
  const metadata_url = (d: iosaas.Data) => `${server}/metadata.json?${encodeURIComponent(png_url(d))}`
  let shutdown: () => Promise<void>
  before(async () => {
    shutdown = await iosaas.serve(3001)
  })
  Utils.range(8).map(s0 => {
    const size = (s0 + 1) * 12
    const mem = (i: number) => (i > 0 ? `, and hits memo` : '')
    Utils.range(4).forEach(i =>
      it(`roundtrips graph of size ${size}${mem(i)}`, async () => {
        const g = graph_one_space.sample(size, 45)
        const data = iosaas.graph_to_data(g)
        // Utils.stdout(g)
        // Utils.stdout(iosaas.data_to_string(data))
        // const data2 = await ImageServer.metadata_from_url(iosaas.image, png_url(data))
        // expect(data2.graph).to.deep.equal(data.graph)
        const data3 = await fetch(metadata_url(data)).then(x => x.json())
        expect(data3.graph).to.deep.equal(data.graph)
      })
    )
  })
  after(async () => {
    await shutdown()
  })
})
