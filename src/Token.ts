import * as Utils from './Utils'

export interface Text {
  readonly text: string
}

export interface Token extends Text {
  readonly id: string
}

export function Token(text: string, id: string): Token {
  return {id, text}
}

export function token(t: Token): Token {
  return Token(t.text, t.id)
}

/** The text in some tokens

  text(identify(tokenize('apa bepa cepa '), '#')) // => 'apa bepa cepa '

*/
export function text(ts: Text[]): string {
  return texts(ts).join('')
}

/** The texts in some tokens

  texts(identify(tokenize('apa bepa cepa '), '#')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function texts(ts: Text[]): string[] {
  return ts.map(t => t.text)
}

/** Is this a token of punctation?

  punc('. ')   // => true
  punc('... ') // => true
  punc(' !')   // => true
  punc('!?')   // => true
  punc(', ')    // => false
  punc('apa. ') // => true
  punc('?.., ') // => false

*/
export function punc(s: string): boolean {
  return (
    !!s.match(/^\s*[.!?]+\s*$/) || (!!s.match(/\.\s*$/) && !s.match(/^t\./)) || !!s.match(/^\.\s/)
  )
}

/** Where is the previous punctuation token?

  const s = tokenize('apa bepa . Cepa depa')
  prev_punc(s, 1) // => -1
  prev_punc(s, 2) // => 2
  prev_punc(s, 3) // => 2

*/
export function prev_punc(tokens: string[], i: number): number {
  for (let j = i; j >= 0; --j) {
    if (punc(tokens[j])) {
      return j
    }
  }
  return -1
}

/** Where is the next punctuation token?

  const s = tokenize('apa bepa . Cepa depa')
  next_punc(s, 1) // => 2
  next_punc(s, 2) // => 2
  next_punc(s, 3) // => -1

*/
export function next_punc(tokens: string[], i: number): number {
  for (let j = i; j < tokens.length; ++j) {
    if (punc(tokens[j])) {
      return j
    }
  }
  return -1
}

export type Span = {begin: number; end: number}

/** Merge two spans: makes a span that contains both spans

  span_merge({begin: 1, end: 2}, {begin: 3, end: 4}) // => {begin: 1, end: 4}
  span_merge({begin: 2, end: 4}, {begin: 1, end: 3}) // => {begin: 1, end: 4}

*/
export function span_merge(s1: Span, s2: Span): Span {
  return {begin: Math.min(s1.begin, s2.begin), end: Math.max(s1.end, s2.end)}
}

/** Is this index within the span?

  span_within(0, {begin: 1, end: 2}) // => false
  span_within(1, {begin: 1, end: 2}) // => true
  span_within(2, {begin: 1, end: 2}) // => true
  span_within(3, {begin: 1, end: 2}) // => false

*/
export function span_within(i: number, s: Span): boolean {
  return s.begin <= i && i <= s.end
}

/** Gets the sentence around some offset in a string of tokens

  const s = tokenize('apa bepa . Cepa depa . epa')
  sentence(s, 0) // => {begin: 0, end: 2}
  sentence(s, 1) // => {begin: 0, end: 2}
  sentence(s, 2) // => {begin: 0, end: 2}
  sentence(s, 3) // => {begin: 3, end: 5}
  sentence(s, 4) // => {begin: 3, end: 5}
  sentence(s, 5) // => {begin: 3, end: 5}
  sentence(s, 6) // => {begin: 6, end: 6}

*/
export function sentence(tokens: string[], i: number): Span {
  const begin = prev_punc(tokens, i - 1) + 1
  let end = next_punc(tokens, i)
  if (end == -1) {
    end = tokens.length - 1
  }
  return {begin, end}
}

/** Tokenizes text on whitespace, prefers to have trailing whitespace

  tokenize('') // => []
  tokenize('    ') // => []
  tokenize('apa bepa cepa') // => ['apa ', 'bepa ', 'cepa']
  tokenize('  apa bepa cepa') // => ['  apa ', 'bepa ', 'cepa']
  tokenize('  apa bepa cepa  ') // => ['  apa ', 'bepa ', 'cepa  ']

*/
export function tokenize(s: string): string[] {
  return s.match(/\s*\S+\s*/g) || []
}

/** Tokenizes text on whitespace, prefers to have trailing whitespace

  identify(['apa', 'bepa'], '#') // => [{text: 'apa', id: '#0'}, {text: 'bepa', id: '#1'}]

*/
export function identify(toks: string[], prefix: string): Token[] {
  return toks.map((text, i) => Token(text, prefix + i))
}

/** The offset in the text at an index. */
export function text_offset(texts: string[], index: number): number {
  return texts.slice(0, index).reduce((x, s: string) => x + s.length, 0)
}

/**

  const abc = ['012', '3456', '789']
  token_at(abc, 0) // => {token: 0, offset: 0}
  token_at(abc, 2) // => {token: 0, offset: 2}
  token_at(abc, 3) // => {token: 1, offset: 0}
  token_at(abc, 6) // => {token: 1, offset: 3}
  token_at(abc, 7) // => {token: 2, offset: 0}
  token_at(abc, 9) // => {token: 2, offset: 2}
  Utils.throws(() => token_at(abc, 10)) // => true

*/
export function token_at(
  tokens: string[],
  character_offset: number
): {token: number; offset: number} {
  let passed = 0
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i].length
    passed += w
    if (passed > character_offset) {
      return {token: i, offset: character_offset - passed + w}
    }
  }
  return Utils.raise('Out of bounds: ' + JSON.stringify({tokens, character_offset}))
}
