interface Chunk {
  name: string
  data: ArrayLike<any>
}

type Chunks = Chunk[]

interface Extract {
  (b: Buffer | Uint8Array): Chunks
}

interface Encode {
  (chunks: Chunks): Uint8Array
}

const tEXt = 'tEXt'

interface Text {
  encode(key: string, value: string): Chunk & {name: typeof tEXt}
  decode(data: ArrayLike<any>): {keyword: string; text: string}
}

const extract: Extract = require('png-chunks-extract')
const encode: Encode = require('png-chunks-encode')
const text: Text = require('png-chunk-text')

import * as path from 'path'
import * as fs from 'fs'

export const onBuffer = {
  set(key: string, data: any, png_buffer: Buffer): Buffer {
    const chunks = extract(png_buffer).filter(
      chunk => chunk.name != tEXt || text.decode(chunk.data).keyword != key
    )

    // Add new chunk before the IEND chunk
    chunks.splice(-1, 0, text.encode(key, JSON.stringify(data)))

    return new Buffer(encode(chunks))
  },

  get(key: string, png_buffer: Buffer): any | undefined {
    const chunks = extract(png_buffer)
    for (const chunk of chunks) {
      if (chunk.name === tEXt) {
        try {
          const kv = text.decode(chunk.data)
          if (kv.keyword === key) {
            return JSON.parse(kv.text)
          }
        } catch (e) {}
      }
    }
    return undefined
  },
}

export const onFile = {
  set(key: string, data: any, infile: string, outfile: string): void {
    fs.writeFileSync(outfile, onBuffer.set(key, data, fs.readFileSync(infile)))
  },
  get(key: string, infile: string): void {
    console.log(onBuffer.get(key, fs.readFileSync(infile)))
  },
}
