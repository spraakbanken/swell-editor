import { style, types } from "typestyle"
import * as typestyle from "typestyle"
import * as csstips from "csstips"
import { debug_name } from './dev'
import * as Utils from './Utils'
import { tag, Content as S } from "snabbis"

export function css(...xs: types.NestedCSSProperties[]): types.NestedCSSProperties[] {
  return xs
}

export const styles = {
  PadButtons: css({
    $nest: {
      "& > button": { marginRight: '4px', marginBottom: '4px' },
      "& > select": { marginRight: '4px', marginBottom: '4px' }
    }
  }),
  Insert: css({
    color: '#090',
  }),

  Delete: css({
    color: '#d00',
    textDecoration: 'line-through',
  }),

  Dragged: css({
    backgroundColor: '#87ceeb',
    textDecoration: 'line-through',
  }),

  Dropped: css({
    backgroundColor: '#87ceeb',
  }),

  Subscript: css({
    position: 'relative',
    bottom: '-0.5em',
    fontSize: '65%',
    paddingLeft: '1px',
  }),

  Width100Pct: css({
    width: '100%',
  }),

  RelativeOuter: css({
    position: 'relative',
    overflowX: 'hidden',
    overflowY: 'hidden',
  }),

  RelativeInner: css({
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
  }),

  Below: css({
    zIndex: -1
  }),

  SideBySide: css(
    csstips.horizontal,
    csstips.horizontallySpaced('5px'),{
      $nest:{
        "& > *": csstips.flex
      }
    }),

  HSpaced: css(
    csstips.horizontallySpaced('5px')
  ),

  InlineBlock: css({
    display: 'inline-block'
  }),

  FlushRight: css(
    csstips.selfEnd
  ),

  Vertical: css(
    csstips.vertical,
    csstips.centerJustified,
  ),

  MainStyle: css({
    fontFamily: "'Lato', sans-serif",
    fontSize: '15px'
  }),

  Editor: css({
    $nest:{
      '& .CodeMirror':{
        border: '1px solid #ddd',
        height: '300px',
        minWidth: '250px',
        lineHeight: '1.5em',
      }
    }
  }),

  TextEditor: css({
    $nest:{
      '& .CodeMirror':{
        fontFamily: "'Lato', sans-serif",
        fontSize: '15px'
      }
    }
  }),

  CodeEditor: css({
    $nest:{
      '& .CodeMirror':{
        fontFamily: "'Consolas', monospace",
        fontSize: '15px'
      }
    }
  }),

  Caption: css({
    marginTop: '10px',
    fontStyle: 'italic',
  }),

  LadderTable: css({
    minHeight: '120px',
    padding: '10px',
    width: [
      // I have forgotten why I'm using fit-content here, it doesn't seem to matter:
      '-webkit-fit-content',
      'fit-content',
    ]
  }),

  Cell: css(
    { cursor: 'pointer' },
    csstips.horizontal,
    csstips.aroundJustified,
    csstips.horizontallySpaced(5),
  ),

  InnerCell: css(
    { background: 'white' },
    csstips.padding('2px', '0'),
    csstips.horizontal
  ),

  BorderCell: css(
    csstips.border('1.5px #777 solid'),
    { borderRadius: '3px' },
    { fontSize: '13px' },
    { background: 'white' },
    csstips.padding('2px')
  ),

  LadderSelected: css({
    borderColor: 'blue',
    fontWeight: 'bold'
  }),

  Path: css({
    stroke: "#777",
    strokeWidth: '1.5',
    fill: "none"
  }),

  SelectedPath: css({
    stroke: 'blue',
    strokeWidth: '2.5'
  }),

  Selected: css({
    fontWeight: 800
  }),

  Row: css(
    csstips.horizontal,
    csstips.horizontallySpaced(5)
  ),

  Column: css(
    csstips.content,
    csstips.vertical,
    csstips.betweenJustified
  ),

  Pointer: css({
    cursor: 'pointer' ,
    userSelect: 'none'
  }),

  Unselectable: css({
    '-ms-user-select': 'none',
    '-webkit-user-select': 'none',
    '-moz-user-select': 'none',
    userSelect: 'none'
  }),

  Cut: css({
    paddingTop: '1px',
    paddingBottom: '1px',
    marginLeft: '-1px',
    marginRight: '-1px',
    border: '1px dotted #666',
    background: '#d7d4f0',
  })
}

export const c = Utils.record_map(styles, (css, k) => style(debug_name(k), ...css))

export const C = Utils.record_map(c, cname => S.classed(cname))

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
