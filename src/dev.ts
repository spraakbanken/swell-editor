
declare const Debug: boolean
export let debug: boolean
if (typeof Debug != 'undefined' && Debug) {
  debug = true;
} else {
  debug = false
}

export function log (message?: any, ...args: any[]): void  {
  if (typeof Debug != 'undefined' && Debug) {
    console.log(message, ...args)
  }
}


export function debug_name(name: string): {"$debugName": string} | null {
  if (debug) {
    return {"$debugName": name}
  } else {
    return null
  }
}

export function debug_table(xs: Record<string, any>[]) {
  if (debug) {
    console.table(
      xs.map(a => objmap(a, (x: any) => {
        if (typeof x == 'number') {
          return x
        } if (typeof x == 'string') {
          return x.replace(/  /g, ' _')
        } else if (x.constructor == Array && (x.length == 0 || typeof x[0] == 'string')) {
          return x.join(',').replace(/  /g, ' _')
        } else {
          return JSON.stringify(x).replace(/  /g, ' _')
        }
      }))
    )
  }
}

if (typeof window != 'undefined') {
  (window as any).debug_table = debug_table
}

function objmap<A,B>(a: Record<string, A>, f: (a: A) => B): Record<string, B> {
  const b = {} as Record<string, B>
  Object.getOwnPropertyNames(a).map(k => b[k] = f(a[k]))
  return b
}
