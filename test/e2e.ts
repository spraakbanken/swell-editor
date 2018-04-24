import * as puppeteer from 'puppeteer'

import * as Model from '../src/Editor/Model'
import * as Utils from '../src/Utils'

import * as cp from 'child_process'
import * as fs from 'fs'

import * as chai from 'chai'
import 'mocha'

function snapshot<A>(filename: string) {
  let snaps: A[]
  let snapCursor = 0
  try {
    snaps = JSON.parse(fs.readFileSync(filename, {encoding: 'utf8'}))
  } catch {
    snaps = []
  }
  return {
    snap(m: A) {
      const stored = snaps[snapCursor]
      if (stored) {
        chai.assert.deepEqual(m, stored)
      } else {
        snaps.push(m)
      }
      snapCursor++
    },
    update() {
      fs.writeFileSync(filename, Utils.show(snaps), {encoding: 'utf8'})
    },
  }
}

async function test(): Promise<void> {
  const s = snapshot('test/e2e.json')
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', 'http://localhost:1234'],
    // headless: false,
    // slowMo: 200,
  })
  const page = (await browser.pages())[0]
  await page.setViewport({width: 1200, height: 800})
  async function snap() {
    s.snap(await page.evaluate(() => (window as any).store.omit('taxonomy').get()))
  }
  async function mod<A>(m: string, h: () => Promise<A>): Promise<A> {
    await page.keyboard.down(m)
    const r = await h()
    await page.keyboard.up(m)
    return r
  }
  await page.waitForSelector('.CodeMirror')
  await page.evaluate(() => (window as any).reset('ost kex vin . get bär .'))
  await page.click('.CodeMirror')
  await page.keyboard.press('Home')
  await page.keyboard.press('h')
  await snap()
  await mod('Control', () => page.keyboard.press('ArrowRight'))
  await page.keyboard.press('ArrowRight')
  await mod('Alt', () => page.keyboard.press('n'))
  await snap()
  await page.click('.graphView > ul > li:first-child')
  await snap()
  await page.keyboard.type('x ')
  await snap()
  await mod('Alt', async () => {
    await page.keyboard.press('n')
    await page.keyboard.press('n')
    await page.keyboard.press('n')
    await page.keyboard.press('n')
  })
  await snap()
  await mod('Alt', () => page.keyboard.press('P'))
  await snap()
  await page.keyboard.type('u ')
  await snap()
  await mod('Alt', () => page.keyboard.press('a'))
  await snap()
  await mod('Alt', () => page.keyboard.press('r'))
  await snap()
  await browser.close()
  s.update()
}

describe('e2e', () => it('e2e', test))
