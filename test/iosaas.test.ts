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
  const png_url = (d: iosaas.Data) =>
    `${server}/i.png?${encodeURIComponent(iosaas.data_to_string(d))}`
  const metadata_url = (d: iosaas.Data) =>
    `${server}/metadata.json?${encodeURIComponent(png_url(d))}`
  let shutdown: () => Promise<void>
  before(async () => {
    shutdown = await iosaas.serve(3001)
  })
  Utils.range(8).map(s0 => {
    const size = (s0 + 1) * 12
    const anon_mode = s0 % 2 == 1
    const mem = (i: number) => (i > 0 ? `, and hits memo` : '')
    Utils.range(4).forEach(i =>
      it(`roundtrips graph of size ${size}${mem(i)}`, async () => {
        const g = graph_one_space.sample(size, 45)
        const data = iosaas.graph_to_data(g, anon_mode)
        const data2 = await fetch(metadata_url(data)).then(x => x.json())
        expect(data2).to.deep.equal(data)
      })
    )
  })
  after(async () => {
    await shutdown()
  })
})
