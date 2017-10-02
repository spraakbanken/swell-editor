import {VNode, VNodeData} from 'snabbdom/vnode'
import {style} from "typestyle"

declare module "snabbdom/vnode" {
  export interface VNodeData {
    classes?: string[]
  }
}

function update_classes(old_vnode: VNode, vnode: VNode) {
  const elm: Element = vnode.elm as Element
  const old_classes = (old_vnode.data as VNodeData).classes || []
  const classes = (vnode.data as VNodeData).classes || []

  if (old_classes === classes) return;

  const now = {} as Record<string, boolean>
  for (let name of classes) {
    now[name] = true
  }

  const old = {} as Record<string, boolean>
  for (let name of old_classes) {
    if (!now[name] && name) {
      elm.classList.remove(name);
    }
    old[name] = true
  }

  for (let name of classes) {
    if (!(name in old) && name) {
      (elm.classList as any).add(name)
    }
  }
}

export const classes_module = {create: update_classes, update: update_classes}

export const Insert = style({
  color: '#090',
})

export const Delete = style({
  color: '#d00',
  textDecoration: 'line-through',
})

export const Dragged = style({
  backgroundColor: '#87ceeb',
  textDecoration: 'line-through',
})

export const Dropped = style({
  backgroundColor: '#87ceeb',
})

export const Subscript = style({
  position: 'relative',
  bottom: '-0.5em',
  fontSize: '65%',
  paddingLeft: '1px',
})

export const Width100Pct = style({
  width: '100%',
})

export const RelativeOuter = style({
  position: 'relative',
  overflow: 'overlay' as any,
  overflowY: 'hidden',
})

export const RelativeInner = style({
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
})

export const Below = style({
  zIndex: -1
})



