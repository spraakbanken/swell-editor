import { style, types } from "typestyle"
import * as typestyle from "typestyle"
import * as csstips from "csstips"
import { debug_name } from './dev'
import * as Utils from './Utils'
import { tag, s } from "snabbis"

export function css(...xs: types.NestedCSSProperties[]): types.NestedCSSProperties[] {
  return xs
}

const Cyan = "#00bcd4"
const CyanBorder = "#00a5bb"

const col1 = Cyan
const col2 = "#ff8e32"
const bg = "#fff"
const fg = "#000"

export const styles = {
  SlideRoot: css(
    csstips.horizontal,
    csstips.aroundJustified,
    { background: "#eee" },
    { lineHeight: '10rem' },
  ),

  Slide: css(
    csstips.vertical,
    {
      width: '177.77rem',
      height: '100rem',
      background: bg,
      color: fg,
      fontSize: '7rem',
      fontFamily: '"Lato", sans-serif'
    },
  ),

  Title: css(
    {fontSize: '11rem'},
    {fontFamily: '"Lato", sans-serif'},
    csstips.flex6,
    csstips.centerCenter,
    csstips.padding(0, '10rem'),
    {textAlign: 'center'},
    {color: col1}
  ),

  Subtitle: css(
    {fontSize: '6rem'},
    csstips.flex2,
    csstips.centerCenter
  ),

  Header: css(
    {fontSize: '11rem'},
    {fontFamily: '"Lato", sans-serif'},
    {textAlign: 'center'},
    {color: col1},
    csstips.padding(0, '2rem')
  ),

  Bullet: css(
    {fontSize: '7rem'},
    {
      $nest: {
        '&::before': {
          'content': `'\u25cf'`,
          fontSize: '7rem',
          paddingRight: '2rem',
          color: col2
        }
      }
    },
    csstips.padding(0, '2rem')
  ),

  Underbullet: css(
    {fontSize: '7rem'},
    {
      $nest: {
        '&::before': {
          'content': `'\u25cf'`,
          fontSize: '6rem',
          paddingRight: '2rem',
          color: col2
        }
      }
    },
    csstips.padding(0, '9rem')
  ),

  Smallbullet: css(
    {fontSize: '6rem'},
    {
      $nest: {
        '&::before': {
          'content': `'\u25cf'`,
          fontSize: '4rem',
          paddingRight: '2rem',
          color: col2
        }
      }
    },
    csstips.padding(0, '2rem')
  ),

  LineThrough: css({
    textDecoration: 'line-through',
  }),


  // normal

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

  DropdownZIndexFix: css({
    $nest: {
      "& .choices__list--dropdown": { zIndex: 1000 },
    }
  }),

  SideBySide: css(
    csstips.horizontal,
    csstips.horizontallySpaced('5px'),{
      $nest:{
        "& > *": csstips.flex
      }
    }),

  SideBySideToTheLeft: css(
    csstips.horizontal,
    csstips.horizontallySpaced('5px'),
    {
      $nest:{
        "& > *": csstips.selfStart
      }
    },
    {
      $nest:{
        "& > *": csstips.flex
      }
    }
    ),

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
    minHeight: '140px',
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
    csstips.border('1px #777 solid'),
    { borderRadius: '20px' },
    { fontSize: '13px' },
    { background: 'white' },
    csstips.padding('4px', '4px'),
    csstips.horizontallySpaced('5px'),
    {
      $nest: {
        '& > span:not(:last-child)': {
          borderRight: '1px solid #777',
          paddingRight: '1px'
        }
      }
    }
  ),

  SelectedBorderCell: css(
    { borderColor: CyanBorder },
    { background: Cyan },
    { color: 'white' },
    // { fontWeight: 'bold' }
    {
      $nest: {
        '& > span:not(:last-child)': {
          borderRight: '1px solid #eee !important'
        }
      }
    }
  ),

  LadderSelected: css(
    // { fontWeight: 'bold' }
  ),

  Path: css({
    stroke: "#777",
    strokeWidth: '1.5',
    fill: "none"
  }),

  SelectedPath: css({
    stroke: Cyan,
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
  }),

  TaxonomyCodeInDropdown: css({
    width: "100px",
    display: 'inline-block'
  }),

}

export const c = Utils.record_map(styles, (css, k) => style(debug_name(k), ...css))

export const C = Utils.record_map(c, cname => s.classed(cname))

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
