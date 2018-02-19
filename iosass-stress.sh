function go {
    path=$1
    shift
    echo -n -e "\n$path" 1>&2
    2>/dev/null curl -G "http://localhost:3000/$path.png" --data-urlencode "$@"
}

time > pup1.png go pup 'en dag jag vaknade // En:CAP dag vaknade jag^jag:WO'
time > pup2.png go pup 'en dag jag vaknade // En:CAP dag vakmade jag^jag:WO'
time > pup3.png go pup 'en dag jag vaknade // En:cap dag vaknade jag^jag:wo'
time > pup4.png go pup 'en dag ja vaknade // En:CAP dag vaknade jag^ja:WO'
time > pup5.png go pup 'en da jag vaknade // En:CAP dag vaknade jag^jag:WO'
time > pup6.png go pup "do u:ort not:wwo dear:ort // don't^do^not you dare !:m_punc"
time > pj1.png go pj 'en dag jag vaknade // En:CAP dag vaknade jag^jag:WO'
time > pj2.png go pj 'en dag jag vaknade // En:CAP dag vakmade jag^jag:WO'
time > pj3.png go pj 'en dag jag vaknade // En:cap dag vaknade jag^jag:wo'
time > pj4.png go pj 'en dag ja vaknade // En:CAP dag vaknade jag^ja:WO'
time > pj5.png go pj 'en da jag vaknade // En:CAP dag vaknade jag^jag:WO'
time > pj6.png go pj "do u:ort not:wwo dear:ort // don't^do^not you dare !:m_punc"
