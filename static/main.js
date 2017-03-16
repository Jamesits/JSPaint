function onReady() {
    // set up paint canvas
    p = JSPaint();
    p.init(document.getElementById('canvasDiv'));

    // set up websocket
    var ws = new WebSocket("ws://localhost:8888/ws?room=0&id=12345");
    ws.onopen = function (event) {
        ws.send("CONN");
    };

    // set up draw event listener
    p.addClickEventListener(function(e, f){
        console.log(e);
        ws.send(JSON.stringify(e));
    });

    ws.onmessage = function (event) {
        console.log(JSON.parse(event.data));
    }

    // disable context menu
    window.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
}

(function ready(fn) {
    if (document.readyState != 'loading'){
        fn();
    } else if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        document.attachEvent('onreadystatechange', function() {
          if (document.readyState != 'loading')
              fn();
        });
    }
})(onReady);
