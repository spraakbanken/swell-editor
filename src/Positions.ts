
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
    //console.log('updating', id, 'to', Utils.show(p))
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
      insert: (vn: VNode) => vn.elm instanceof HTMLElement && update(id, d, vn.elm),
      postpatch: (_: any, vn: VNode) => vn.elm instanceof HTMLElement && update(id, d, vn.elm)
    }
  }
})

function span<A>(xs: A[], p: (x: A) => boolean): [A[], A[]] {
  for (let i = 0; i < xs.length; i++) {
    if (!p(xs[i])) {
      return [xs.slice(0, i), xs.slice(i)]
    }
  }
  return [xs, []]
}

function span_end<A>(xs: A[], p: (x: A) => boolean): [A[], A[]] {
  for (let i = xs.length - 1; i >= 0; i--) {
    if (!p(xs[i])) {
      return [xs.slice(0, i+1), xs.slice(i+1)]
    }
  }
  return [[], xs]
}

function trim<A>(xs: A[], p: (x: A) => boolean): [A[], A[], A[]] {
  const [p_init, ys] = span(xs, p)
  const [not_p, p_tail] = span_end(ys, p)
  return [p_init, not_p, p_tail]
}

export function posid_ignore_child(id: string, d: PosDict, v: VNode, ignore_class: string): VNode {
  const ignore = (n: VNode | string) => {
    if (typeof n === 'string') {
      return n.trim() == ''
    } else if (n.data && n.data.class && n.data.class[ignore_class]) {
      return true
    } else if (n.text != null && n.text.trim() == '') {
      return true
    }
    return false
  }
  if (v.children && v.children.length >= 2) {
    const [ignore_init, ok, ignore_tail] = trim(v.children, ignore)
    if (ignore_init.length + ignore_tail.length >= 1 && ok.length >= 1) {
      return {
        ...v,
        children: [...ignore_init, posid(id, d, h('span', ok)), ...ignore_tail]
      }
    }
  }
  return posid(id, d, v)
}

export function relative(n1: VNode, n2: VNode, classes: string[] = []): VNode {
  return (
    h('div',
      {classes: [Classes.RelativeOuter, ...classes]},
      [ n1,
        h('div', {classes: [Classes.RelativeInner]}, [n2])
      ])
  )
}

