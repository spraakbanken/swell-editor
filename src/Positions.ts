
import { h } from "snabbdom"
import { VNode } from "snabbdom/vnode"

export interface Pos {
  left: number,
  top: number,
  width: number,
  height: number
}

const eq_pos = (p: Pos, q: Pos) => Object.getOwnPropertyNames(p).every((i: keyof Pos) => p[i] == q[i])

export type PosDict = {
  dict: Record<string, Pos>,
  modified : boolean
}

export const init_pos_dict = () => ({modified: false, dict: {}})

const update = (id: string, d: PosDict, x: HTMLElement) => {
  console.log({x: x})
  const p = {
    left: x.offsetLeft,
    top: x.offsetTop,
    width: x.offsetWidth,
    height: x.offsetHeight
  }
  if (!(id in d.dict) || !eq_pos(p, d.dict[id])) {
    d.modified = true;
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

export function relative(n1: VNode, n2: VNode): VNode {
  return (
    h('div',
      {style: {position: 'relative'}},
      [ n1,
        h('div', {style: {position: 'absolute', top: '0', left: '0', width: '100%', height: '100%'}}, [n2])
      ])
  )
}

