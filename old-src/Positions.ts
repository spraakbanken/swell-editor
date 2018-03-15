
import * as equals from "ramda/src/equals"
import { tag, s } from "snabbis"
import { VNode } from "snabbdom/vnode"
import * as Utils from "./Utils"
import { C } from "./Classes"
import { Store, Lens } from "reactive-lens"

export type PosDict = Record<string, Pos>

export interface Pos {
  left: number,
  top: number,
  width: number,
  height: number
}

// make these member functions?
export const hmid = (p: Pos) => p.left + p.width * 0.5

export const vmid = (p: Pos) => p.top + p.height * 0.5

export const bot = (p: Pos) => p.top + p.height

export const top = (p: Pos) => p.top

const eq_pos = (p: Pos, q: Pos) => equals(p, q)

export const init_pos_dict = () => ({modified: false, dict: {}})

const update = (pos: Store<Pos | undefined>, x: HTMLElement) => {
  const p = {
    left: x.offsetLeft,
    top: x.offsetTop,
    width: x.offsetWidth,
    height: x.offsetHeight
  }
  const now = pos.get()
  if (now === undefined || !eq_pos(p, now)) {
    pos.set(p)
  }
}

/** Adds event handlers to the VNode that updates the position information **/
export const posid = (id: string, d: Store<Record<string, Pos>>, v: VNode) => ({
  ...v,
  data: {
    ...v.data,
    hook: {
      ...(v.data || {}).hook,
      insert(vn: VNode) {
        vn.elm instanceof HTMLElement && update(d.via(Lens.key(id)), vn.elm)
      },
      postpatch(_: any, vn: VNode) {
        vn.elm instanceof HTMLElement && update(d.via(Lens.key(id)), vn.elm)
      }
    }
  }
})

export function relative(n1: VNode, n2: VNode, classes_outer: string[] = [], classes_inner: string[] = []): VNode {
  return (
    tag('div',
      C.RelativeOuter,
      s.classed(...classes_outer),
      n1,
      tag('div', C.RelativeInner, s.classed(...classes_inner), n2)
    )
  )
}

