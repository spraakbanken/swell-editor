import "codemirror/lib/codemirror.css"
import * as CodeMirror from "codemirror"
import "codemirror/mode/xml/xml"
import './index.css'
import {debug} from './dev'
import * as csstips from "csstips"
import * as AppTypes from "./AppTypes"
import * as App from "./App"
csstips.normalize()
csstips.setupPage('#top')

const root = document.getElementById('root') as HTMLElement

const hash_text = decodeURIComponent(window.location.hash.slice(1))

const example_text = hash_text || "Jag bor på legenhet . Jag där bott ett år . Jag skulle vilja ha stor huset ."

// || "En dag jag vaknade när larmet på min telefon ringde. De väder var inte fint."

let App_bind = App.bind

const init = AppTypes.init_app(example_text)

let get = App_bind(root, init)

window.onhashchange = () => {
  // could retain history, but we reinitialize the data here
  get = App_bind(root, AppTypes.init_app(window.location.hash.slice(1)))
}

declare const module: any;

if (debug) {
  if (module.hot) {
    module.hot.accept(['./App.ts', './AppTypes.ts'], (_: any) => {
      try {
        App_bind = require('./App.ts').bind
        get = App_bind(root, get())
      } catch (e) {
        console.error(e)
      }
    })
  }
}
