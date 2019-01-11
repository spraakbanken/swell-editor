import * as React from 'react'
import {VNode} from '../ReactUtils'

const Remarkable = require('remarkable')
const remarkable = new Remarkable({linkify: true, typographer: true, html: true})

export function md(snippets: TemplateStringsArray, ...vnodes: VNode[]): VNode {
  const init_spaces = (snippets[0].match(/^[^\n\S]*(?=\S)/m) || [''])[0]
  const drop = (s: string) =>
    s
      .split(/\n/)
      .map(line => line.slice(init_spaces.length))
      .join('\n')
  const render = (s: string) => ({__html: remarkable.render(drop(s))})
  const out = [] as VNode[]
  for (let i = 0; i < vnodes.length; i++) {
    out.push(<div key={'snip' + i} dangerouslySetInnerHTML={render(snippets[i])} />)
    out.push(vnodes[i])
  }
  if (snippets.length > vnodes.length) {
    out.push(<div key="last" dangerouslySetInnerHTML={render(snippets[vnodes.length])} />)
  }
  return <div className="md">{out}</div>
}
