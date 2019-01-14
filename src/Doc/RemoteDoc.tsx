import {VNode} from '../ReactUtils'
import * as Utils from '../Utils'

function remote_doc(url: string): VNode {
  Utils.GET(url, res => {})
}
