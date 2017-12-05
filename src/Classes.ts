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

export const styles = {
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
    csstips.verticallySpaced('35px')
  ),

  Vertical: css(
    csstips.vertical,
    csstips.centerJustified,
  ),

  Horizontal: css(
    csstips.horizontal,
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
    // { border: '1px blue solid' },
    { background: 'unset' },
    csstips.padding('2px', '0'),
    csstips.horizontal,
    { display: 'inline-flex' },
  ),

  BorderCell: css(
    csstips.border('1px #777 solid'),
    { background: 'white' },
    { borderRadius: '20px' },
    { fontSize: '13px' },
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
    fill: "none",
    zIndex: -20
  }),

  SelectedPath: css({
    stroke: Cyan,
    strokeWidth: '2.5'
  }),

  Selected: css({
    fontWeight: 800
  }),

  CenterSelf: css(csstips.selfCenter),

  Row: css(
    csstips.horizontal,
    csstips.betweenJustified,
    // csstips.horizontallySpaced(5), but with padding instead of margin:
    {
      $nest: {
        "& > *:not(:last-child)": { paddingRight: '5px' },
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
    width: "100px",
    display: 'inline-block'
  }),

}

export const c = Utils.record_map(styles, (css, k) => style(debug_name(k), ...css))

export const C = Utils.record_map(c, cname => s.classed(cname))

