#!/bin/sh

function test() {
    echo $1
    (cat src/$1.ts; typescript-doctest src/$1.ts -t) > src/$1.doctest.ts && ts-node src/$1.doctest.ts | faucet
}

test Utils &
test Graph
