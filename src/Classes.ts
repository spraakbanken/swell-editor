import { style, types } from "typestyle"
import * as typestyle from "typestyle"
import * as csstips from "csstips"
import { debug_name } from './dev'
import * as Utils from './Utils'
import { tag, s } from "snabbis"

export function css(...xs: types.NestedCSSProperties[]): types.NestedCSSProperties[] {
  return xs
}

const Purple = "#9637b5"
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
  ),

  LH: css({ lineHeight: '9rem' }),

  Slide: css(
    csstips.vertical,
    {
      width: '177.77rem',
      height: '100rem',
      // background: bg,
      color: fg,
      fontSize: '5rem',
      fontFamily: '"Lato", sans-serif'
    },
  ),

  Title: css(
    {fontSize: '10rem'},
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
    {fontSize: '8rem'},
    {fontFamily: '"Lato", sans-serif'},
    {textAlign: 'center'},
    {color: col1},
    csstips.padding('2rem', 0)
  ),

  Bullet: css(
    {fontSize: '5rem'},
    {
      $nest: {
        '&::before': {
          'content': `'\u25cf'`,
          fontSize: '5rem',
          paddingRight: '2rem',
          color: col2
        }
      }
    },
    csstips.padding(0, '2rem')
  ),

  Underbullet: css(
    {fontSize: '5rem'},
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

  Hidden: css({
    visibility: 'hidden',
    zIndex: -10
  }),
  Floating: css({
    position: 'absolute',
    zIndex: 10
  }),
  JustUnderFloating: css({
    visibility: 'visible',
    zIndex: 9,
  }),

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

  VSpaced: css(
    csstips.verticallySpaced('15rem')
  ),

  Vertical: css(
    csstips.vertical,
    csstips.centerJustified,
  ),

  UpMid: css({
    height: '25rem',
    justifyContent: 'space-between'
  }),

  Horizontal: css(
    csstips.horizontal,
    csstips.centerJustified,
  ),


  MainStyle: css({
    fontFamily: "'Lato', sans-serif",
    fontSize: '5rem'
  }),

  Editor: css({
    $nest:{
      '& .CodeMirror':{
        border: '0.25rem solid #ddd',
        height: '40rem',
        width: '175rem',
        // minWidth: '250px',
      }
    }
  }),

  TextEditor: css({
    $nest:{
      '& .CodeMirror':{
        fontFamily: "'Lato', sans-serif",
        fontSize: '4.5rem',
        lineHeight: '6rem',
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
    minHeight: '35rem',
    padding: '0rem',
    background: 'unset',
    fontSize: '5rem',
    width: [
      // I have forgotten why I'm using fit-content here, it doesn't seem to matter:
      '-webkit-fit-content',
      'fit-content',
    ]
  }),

  Cell: css(
    { border: '1px red solid' },
    { cursor: 'pointer' },
    csstips.horizontal,
    csstips.aroundJustified,
    csstips.horizontallySpaced(5),
  ),

  HoverMakesPurpleChildren: css({
    $nest: {
      '&:hover *': {
        transition: 'all 100ms linear',
        color: Purple,
      }
    }
  }),

  StretchSelf: css(
    csstips.flex1,
    csstips.selfStretch,
  ),

  InnerCell: css(
    { background: 'white' },
    csstips.padding('2rem', '0'),
    csstips.horizontal,
    // { border: '1px blue solid' },
    // { background: 'unset' },
    { display: 'inline-flex' },
  ),

  BorderCell: css(
    csstips.border('0.33rem #777 solid'),
    { borderRadius: '9rem' },
    { fontSize: '4rem' },
    { background: 'white' },
    csstips.padding('1rem', '1rem'),
    csstips.horizontallySpaced('2rem'),
    {
      $nest: {
        '& > span:not(:last-child)': {
          borderRight: '0.5rem solid #777',
          paddingRight: '1rem'
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
          borderRight: '0.33rem solid #eee !important'
        }
      }
    }
  ),

  LadderSelected: css(
    // { fontWeight: 'bold' }
  ),

  Path: css({
    stroke: "#777",
    strokeWidth: '0.33rem',
    fill: "none",
    zIndex: -20
  }),

  SelectedPath: css({
    stroke: Cyan,
    strokeWidth: '.5rem'
  }),

  Selected: css({
    fontWeight: 800
  }),

  CenterSelf: css(csstips.selfCenter),

  Row: css(
    csstips.horizontal,
    csstips.betweenJustified,
    // csstips.horizontallySpaced('2rem'), but with padding instead of margin:
    {
      $nest: {
        "& > *:not(:last-child)": { paddingRight: '2rem' },
      }
    }
  ),

  Column: css(
    { border: '1px blue solid' },
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
    width: "20rem",
    display: 'inline-block'
  }),

}

export const c = Utils.record_map(styles, (css, k) => style(debug_name(k), ...css))

export const C = Utils.record_map(c, cname => s.classed(cname))

