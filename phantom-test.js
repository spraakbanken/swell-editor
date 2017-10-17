var webPage = require('webpage');

var page = webPage.create();

page.onConsoleMessage = function(msg) {
//  console.log(msg);
}

function Render(filename, view, example, k) {
  console.log('view:', view, 'filename:', filename)
  page.viewportSize = { width: 1100, height: 800 }
  page.open("http://localhost:8080#ingenting", function start(status) {
    size = page.evaluate(function(view, spans, tokens) {
      if (spans && tokens) {
        window.set_state(spans, tokens)
      }
      function m(xs) {
        var out = []
        for (var i=0; i < xs.length; i++) {
          var nearest = xs[i].nearestViewportElement
          out.push(nearest, nearest ? nearest.parent : 'no parent')
        }
        return out.length + ' ' + out.join(',')
      }
      //console.log('paths:', m(document.getElementsByTagName('path')));
      //console.log('svg:', m(document.getElementsByTagName('svg')));
      var root = document.getElementById('root')
      var body = document.getElementsByTagName('body')[0]
      var ladder = body.getElementsByClassName('LadderRoot')[0]
      body.innerHTML = ''
      body.style.background = '#ffffff'
      if (view == 'root') {
        body.appendChild(root)
      } else if (view == 'ladder' || view == 'ladder_black') {
        body.appendChild(ladder)
      } else {
        throw 'view not root nor ladder'
      }
      var cms = root.getElementsByClassName('CodeMirror')
      for (var x = 0; x < cms.length; x++) {
        cms[x].style.height = '180px'
      }
      root.getElementsByClassName('cm_main')[0].click()
      var table = ladder.firstChild
      //console.log('paths:', m(document.getElementsByTagName('path')));
      //console.log('svg:', m(document.getElementsByTagName('svg')));
      if (view == 'ladder_black') {
        var head = document.getElementsByTagName('head')[0].innerHTML
        document.getElementsByTagName('head')[0].innerHTML = head + "<style>.black * { color: black !important; text-decoration: none !important; }</style>"
        ladder.className += ' black'
      }
      return {
        width:  (view == 'root' ? root : table).clientWidth,
        height: (view == 'root' ? root : ladder).clientHeight + 4
      }
    }, view, example.spans, example.tokens)
    console.log('size:', JSON.stringify(size))
    page.paperSize = { width: size.width + 'px', height: size.height + 'px', margin: '0px' }
    page.clipRect = { top: 0, left: 0, width: size.width, height: size.height }
    console.log('paperSize:', JSON.stringify(page.paperSize))
    console.log('clipRect:', JSON.stringify(page.clipRect))
    page.render(filename + '.pdf', {format: 'pdf', quality: '100'});
    page.render(filename + '.png', {format: 'png', quality: '100'});
    k()
  });
}

var example = {"spans":[{"text":"Jag ","links":[0],"labels":[],"moved":false},{"text":"bor ","links":[1],"labels":[],"moved":false},{"text":"i ","labels":[],"links":[2],"moved":false},{"text":"en ","labels":[],"links":[],"moved":false},{"text":"lägenhet ","labels":[],"links":[3],"moved":false},{"text":". ","links":[4],"labels":[],"moved":false},{"text":"Jag ","links":[5],"labels":[],"moved":false},{"text":"har ","labels":[],"links":[7],"moved":false},{"text":"bott ","labels":[],"links":[7],"moved":false},{"text":"ett ","links":[8],"labels":[],"moved":false},{"text":"år ","links":[9],"labels":[],"moved":false},{"text":"där ","links":[6],"labels":[],"moved":true},{"text":". ","links":[10],"labels":[],"moved":false},{"text":"Jag ","links":[11],"labels":[],"moved":false},{"text":"skulle ","links":[12],"labels":[],"moved":false},{"text":"vilja ","links":[13],"labels":[],"moved":false},{"text":"ha ","links":[14],"labels":[],"moved":false},{"text":"ett ","labels":[],"links":[15,16],"moved":false},{"text":"stort ","labels":[],"links":[15,16],"moved":false},{"text":"hus ","labels":[],"links":[15,16],"moved":false},{"text":". ","links":[17],"labels":[],"moved":false}],"tokens":["Jag ","bor ","på ","legenhet ",". ","Jag ","där ","bott ","ett ","år ",". ","Jag ","skulle ","vilja ","ha ","stor ","huset ",". "]}
var example_labelled = {"spans":[{"text":"Jag ","links":[0],"labels":[],"moved":false},{"text":"bor ","links":[1],"labels":[],"moved":false},{"text":"i ","labels":["W"],"links":[2],"moved":false},{"text":"en ","labels":["M"],"links":[],"moved":false},{"text":"lägenhet ","labels":["ORT"],"links":[3],"moved":false},{"text":". ","links":[4],"labels":[],"moved":false},{"text":"Jag ","links":[5],"labels":[],"moved":false},{"text":"har ","labels":["M"],"links":[7],"moved":true},{"text":"bott ","labels":[],"links":[7],"moved":true},{"text":"ett ","links":[8],"labels":[],"moved":false},{"text":"år ","links":[9],"labels":[],"moved":false},{"text":"där ","links":[6],"labels":["O"],"moved":true},{"text":". ","links":[10],"labels":[],"moved":false},{"text":"Jag ","links":[11],"labels":[],"moved":false},{"text":"skulle ","links":[12],"labels":[],"moved":false},{"text":"vilja ","links":[13],"labels":[],"moved":false},{"text":"ha ","links":[14],"labels":[],"moved":false},{"text":"ett ","labels":["M","F","INFL"],"links":[15,16],"moved":false},{"text":"stort ","labels":[],"links":[15,16],"moved":false},{"text":"hus ","labels":[],"links":[15,16],"moved":false},{"text":". ","links":[17],"labels":[],"moved":false}],"tokens":["Jag ","bor ","på ","legenhet ",". ","Jag ","där ","bott ","ett ","år ",". ","Jag ","skulle ","vilja ","ha ","stor ","huset ",". "]}

var xs = [
  ['screenshot', 'root', example],
  ['ladder', 'ladder', example],
  ['ladder_black', 'ladder_black', example],
  ['labelled_screenshot', 'root', example_labelled],
  ['labelled_ladder', 'ladder', example_labelled],
  ['labelled_ladder_black', 'ladder_black', example_labelled],
]

var features = [
  {
    "spans": [
      {
        "text": "Examples ",
        "labels": [],
        "links": [
          0
        ],
        "moved": false
      },
      {
        "text": "high ",
        "labels": [],
        "links": [
          1
        ],
        "moved": false
      },
      {
        "text": "light ",
        "labels": [],
        "links": [
          2
        ],
        "moved": false
      },
      {
        "text": "here ",
        "labels": [],
        "links": [
          3
        ],
        "moved": false
      },
      {
        "text": "lotsof ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "futures ",
        "labels": [],
        "links": [
          5
        ],
        "moved": false
      },
      {
        "text": ". ",
        "labels": [],
        "links": [
          6
        ],
        "moved": false
      }
    ],
    "tokens": [
      "Examples ",
      "high ",
      "light ",
      "here ",
      "lotsof ",
      "futures ",
      ". "
    ]
  },
  {
    "spans": [
      {
        "text": "Examples ",
        "labels": [],
        "links": [
          0
        ],
        "moved": false
      },
      {
        "text": "high ",
        "labels": [],
        "links": [
          1
        ],
        "moved": false
      },
      {
        "text": "light ",
        "labels": [],
        "links": [
          2
        ],
        "moved": false
      },
      {
        "text": "here ",
        "labels": [],
        "links": [
          3
        ],
        "moved": false
      },
      {
        "text": "lotsof ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "features ",
        "labels": [],
        "links": [
          5
        ],
        "moved": false
      },
      {
        "text": ". ",
        "labels": [],
        "links": [
          6
        ],
        "moved": false
      }
    ],
    "tokens": [
      "Examples ",
      "high ",
      "light ",
      "here ",
      "lotsof ",
      "futures ",
      ". "
    ]
  },
  {
    "spans": [
      {
        "text": "Examples ",
        "labels": [],
        "links": [
          0
        ],
        "moved": false
      },
      {
        "text": "highlight ",
        "labels": [],
        "links": [
          1,
          2
        ],
        "moved": false
      },
      {
        "text": "here ",
        "labels": [],
        "links": [
          3
        ],
        "moved": false
      },
      {
        "text": "lotsof ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "features ",
        "labels": [],
        "links": [
          5
        ],
        "moved": false
      },
      {
        "text": ". ",
        "labels": [],
        "links": [
          6
        ],
        "moved": false
      }
    ],
    "tokens": [
      "Examples ",
      "high ",
      "light ",
      "here ",
      "lotsof ",
      "futures ",
      ". "
    ]
  },
  {
    "spans": [
      {
        "text": "Examples ",
        "labels": [],
        "links": [
          0
        ],
        "moved": false
      },
      {
        "text": "highlight ",
        "labels": [],
        "links": [
          1,
          2
        ],
        "moved": false
      },
      {
        "text": "here ",
        "labels": [],
        "links": [
          3
        ],
        "moved": false
      },
      {
        "text": "lots ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "of ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "features ",
        "labels": [],
        "links": [
          5
        ],
        "moved": false
      },
      {
        "text": ". ",
        "labels": [],
        "links": [
          6
        ],
        "moved": false
      }
    ],
    "tokens": [
      "Examples ",
      "high ",
      "light ",
      "here ",
      "lotsof ",
      "futures ",
      ". "
    ]
  },
  {
    "spans": [
      {
        "text": "Examples ",
        "labels": [],
        "links": [
          0
        ],
        "moved": false
      },
      {
        "text": "highlight ",
        "labels": [],
        "links": [
          1,
          2
        ],
        "moved": false
      },
      {
        "text": "lots ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "of ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "features ",
        "labels": [],
        "links": [
          5
        ],
        "moved": false
      },
      {
        "text": "here ",
        "labels": [],
        "links": [
          3
        ],
        "moved": true
      },
      {
        "text": ". ",
        "labels": [],
        "links": [
          6
        ],
        "moved": false
      }
    ],
    "tokens": [
      "Examples ",
      "high ",
      "light ",
      "here ",
      "lotsof ",
      "futures ",
      ". "
    ]
  },
  {
    "spans": [
      {
        "text": "Examples ",
        "labels": [],
        "links": [
          0
        ],
        "moved": false
      },
      {
        "text": "to ",
        "labels": [],
        "links": [],
        "moved": false
      },
      {
        "text": "highlight ",
        "labels": [],
        "links": [
          1,
          2
        ],
        "moved": false
      },
      {
        "text": "lots ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "of ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "features ",
        "labels": [],
        "links": [
          5
        ],
        "moved": false
      },
      {
        "text": "here ",
        "labels": [],
        "links": [
          3
        ],
        "moved": true
      },
      {
        "text": ". ",
        "labels": [],
        "links": [
          6
        ],
        "moved": false
      }
    ],
    "tokens": [
      "Examples ",
      "high ",
      "light ",
      "here ",
      "lotsof ",
      "futures ",
      ". "
    ]
  },
  {
    "spans": [
      {
        "text": "Examples ",
        "labels": [],
        "links": [
          0
        ],
        "moved": false
      },
      {
        "text": "to ",
        "labels": [],
        "links": [],
        "moved": false
      },
      {
        "text": "highlight ",
        "labels": [],
        "links": [
          1,
          2
        ],
        "moved": false
      },
      {
        "text": "lots ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "of ",
        "labels": [],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "features ",
        "labels": [],
        "links": [
          5
        ],
        "moved": false
      },
      {
        "text": ". ",
        "labels": [],
        "links": [
          6
        ],
        "moved": false
      }
    ],
    "tokens": [
      "Examples ",
      "high ",
      "light ",
      "here ",
      "lotsof ",
      "futures ",
      ". "
    ]
  },{
    "spans": [
      {
        "text": "Examples ",
        "labels": [],
        "links": [
          0
        ],
        "moved": false
      },
      {
        "text": "to ",
        "labels": ["M"],
        "links": [],
        "moved": false
      },
      {
        "text": "highlight ",
        "labels": ["SPL"],
        "links": [
          1,
          2
        ],
        "moved": false
      },
      {
        "text": "lots ",
        "labels": ["PART"],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "of ",
        "labels": ["PART"],
        "links": [
          4
        ],
        "moved": false
      },
      {
        "text": "features ",
        "labels": ["ORT"],
        "links": [
          5
        ],
        "moved": false
      },
      {
        "text": "here ",
        "labels": ["O"],
        "links": [
          3
        ],
        "moved": true
      },
      {
        "text": ". ",
        "labels": [],
        "links": [
          6
        ],
        "moved": false
      }
    ],
    "tokens": [
      "Examples ",
      "high ",
      "light ",
      "here ",
      "lotsof ",
      "futures ",
      ". "
    ]
  }
]

xs = xs.concat(features.map(function (state, i) {
  state.spans.pop()
  state.tokens.pop()
  return ['features' + i, 'ladder', state]
}))

function go() {
  var x = xs.pop()
  if (x) {
    Render(x[0], x[1], x[2], go)
  } else {
    phantom.exit()
  }
}

go()
