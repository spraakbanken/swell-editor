img=1
function capture {
    text=$1
    img=$(($img + 1))
    for path in pj pup; do
      echo -n -e "\n$path" 1>&2
      time >$path$img.png 2>/dev/null curl -G "http://localhost:3000/$path.png"  --data-urlencode "$text"
    done
}

capture 'Their was a problem yesteray . // There was a problem yesterday .'
capture 'The team that hits the most runs get ice cream . // The team that hits the most runs gets ice cream .'
capture 'Blue birds have blue and pink feathers . // Bluebirds have blue and pink feathers .'
capture 'I don’t know his lives . // I don’t know where he^his lives .'
capture 'He get to cleaned his son . // He got his^his son^his^son to clean the^ room^ .'
capture 'We wrote down the number . // We wrote the number down^down .'
capture "do u:ort not:wwo dear:ort // don't^do^not you dare !:m_punc"
capture 'en dag jag vaknade // En:CAP dag vaknade jag^jag:WO'
capture 'en dag jag vaknade // En:CAP dag vakmade jag^jag:WO'
capture 'en dag jag vaknade // En:cap dag vaknade jag^jag:wo'
capture 'en dag ja vaknade // En:CAP dag vaknade jag^ja:WO'
capture 'en da jag vaknade // En:CAP dag vaknade jag^jag:WO'

