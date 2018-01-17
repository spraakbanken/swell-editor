// import * as CodeMirror from "codemirror"
// import "codemirror/lib/codemirror.css"
// import "choices.js/src/styles/css/choices.min.css"

import 'lato-font/css/lato-font.min.css'

import * as csstips from 'csstips'
csstips.normalize()
csstips.setupPage('body')

import * as ReactDOM from 'react-dom'
import * as ReactiveLens from 'reactive-lens'

import * as ViewApp from './ViewApp'

const root = document.getElementById('root') as HTMLElement
const reattach = ReactiveLens.attach(vn => ReactDOM.render(vn, root), ViewApp.init, ViewApp.App)

declare const module: any
declare const require: any

if (module.hot) {
  module.hot.accept(() => {
    try {
      reattach(require('./ViewApp.tsx').App)
    } catch (e) {
      console.error(e)
    }
  })
}
