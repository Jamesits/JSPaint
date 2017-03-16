function onReady() {
    // global consts
    const roomid = 0;

    // set up paint canvas
    p = JSPaint();
    p.init(document.getElementById('canvasDiv'));

    // generate UUID for this client
    var uuid = localStorage.getItem('uuid');
    if (!uuid) {
        uuid = UUID.generate().toString();
        localStorage.setItem('uuid', uuid);
    }

    // set up websocket
    var ws_status = "disconnected";
    var updateUserDebugMsg = function () {
        var text = "WebSocket: " + ws_status;
        p.updateUserDebugMsg(text);
    }
    var ws_location = "ws://" + location.host + (location.pathname.endsWith('/') ? location.pathname.slice(0, -1) : location.pathname) + "/ws";
    console.log(ws_location);
    var ws = new WebSocket(ws_location + "?room=" + roomid + "&id=" + uuid);
    ws.addEventListener('open', function (event) {
        ws_status = "connected";
        updateUserDebugMsg();
        console.log(event);
    });

    ws.addEventListener('close', function (event) {
        ws_status = "disconnected";
        updateUserDebugMsg();
        console.log(event);
    });

    ws.addEventListener('error', function (event) {
        ws_status = "error";
        updateUserDebugMsg();
        console.log(event);
    });

    // set up draw event listener
    p.addClickEventListener(function(e, f){
        ws.send(JSON.stringify(e));
    });

    ws.addEventListener('message', function (event) {
        console.log(JSON.parse(event.data));
    });

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
