var webPage = require('webpage');

var page = webPage.create();

page.onConsoleMessage = function(msg) {
  //console.log(msg);
}

function Render(filename, view, example, k) {
  page.viewportSize = { width: 1100, height: 800 }
  page.open("http://localhost:8080#ingenting", function start(status) {
    size = page.evaluate(function(view, spans, tokens) {
      var root = document.getElementById('root')
      var body = document.getElementsByTagName('body')[0]
      var ladder = body.getElementsByClassName('LadderRoot')[0]
      body.innerHTML = ''
      body.style.background = '#ffffff'
      if (view == 'root') {
        body.appendChild(root)
      } else if (view == 'ladder') {
        body.appendChild(ladder)
      } else {
        throw 'view not root nor ladder'
      }
      var cms = root.getElementsByClassName('CodeMirror')
      for (var x = 0; x < cms.length; x++) {
        cms[x].style.height = '180px'
      }
      if (spans && tokens) {
        window.set_state(spans, tokens)
      }
      root.getElementsByClassName('cm_main')[0].click()
      var table = ladder.getElementsByClassName('LadderTable')[0]
      return {
        width: (view == 'ladder' ? table : root).clientWidth,
        height: (view == 'ladder' ? ladder : root).clientHeight
      }
    }, view, example.spans, example.tokens)
    console.log(JSON.stringify(size))
    page.paperSize = { width: size.width + 'px', height: size.height + 'px', margin: '0px' }
    page.clipRect = { top: 0, left: 0, width: size.width, height: size.height }
    page.render(filename + '.pdf', {format: 'pdf', quality: '100'});
    page.render(filename + '.png', {format: 'png', quality: '100'});
    k()
  });
}

var example = {"spans":[{"text":"Jag ","links":[0],"labels":[],"moved":false},{"text":"bor ","links":[1],"labels":[],"moved":false},{"text":"i ","labels":[],"links":[2],"moved":false},{"text":"en ","labels":[],"links":[],"moved":false},{"text":"lägenhet ","labels":[],"links":[3],"moved":false},{"text":". ","links":[4],"labels":[],"moved":false},{"text":"Jag ","links":[5],"labels":[],"moved":false},{"text":"har ","labels":[],"links":[7],"moved":false},{"text":"bott ","labels":[],"links":[7],"moved":false},{"text":"ett ","links":[8],"labels":[],"moved":false},{"text":"år ","links":[9],"labels":[],"moved":false},{"text":"där ","links":[6],"labels":[],"moved":true},{"text":". ","links":[10],"labels":[],"moved":false},{"text":"Jag ","links":[11],"labels":[],"moved":false},{"text":"skulle ","links":[12],"labels":[],"moved":false},{"text":"vilja ","links":[13],"labels":[],"moved":false},{"text":"ha ","links":[14],"labels":[],"moved":false},{"text":"ett ","labels":[],"links":[15,16],"moved":false},{"text":"stort ","labels":[],"links":[15,16],"moved":false},{"text":"hus ","labels":[],"links":[15,16],"moved":false},{"text":". ","links":[17],"labels":[],"moved":false}],"tokens":["Jag ","bor ","på ","legenhet ",". ","Jag ","där ","bott ","ett ","år ",". ","Jag ","skulle ","vilja ","ha ","stor ","huset ",". "]}

var xs = [
  ['screenshot', 'root', example],
  ['ladder', 'ladder', example],
]

function go() {
  var x = xs.pop()
  if (x) {
    Render(x[0], x[1], x[2], go)
  } else {
    phantom.exit()
  }
}

go()
