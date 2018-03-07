import * as phantom from 'phantom'
import * as puppeteer from 'puppeteer'

import * as pool from 'generic-pool'

export interface Renderer {
  render(html: string, selector: string): Promise<Buffer>
  cleanup(): Promise<void>
}

export async function makePhantomRenderer(): Promise<Renderer> {
  const opts = {min: 32, max: 32}

  const phantom_browser = await phantom.create()

  const phantom_page = pool.createPool(
    {
      create: () => phantom_browser.createPage(),
      destroy: async page => (await page.close(), undefined),
    },
    opts
  )

  async function render(html: string, selector: string): Promise<Buffer> {
    const page = await phantom_page.acquire()
    let ret: Buffer | string = 'error'
    try {
      await page.property('viewportSize', {width: 800, height: 600})
      const status = await page.setContent(html, '')
      const rect: ClientRect | null = await page.evaluate(function(selector) {
        var element = document.querySelector(selector)
        return element ? element.getBoundingClientRect() : null
      }, selector)
      if (!rect) {
        throw `${selector} not found on page!`
      }
      await page.property('viewportSize', {width: rect.right, height: rect.bottom})
      const b64png = await page.renderBase64('png')
      return new Buffer(b64png, 'base64')
    } finally {
      phantom_page.release(page)
    }
  }

  async function cleanup() {
    await phantom_page.drain()
    phantom_browser.exit()
  }

  return {render, cleanup}
}

export async function makeChromeRenderer(): Promise<Renderer> {
  const opts = {min: 32, max: 32}

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

  async function render(html: string, selector: string): Promise<Buffer> {
    const page = await chrome_page.acquire()
    let ret: Buffer | string = 'error'
    try {
      const status = await page.setContent(html)
      const element = await page.$(selector)
      if (!element) {
        throw `${selector} not found on chrome_page`
      }
      return await element.screenshot({type: 'png'})
    } finally {
      chrome_page.release(page)
    }
  }

  async function cleanup() {
    await chrome_page.drain()
    await chrome_browser.close()
  }

  return {render, cleanup}
}
