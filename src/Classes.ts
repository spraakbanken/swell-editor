import { style } from "typestyle"
import * as csstips from "csstips"
import { debug_name } from './dev'

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
  $nest: {
    '& .CodeMirror': {
      border: '1px solid #ddd',
      height: '300px',
      minWidth: '250px',
    }
  }
})

export const TextEditor = style(debug_name('TextEditor'), {
  $nest: {
    '& .CodeMirror': {
      fontFamily: "'Lato', sans-serif",
      fontSize: '15px'
    }
  }
})

export const CodeEditor = style(debug_name('CodeEditor'), {
  $nest: {
    '& .CodeMirror': {
      fontFamily: "'Consolas', monospace",
      fontSize: '15px'
    }
  }
})

export const Caption = style(debug_name('Caption'), {
  marginTop: '10px',
  fontStyle: 'italic',
})

export const LadderTable = style(
  debug_name('LadderTable'), {
  height: '120px',
  padding: '10px',
  width: [
    '-webkit-fit-content',
    'fit-content',
  ]
})

export const FitContent = style(
  debug_name('FitContent'), {
  width: [
    '-webkit-fit-content',
    'fit-content',
  ]
})

export const Cell = style(
  debug_name('Cell'),
  { cursor: 'pointer' },
  csstips.horizontal,
  csstips.aroundJustified,
  csstips.horizontallySpaced(5),
)

export const InnerCell = style(
  debug_name('Inner_Cell'),
  { background: 'white' },
  csstips.padding('2px', '0'),
  csstips.horizontal
)

export const BorderCell = style(
  csstips.border('1.5px #777 solid'),
  { borderRadius: '3px' },
  { fontSize: '13px' },
  { background: 'white' },
  csstips.padding('2px')
)

export const Path = style({
  stroke: "#777",
  strokeWidth: '1.5',
  fill: "none"
})

export const Selected = style({
  fontWeight: 800
})

export const Row = style(debug_name('Row'), csstips.horizontal, csstips.horizontallySpaced(5))
export const Column = style(debug_name('Column'), csstips.content, csstips.vertical, csstips.betweenJustified)

export const Pointer = style(debug_name('Pointer'),
  { cursor: 'pointer' ,
    userSelect: 'none'
  }
)

/*
export const Top = style(
  debug_name('Top'),
  {
    flexGrow: 1
  }
)

export const Mid = style(
  debug_name('Mid'),
  {
    flexGrow: 0
  }
)

export const Bot = style(
  debug_name('Bot'),
  {
    flexGrow: 1
  },
  csstips.horizontal,
  {
    $nest: {
      '&>*': csstips.selfEnd
    }
  }
)
*/
