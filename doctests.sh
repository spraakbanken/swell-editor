#!/bin/sh

function test() {
    echo $1
    (cat src/$1.ts; typescript-doctest src/$1.ts -t 2>/dev/null) > src/$1.doctest.ts && ts-node src/$1.doctest.ts | faucet
}

test Token
test Graph
test Utils
test RichDiff
