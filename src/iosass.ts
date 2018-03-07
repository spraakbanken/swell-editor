import * as process from 'process'
import * as express from 'express'
import * as Url from 'url'

import * as ReactSSR from 'react-dom/server'
import * as typestyle from 'typestyle'

import * as L from './LadderView'
import * as C from './Compact'
import * as G from './Graph'

import * as csstips from 'csstips'

import * as phantom from 'phantom'
import * as puppeteer from 'puppeteer'

import * as pool from 'generic-pool'

import * as png from './png'

csstips.normalize()
csstips.setupPage('body')

const app = express()
const port = parseInt(process.argv[2], 10) || 3000

const express_throttle = require('express-throttle')
const options = {burst: 5, period: '1s'}
const throttle = express_throttle(options)

interface Data {
  source_string: string
  target_string: string
  source: C.Unit[]
  target: C.Unit[]
  graph: G.Graph
}

function page_for(url: string): {html: string; data: Data} {
  const q = decodeURIComponent(Url.parse(url).query || '')
  console.log(q)
  const [source_string, target_string] = q.split('//', 2)
  if (source_string && target_string) {
    const source = C.parse(source_string)
    const target = C.parse(target_string)
    const graph = C.units_to_graph(source, target)
    const css = typestyle.getStyles()
    const body = ReactSSR.renderToStaticMarkup(L.Ladder(graph))
    const html = `
      <!DOCTYPE html>
      <html>
          <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <title>constant spaghetti</title>
              <style>body{background:#ffffff;}${css}</style>
          </head>
          <body>${body}</body>
      </html>
    `
    return {html, data: {source, target, graph, source_string, target_string}}
  } else {
    return {html: 'need two //-separated lines', data: undefined as any}
  }
}

async function main() {
  try {
    app.get('/', (req, res) => {
      res.send(page_for(req.url))
    })

    const opts = {min: 32, max: 32}

    const phantom_browser = await phantom.create()

    const phantom_page = pool.createPool(
      {
        create: () => phantom_browser.createPage(),
        destroy: async page => (await page.close(), undefined),
      },
      opts
    )

    app.get('/pj.png', throttle, async (req, res) => {
      const page = await phantom_page.acquire()
      try {
        await page.property('viewportSize', {width: 800, height: 600})
        const {html, data} = page_for(req.url)
        const status = await page.setContent(html, '')
        const ladder: ClientRect | null = await page.evaluate(function() {
          var ladder = document.querySelector('.ladder')
          return ladder ? ladder.getBoundingClientRect() : null
        })
        if (!ladder) {
          throw 'ladder not found on page!'
        }
        await page.property('viewportSize', {width: ladder.right, height: ladder.bottom})
        const b64png = await page.renderBase64('png')
        res.contentType('image/png')
        res.send(png.onBuffer.set(png.SWELL_KEY, data, new Buffer(b64png, 'base64')))
      } catch (e) {
        res.send(e.toString())
      } finally {
        phantom_page.release(page)
      }
    })

    /*
    const chrome_browser = await puppeteer.launch({
      args: ['--no-sandbox'],
    })
    const chrome_page = pool.createPool(
      {
        create: () => chrome_browser.newPage(),
        destroy: async page => (await page.close(), undefined),
      },
      opts
    )

    app.get('/pup.png', throttle, async (req, res) => {
      const page = await chrome_page.acquire()
      try {
        const status = await page.setContent(page_for(req.url))
        const ladder = await page.$('.ladder')
        if (!ladder) {
          throw 'ladder not found on chrome_page'
        }
        const png = await ladder.screenshot({type: 'png'})
        res.send(png.onBuffer.set(PNG_KEY, data, new Buffer(png ??)))
        res.send(png)
      } catch (e) {
        res.send(e.toString())
      } finally {
        chrome_page.release(page)
      }
    })
    */
    async function chrome_cleanup() {
      // await chrome_page.drain()
      // await chrome_browser.close()
    }

    const server = app.listen(port, () => console.log('Setting phasers to stun...'))

    async function cleanup() {
      console.log('closing...')
      await chrome_cleanup()
      await phantom_page.drain()
      phantom_browser.exit()
      server.close()
    }

    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  } catch (e) {
    console.error(e)
  }
}

main()
