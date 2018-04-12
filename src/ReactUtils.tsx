import * as R from 'ramda'
import * as React from 'react'
import {style, types} from 'typestyle'
import * as Utils from './Utils'
import {Store} from 'reactive-lens'

export type VNode = React.ReactElement<{}>

export type ThunkProps<D> = {dep: D; children: () => VNode}

export class Thunk<D> extends React.Component<ThunkProps<D>> {
  constructor(props: ThunkProps<D>) {
    super(props)
  }

  shouldComponentUpdate(nextProps: ThunkProps<D>) {
    const same = R.equals(this.props.dep, nextProps.dep)
    // same || Utils.stdout(nextProps.dep)
    return !same
  }

  render() {
    // const m = this.props.dep as any
    // console.log('rendering ', Utils.show(m.id || m))
    return this.props.children()
  }
}

export function thunk<D>(dep: D, key: string | number | undefined, child: () => VNode): VNode {
  return (
    <Thunk dep={dep} key={key}>
      {() => child()}
    </Thunk>
  )
}

export function Key(nodes: VNode[], s: string | number = ''): VNode {
  return (
    <React.Fragment key={s}>
      {nodes.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
    </React.Fragment>
  )
}

export const clean_ul = style(Utils.debugName('clean_ul'), {
  $nest: {
    '& ul, & ol': {
      padding: '0px',
    },
    '& li': {
      listStyle: 'none',
    },
  },
})

export const Unselectable = style(Utils.debugName('Unselectable'), {
  '-moz-user-select': 'none',
  '-webkit-touch-callout': 'none',
  '-webkit-user-select': 'none',
  '-ms-user-select': 'none',
  userSelect: 'none',
  cursor: 'default',
})

export function Textarea({
  store,
  onRef,
  ...props
}: {store: Store<string>} & React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    onRef?: (e: HTMLTextAreaElement) => void
  }) {
  return (
    <textarea
      {...props}
      value={store.get()}
      ref={e => onRef && e && onRef(e)}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => store.set(e.target.value)}
    />
  )
}

export function Input(store: Store<string>, tabIndex?: number) {
  return (
    <input
      value={store.get()}
      tabIndex={tabIndex}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.set(e.target.value)}
    />
  )
}

export class If extends React.Component<
  {
    children: (b: boolean, set: (b?: any) => void) => React.ReactNode
    init?: boolean
  },
  {b: boolean}
> {
  constructor(p: any) {
    super(p)
    this.state = {b: p.init === undefined ? false : p.init}
  }
  render() {
    const b = this.state.b
    return this.props.children(b, next => this.setState({b: typeof next === 'boolean' ? next : !b}))
  }
}

export function showhide(what: string, show: () => string | VNode, init = false) {
  return (
    <If init={init}>
      {(b, flip) => {
        let v
        return (
          <React.Fragment>
            <a
              style={{opacity: '0.85', justifySelf: 'end'} as any}
              className="main"
              href=""
              onClick={e => (e.preventDefault(), flip())}>
              {b ? 'hide' : 'show'} {what}
            </a>
            {b &&
              ((v = show()),
              typeof v === 'string' ? <pre className="box pre-box main">{v}</pre> : v)}
          </React.Fragment>
        )
      }}
    </If>
  )
}

export const Button = (label: string, title: string, on: () => void, enabled = true) => (
  <button title={title} key={label} onClick={on} style={{cursor: 'pointer'}} disabled={!enabled}>
    {label}
  </button>
)

export function Wrap(h: HTMLElement, k: () => void) {
  return (
    <div
      ref={el => {
        if (el) {
          while (el && el.lastChild) {
            el.removeChild(el.lastChild)
          }
          el.appendChild(h)
          k()
        }
      }}
    />
  )
}
