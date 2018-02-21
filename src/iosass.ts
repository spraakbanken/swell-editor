import * as process from 'process'
import * as express from 'express'
import * as Url from 'url'

import * as ReactSSR from 'react-dom/server'
import * as typestyle from 'typestyle'

import * as L from './LadderView'
import * as C from './Compact'

import * as csstips from 'csstips'

import * as phantom from 'phantom'
import * as puppeteer from 'puppeteer'

import * as pool from 'generic-pool'

csstips.normalize()
csstips.setupPage('body')

const app = express()
const port = parseInt(process.argv[2], 10) || 3000

const express_throttle = require('express-throttle')
const options = {burst: 5, period: '1s'}
const throttle = express_throttle(options)

function page_for(url: string): string {
  const q = decodeURIComponent(Url.parse(url).query || '')
  console.log(q)
  const [source, target] = q.split('//', 2)
  if (source && target) {
    const s = C.test_parse(source)
    const t = C.test_parse(target)
    const g = C.units_to_graph(s, t)
    const css = typestyle.getStyles()
    const html = ReactSSR.renderToStaticMarkup(L.Ladder(g))
    return `
      <!DOCTYPE html>
      <html>
          <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <title>constant spaghetti</title>
              <style>body{background:#ffffff;}${css}</style>
          </head>
          <body>${html}</body>
      </html>
    `
  } else {
    return 'need two //-separated lines'
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

    app.get('/pj.png', throttle, async (req, res) => {
      const page = await phantom_page.acquire()
      try {
        await page.property('viewportSize', {width: 800, height: 600})
        const status = await page.setContent(page_for(req.url), '')
        const ladder: ClientRect | null = await page.evaluate(function() {
          var ladder = document.querySelector('.ladder')
          return ladder ? ladder.getBoundingClientRect() : null
        })
        if (!ladder) {
          throw 'ladder not found on page!'
        }
        await page.property('viewportSize', {width: ladder.right, height: ladder.bottom})
        const b64png = await page.renderBase64('png')
        res.send(new Buffer(b64png, 'base64'))
      } catch (e) {
        res.send(e.toString())
      } finally {
        phantom_page.release(page)
      }
    })

    app.get('/pup.png', throttle, async (req, res) => {
      const page = await chrome_page.acquire()
      try {
        const status = await page.setContent(page_for(req.url))
        const ladder = await page.$('.ladder')
        if (!ladder) {
          throw 'ladder not found on chrome_page'
        }
        const png = await ladder.screenshot({type: 'png'})
        res.send(png)
      } catch (e) {
        res.send(e.toString())
      } finally {
        chrome_page.release(page)
      }
    })

    const server = app.listen(port, () => console.log('Setting phasers to stun...'))

    async function cleanup() {
      console.log('closing...')
      await phantom_page.drain()
      await chrome_page.drain()
      phantom_browser.exit()
      await chrome_browser.close()
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
