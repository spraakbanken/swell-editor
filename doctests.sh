#!/bin/sh

function test() {
    echo $1
    (cat src/$1.ts; typescript-doctest src/$1.ts -t) > src/$1.doctest.ts && ts-node src/$1.doctest.ts | tap-diff
}

test Graph &
time test Utils
