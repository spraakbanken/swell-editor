import * as React from 'react'
import * as G from '../Graph'
import {Graph} from '../Graph'

import * as Utils from '../Utils'

import * as png from '../png'
import {Data, key} from '../EditorTypes'

import {style} from 'typestyle'

const ambient = style({
  ...Utils.debugName('ambient'),
  border: '0.3em dashed #0000',
  margin: '0.1em',
})

const dropping = style({
  ...Utils.debugName('dropping'),
  borderColor: '#ccc !important',
})

const dropTargetClass = (b: boolean) => ambient + ' ' + (b ? dropping : '')

export class DropZone extends React.Component<
  {
    onDrop: (g: Graph) => void
    webserviceURL?: string
    children: React.ReactNode
  },
  {drop_target: boolean}
> {
  constructor(p: any) {
    super(p)
    this.state = {drop_target: false}
  }

  _onDrop(e: React.DragEvent<HTMLDivElement>) {
    const log = (...xs: any[]) => false || console.log(...xs)
    this.setState({drop_target: false})
    e.preventDefault()
    e.stopPropagation()
    const dt = e.dataTransfer
    log(dt.files)
    log(dt.items)
    log(dt.types)
    const files = Array.from(dt.files)
    const items = Array.from(dt.items)
    log('items', dt.items.length)
    items.forEach((item, ix) => {
      log(item)
      item.getAsString(s => {
        log(item, ix, 'as string:', s)
        const m_url = s.match(/https?:[A-Za-z0-9%\-._~:\/?#@!$&'*+,;=`.]+/)
        if (this.props.webserviceURL && m_url) {
          const url = m_url[0]
          log(url, 'looks like an address')
          const query_url = this.props.webserviceURL + '/metadata.json?' + encodeURIComponent(url)
          Utils.GET(query_url, str => {
            const data = JSON.parse(str)
            log(data, 'from', url)
            this.props.onDrop(data.graph)
          })
        }
      })
      try {
        const file = item.getAsFile()
        file && files.push(file)
      } catch (e) {
        log('item not a file:', item, e)
      }
    })
    log('files', files)
    files.forEach(file => {
      log(file, file)
      const r = new FileReader()
      r.readAsArrayBuffer(file)
      r.onload = () => {
        log('readyState', r.readyState)
        if (r.readyState === 2) {
          try {
            const buf = new Buffer(r.result)
            const data = png.onBuffer.get(key, buf)
            log({data})
            this.props.onDrop(data.graph)
          } catch (e) {
            log('file not a png with meta data:', file, r.result)
          }
        }
      }
    })
    return false
  }

  _set_drop_target = Utils.debounce(50, b => {
    console.log('setting drop target', this.state, b)
    this.state.drop_target != b && this.setState({drop_target: b})
  })

  render() {
    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      this.state.drop_target || this.setState({drop_target: true})
      this._set_drop_target(true)
      return false
    }
    return (
      <div
        className={dropTargetClass(this.state.drop_target)}
        onDrop={e => this._onDrop(e)}
        onDragLeave={e => {
          console.log('drag leave')
          e.preventDefault()
          this._set_drop_target(false)
          return false
        }}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}>
        {this.props.children}
      </div>
    )
  }
}
