function capture {
    img=$1
    text=$2
    for path in pj pup; do
      echo -n -e "\n$path$img" 1>&2
      time >$path$img.png 2>/dev/null curl -G "http://localhost:3000/$path.png"  --data-urlencode "$text"
    done
}

s=0.40
sleep $s; capture 01 'Their was a problem yesteray . // There was a problem yesterday .' &
sleep $s; capture 02 'The team that hits the most runs get ice cream . // The team that hits the most runs gets ice cream .' &
sleep $s; capture 03 'Blue birds have blue and pink feathers . // Bluebirds have blue and pink feathers .' &
sleep $s; capture 04 'I don’t know his lives . // I don’t know where he^his lives .' &
sleep $s; capture 05 'He get to cleaned his son . // He got his^his son^his^son to clean the^ room^ .' &
sleep $s; capture 06 'We wrote down the number . // We wrote the number down^down .' &
sleep $s; capture 07 "do u:ort not:wwo dear:ort // don't^do^not you dare !:m_punc" &
sleep $s; capture 08 'en dag jag vaknade // En:CAP dag vaknade jag^jag:WO' &
sleep $s; capture 09 'en dag jag vaknade // En:CAP dag vakmade jag^jag:WO' &
sleep $s; capture 10 'en dag jag vaknade // En:cap dag vaknade jag^jag:wo' &
sleep $s; capture 11 'en dag ja vaknade // En:CAP dag vaknade jag^ja:WO' &
sleep $s; capture 12 'en da jag vaknade // En:CAP dag vaknade jag^jag:WO' &

