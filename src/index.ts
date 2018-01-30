// import * as CodeMirror from "codemirror"
// import "codemirror/lib/codemirror.css"
// import "choices.js/src/styles/css/choices.min.css"
// import 'lato-font/css/lato-font.min.css'

import * as csstips from 'csstips'
import * as ReactDOM from 'react-dom'
import * as ReactiveLens from 'reactive-lens'

import * as VApp from './ViewApp'
import * as App from './Slides'

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
