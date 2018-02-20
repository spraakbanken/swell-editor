import * as express from 'express'
import * as Url from 'url'

import * as ReactSSR from 'react-dom/server'
import * as typestyle from 'typestyle'

import * as L from './LadderView'
import * as C from './Compact'

import * as csstips from 'csstips'
csstips.normalize()
csstips.setupPage('body')

const app = express()

import * as phantom from 'phantom'
import * as puppeteer from 'puppeteer'

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
  app.get('/', (req, res) => {
    res.send(page_for(req.url))
  })

  const phantom_browser = await phantom.create()

  app.get('/pj.png', async (req, res) => {
    try {
      const page = await phantom_browser.createPage()
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
      await page.close()
    } catch (e) {
      res.send(e.toString())
    }
  })

  const chrome_browser = await puppeteer.launch({
    args: ['--no-sandbox'],
  })

  app.get('/pup.png', async (req, res) => {
    try {
      const page = await chrome_browser.newPage()
      const status = await page.setContent(page_for(req.url))
      const ladder = await page.$('.ladder')
      if (!ladder) {
        throw 'ladder not found on page'
      }
      const png = await ladder.screenshot({type: 'png'})
      res.send(png)
      await page.close()
    } catch (e) {
      res.send(e.toString())
    }
  })

  const server = app.listen(3000, () => console.log('Setting phasers to stun...'))

  function cleanup() {
    console.log('closing...')
    phantom_browser.exit()
    chrome_browser.close()
    server.close()
  }

  process.on('exit', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGKILL', cleanup)
}

main()
