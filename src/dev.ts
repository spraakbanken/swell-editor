
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
