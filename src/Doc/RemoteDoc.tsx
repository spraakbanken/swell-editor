import * as Utils from '../Utils'

export function remote_doc(url: string, show: (content: Element) => void): void {
  Utils.request(
    url,
    {method: 'GET'},
    res => {
      const doc = new DOMParser().parseFromString(res, 'text/html')
      const body = doc.querySelector('.markdown-body')
      if (!body) {
        return show(message('Could not parse remote document.'))
      }
      // Remove the "swell-project" header
      const h1 = body.querySelector('h1')
      h1 && h1.remove()
      show(body)
    },
    res => {
      console.error('Could not load', url, res)
      return show(message('Could not load remote document.'))
    }
  )
}

function message(text: string, severity: 'error' | 'warning' = 'error'): Element {
  const el = document.createElement('div')
  el.className = severity
  el.innerText = text
  return el
}
