import * as process from 'process'
import * as fs from 'fs'

const App = process.argv[2]

if (!App || App.includes('.') || App.includes('/')) {
  console.error('Supply one argument of the App name without path and without extension')
  console.error('You supplied:', process.argv)
  process.exit(1)
}

const index_html = `index.html`
const index_ts = `./src/index.ts`

write(
  index_html,
  `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>swell-editor ${App}</title>
        <link rel="shortcut icon" href="favicon.ico" type="image/vnd.microsoft.icon">
    </head>
    <body>
        <script type="text/javascript" src="${index_ts}"></script>
    </body>
</html>
`
)

write(
  index_ts,
  `

import * as csstips from 'csstips'
import * as ReactDOM from 'react-dom'
import * as ReactiveLens from 'reactive-lens'

import * as App from './${App}'

declare const module: {hot: {accept: Function}}

const global = (window as any) as {reattach: Function}

if (global.reattach === undefined) {
  csstips.normalize()
  csstips.setupPage('body')
  const root = document.body.appendChild(document.createElement('div'))
  global.reattach = ReactiveLens.attach(vn => ReactDOM.render(vn, root), App.init, App.App)
}

if (module.hot) {
  module.hot.accept(() => {
    global.reattach(App.App)
  })
}
`
)

console.log(index_html)

function write(filename: string, content: string) {
  fs.writeFileSync(filename, content, {encoding: 'utf8'})
}
