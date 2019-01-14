import * as React from 'react'
import {VNode} from '../ReactUtils'
import * as Utils from '../Utils'

// TODO: Cache docs
export function remote_doc(url: string, show: (content: VNode) => void): void {
  Utils.request(
    url,
    {method: 'GET'},
    res => {
      const doc = new DOMParser().parseFromString(res, 'text/html')
      const body = doc.querySelector('.markdown-body')
      if (!body) {
        return show(message('Could not parse remote document'))
      }
      // Remove the "swell-project" header
      const h1 = body && body.querySelector('h1')
      h1 && h1.remove()
      show(<div dangerouslySetInnerHTML={{__html: body.innerHTML}} />)
    },
    res => {
      console.error('Could not load', url, res)
      return show(message('Could not load remote document'))
    }
  )
}

function message(text: string, severity: 'error' | 'warning' = 'error'): VNode {
  return <div className={severity}>{text}</div>
}
