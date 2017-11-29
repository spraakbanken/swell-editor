import * as App from "./App"
import * as snabbis from "snabbis"
import { Model } from "./App"
import * as CodeMirror from "codemirror"
import * as csstips from "csstips"
import "codemirror/lib/codemirror.css"
import "lato-font/css/lato-font.min.css"
import "./choices.css"
import {debug} from './dev'
csstips.normalize()
csstips.setupPage('body')

const root = document.getElementsByTagName('body')[0] as HTMLElement
const reattach = snabbis.attach(root, Model.init(''), App.App)

declare const module: any;
declare const require: any;

if (debug) {
  if (module.hot) {
    module.hot.accept('./App.ts', () => {
      try {
        const NextApp = require('./App.ts')
        reattach(NextApp.App)
      } catch (e) {
        console.error(e)
      }
    })
  }
}

