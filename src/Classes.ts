import {VNode, VNodeData} from 'snabbdom/vnode'
import {style} from "typestyle"
import * as csstips from "csstips"
import { debug_name } from './dev'

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

export const Insert = style(debug_name('Insert'), {
  color: '#090',
})

export const Delete = style(debug_name('Delete'), {
  color: '#d00',
  textDecoration: 'line-through',
})

export const Dragged = style(debug_name('Dragged'), {
  backgroundColor: '#87ceeb',
  textDecoration: 'line-through',
})

export const Dropped = style(debug_name('Dropped'), {
  backgroundColor: '#87ceeb',
})

export const Subscript = style(debug_name('Subscript'), {
  position: 'relative',
  bottom: '-0.5em',
  fontSize: '65%',
  paddingLeft: '1px',
})

export const Width100Pct = style(debug_name('Width100Pct'), {
  width: '100%',
})

export const RelativeOuter = style(debug_name('RelativeOuter'), {
  position: 'relative',
  overflowX: 'hidden',
  overflowY: 'hidden',
})

export const RelativeInner = style(debug_name('RelativeInner'), {
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
})

export const Below = style(debug_name('Below'), {
  zIndex: -1
})

export const SideBySide = style(debug_name('SideBySide'),
  csstips.horizontal,
  csstips.horizontallySpaced('5px'), {
    $nest: {
      "& > *": csstips.flex
    }
  })

export const FlushRight = style(debug_name('FlushRight'),
  csstips.selfEnd
)

export const Vertical = style(debug_name('Vertical'),
  csstips.vertical
)

export const MainStyle = style(debug_name('MainStyle'), {
  fontFamily: "'Lato', sans-serif",
  fontSize: '15px'
})

export const Editor = style(debug_name('Editor'), {
  border: '1px solid #ddd',
  height: '300px',
  minWidth: '250px',
})

export const TextEditor = style(debug_name('TextEditor'), {
  fontFamily: "'Lato', sans-serif",
  fontSize: '15px'
})

export const CodeEditor = style(debug_name('CodeEditor'), {
  fontFamily: "'Consolas', monospace",
  fontSize: '15px'
})

export const Caption = style(debug_name('Caption'), {
  marginTop: '10px',
  fontStyle: 'italic',
})
