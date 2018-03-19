import * as express from 'express'
import * as compression from 'compression'
import * as morgan from 'morgan'
const throttle = require('express-throttle')

import * as memoizee from 'memoizee'
const memo = <A>(f: (a: string) => Promise<A>) => memoizee(f, {promise: true, length: 1})

import * as Url from 'url'

import * as ReactSSR from 'react-dom/server'
import * as typestyle from 'typestyle'

import * as csstips from 'csstips'

import * as png from './png'

import * as renderers from './render'

import fetch from 'node-fetch'

import {Image} from './ImageType'
export {Image}

csstips.normalize()
csstips.setupPage('body')

import * as fs from 'fs'
import * as path from 'path'
import * as process from 'process'

const lato = fs
  .readFileSync('node_modules/lato-font/fonts/lato-medium/lato-medium.woff')
  .toString('base64')

function vnode_to_html(vnode: React.ReactElement<{}>): string {
  const body = ReactSSR.renderToStaticMarkup(vnode)
  const css = typestyle.getStyles()
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>#capture{display:inline-block;}${css}
        @font-face {
          font-family: "lato";
          src: url("data:font/woff;base64,${lato}") format('woff');
        }
        body{background:#fff; font-family: lato;}
        </style>
      </head>
      <body><div id="capture">${body}</div></body>
    </html>`
}

export async function ImageMaker<Data>(
  image: Image<Data>,
  renderer = renderers.makeChromeRenderer
) {
  const {render, cleanup} = await renderer()

  async function snap(query_string: string) {
    const data = image.string_to_data(query_string)
    const html = vnode_to_html(image.data_to_react(data))
    const buf = await render(html, '#capture')
    return png.onBuffer.set(image.key, data, buf)
  }

  return {snap, cleanup}
}

function req_to_string(url: string) {
  return decodeURIComponent(Url.parse(url).query || '')
}

export async function metadata_from_url<Data>(image: Image<Data>, url: string): Promise<Data> {
  const buf = await fetch(url).then(res => res.buffer())
  // console.log(buf.length, 'bytes from', url)
  return png.onBuffer.get(image.key, buf)
}

export async function ImageServer<Data>(
  image: Image<Data>,
  port = parseInt(process.argv[2], 10) || 3000
) {
  const throttle_options = {burst: 32, period: '10s'}
  const app = express()
  app.use(compression())

  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'))
  } else {
    const access_log = path.join(__dirname, 'access.log')
    const stream = fs.createWriteStream(access_log, {flags: 'a'})
    console.log('Writing to ' + access_log)
    app.use(morgan('combined', {stream}))
  }

  app.get('/', (req, res) => {
    res.send(vnode_to_html(image.data_to_react(image.string_to_data(req_to_string(req.url)))))
  })

  const image_maker = await ImageMaker(image)
  const snap = memo(url => image_maker.snap(req_to_string(url)))
  const metadata = memo(url => metadata_from_url(image, req_to_string(url)))

  app.get('/*png', throttle(throttle_options), async (req, res) => {
    try {
      const png = await snap(req.url)
      res.setHeader('Cache-Control', 'no-cache')
      res.contentType('image/png')
      res.send(png)
    } catch (e) {
      res.status(400).send(e.toString())
    }
  })

  app.get('/metadata.json', throttle(throttle_options), async (req, res) => {
    try {
      res.contentType('application/json')
      const data = await metadata(req.url)
      res.send(data)
    } catch (e) {
      res.status(400).send(e.toString())
    }
  })

  const server = app.listen(port, () => console.log(`Serving on port ${port}`))

  async function shutdown() {
    console.log('Webserver shutdown...')
    image_maker.cleanup()
    server.close()
  }

  process.on('exit', shutdown)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  return shutdown
}
