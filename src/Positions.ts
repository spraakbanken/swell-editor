
import { h } from "snabbdom"
import { VNode } from "snabbdom/vnode"
import * as Utils from "./Utils"
import * as Classes from "./Classes"

export interface Pos {
  left: number,
  top: number,
  width: number,
  height: number
}

export const hmid = (p: Pos) => p.left + p.width / 2

export const vmid = (p: Pos) => p.top + p.height / 2

export const bot = (p: Pos) => p.top + p.height

const eq_pos = (p: Pos, q: Pos) => Object.getOwnPropertyNames(p).every((i: keyof Pos) => p[i] == q[i])

export type PosDict = {
  dict: Record<string, Pos>,
  modified : boolean
}

export const init_pos_dict = () => ({modified: false, dict: {}})

const update = (id: string, d: PosDict, x: HTMLElement) => {
  const p = {
    left: x.offsetLeft,
    top: x.offsetTop,
    width: x.offsetWidth,
    height: x.offsetHeight
  }
  if (!(id in d.dict) || !eq_pos(p, d.dict[id])) {
    d.modified = true
    d.dict[id] = p
  }
}

/** Adds event handlers to the VNode that updates the position information **/
export const posid = (id: string, d: PosDict, v: VNode) => ({
  ...v,
  data: {
    ...v.data,
    hook: {
      ...(v.data || {}).hook,
      insert(vn: VNode) {
        vn.elm instanceof HTMLElement && update(id, d, vn.elm)
      },
      postpatch(_: any, vn: VNode) {
        vn.elm instanceof HTMLElement && update(id, d, vn.elm)
      }
    }
  }
})

export function relative(n1: VNode, n2: VNode, classes: string[] = []): VNode {
  return (
    h('div',
      {classes: [Classes.RelativeOuter, ...classes]},
      [ n1,
        h('div', {classes: [Classes.RelativeInner]}, [n2])
      ])
  )
}

