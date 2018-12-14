import * as puppeteer from 'puppeteer'

import * as pool from 'generic-pool'

export interface Renderer {
  render(html: string, selector: string, filetype?: 'png' | 'pdf'): Promise<Buffer>
  cleanup(): Promise<void>
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

  async function render(
    html: string,
    selector: string,
    filetype: 'png' | 'pdf' = 'png'
  ): Promise<Buffer> {
    const page = await chrome_page.acquire()
    let ret: Buffer | string = 'error'
    try {
      const status = await page.setContent(html)
      const element = await page.$(selector)
      if (!element) {
        throw `${selector} not found on chrome_page`
      }
      return (await filetype) == 'png' ? element.screenshot({type: 'png'}) : page.pdf()
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
