import * as React from 'react'

import {enzyme} from './Common'

import {Dropdown} from '../src/Editor/LabelSidekick'

import 'mocha'
import * as chai from 'chai'

describe('Dropdown', () => {
  const taxonomy = [
    {
      group: 'g',
      entries: [{label: 'a', desc: ''}, {label: 'ab', desc: ''}, {label: 'abc', desc: ''}],
    },
    {
      group: 'h',
      entries: [{label: 'x', desc: ''}, {label: 'xy', desc: ''}, {label: 'xyz', desc: ''}],
    },
  ]

  it('cycles on arrow down', () => {
    const dom = enzyme.shallow(
      <Dropdown mode="anonymization" taxonomy={taxonomy} selected={[]} onChange={() => void 0} />
    )
    for (let i = 0; i < 6; i++) {
      chai.assert.equal(dom.state().cursor, i)
      dom.find('input').simulate('keydown', {key: 'ArrowDown', preventDefault() {}})
      chai.assert.equal(dom.state().cursor, (i + 1) % 6)
    }
  })

  it('cycles on arrow up', () => {
    const dom = enzyme.shallow(
      <Dropdown mode="anonymization" taxonomy={taxonomy} selected={[]} onChange={() => void 0} />
    )
    for (let i = 5; i >= 0; i--) {
      chai.assert.equal(dom.state().cursor, (i + 1) % 6)
      dom.find('input').simulate('keydown', {key: 'ArrowUp', preventDefault() {}})
      chai.assert.equal(dom.state().cursor, i)
    }
  })

  it('calls onChange', () => {
    let called: any[] = []
    let times = 0
    const dom = enzyme.shallow(
      <Dropdown
        mode="anonymization"
        taxonomy={taxonomy}
        selected={[]}
        onChange={(...args: any[]) => ((called = args), ++times)}
      />
    )
    chai.assert.deepEqual(called, [])
    chai.assert.equal(times, 0)
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['a', true])
    chai.assert.equal(times, 1)
    dom.find('input').simulate('keydown', {key: ' ', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['a', true])
    chai.assert.equal(times, 2)
    dom.setProps({selected: ['a']})
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['a', false])
    chai.assert.equal(times, 3)
    dom.find('input').simulate('keydown', {key: ' ', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['a', false])
    chai.assert.equal(times, 4)
    dom
      .find('input')
      .simulate('keydown', {key: 'Backspace', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['a', false])
    chai.assert.equal(times, 5)
    chai.assert.equal(dom.state().cursor, 0)
    dom.find('input').simulate('keydown', {key: 'ArrowDown', preventDefault() {}})
    chai.assert.equal(dom.state().cursor, 1)
    dom
      .find('input')
      .simulate('keydown', {key: 'Backspace', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['a', false])
    chai.assert.equal(times, 6)
  })

  it('skips directly to search hits', () => {
    let called: any[] = []
    let times = 0
    const dom = enzyme.shallow(
      <Dropdown
        mode="anonymization"  
        taxonomy={taxonomy}
        selected={[]}
        onChange={(...args: any[]) => ((called = args), ++times)}
      />
    )
    chai.assert.deepEqual(called, [])
    chai.assert.equal(times, 0)
    dom.find('input').simulate('keydown', {key: 'y', target: {value: ''}, preventDefault() {}})
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['xy', true])
    chai.assert.equal(times, 1)
    dom.find('input').simulate('keydown', {key: 'z', target: {value: 'y'}, preventDefault() {}})
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['xyz', true])
    chai.assert.equal(times, 2)
    dom.find('input').simulate('keydown', {key: 'w', target: {value: 'yz'}, preventDefault() {}})
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['xyz', true])
    chai.assert.equal(times, 3)
  })

  it('tabs between hits', () => {
    let called: any[] = []
    let times = 0
    const dom = enzyme.shallow(
      <Dropdown
        mode="anonymization"
        taxonomy={taxonomy}
        selected={[]}
        onChange={(...args: any[]) => ((called = args), ++times)}
      />
    )
    chai.assert.deepEqual(called, [])
    chai.assert.equal(times, 0)
    dom.find('input').simulate('keydown', {key: 'b', target: {value: ''}, preventDefault() {}})
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: 'b'}, preventDefault() {}})
    chai.assert.deepEqual(called, ['ab', true])
    chai.assert.equal(times, 1)
    dom.find('input').simulate('keydown', {key: 'Tab', target: {value: 'b'}, preventDefault() {}})
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: 'b'}, preventDefault() {}})
    chai.assert.deepEqual(called, ['abc', true])
    chai.assert.equal(times, 2)
    dom.find('input').simulate('keydown', {key: 'Tab', target: {value: 'b'}, preventDefault() {}})
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: 'b'}, preventDefault() {}})
    chai.assert.deepEqual(called, ['ab', true])
    chai.assert.equal(times, 3)
  })

  it('allows moving cursor by mouse over', () => {
    let called: any[] = []
    let times = 0
    const dom = enzyme.shallow(
      <Dropdown
        mode="anonymization"
        taxonomy={taxonomy}
        selected={[]}
        onChange={(...args: any[]) => ((called = args), ++times)}
      />
    )
    chai.assert.deepEqual(called, [])
    chai.assert.equal(times, 0)
    dom
      .find('span')
      .filterWhere(d => d.text() == 'xy')
      .simulate('mouseOver')
    dom.find('input').simulate('keydown', {key: 'Enter', target: {value: ''}, preventDefault() {}})
    chai.assert.deepEqual(called, ['xy', true])
    chai.assert.equal(times, 1)
  })

  it('allows toggling by mouse clicking', () => {
    let called: any[] = []
    let times = 0
    const dom = enzyme.shallow(
      <Dropdown
        mode="anonymization"
        taxonomy={taxonomy}
        selected={[]}
        onChange={(...args: any[]) => ((called = args), ++times)}
      />
    )
    chai.assert.deepEqual(called, [])
    chai.assert.equal(times, 0)
    dom
      .find('span')
      .filterWhere(d => d.text() == 'xy')
      .simulate('mouseDown', {preventDefault() {}})
    chai.assert.deepEqual(called, ['xy', true])
    chai.assert.equal(times, 1)
    dom.setProps({selected: ['xy']})
    dom
      .find('span')
      .filterWhere(d => d.text() == 'xy')
      .simulate('mouseDown', {preventDefault() {}})
    chai.assert.deepEqual(called, ['xy', false])
    chai.assert.equal(times, 2)
  })
})
