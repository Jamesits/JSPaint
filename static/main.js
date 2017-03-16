var p;
var onReady = function () {

    "use strict";

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
    var ws_is_first_connect = true;
    var ws_is_connected = false;
    var ws_reconnect_interval;
    var ws_timer;
    var ws;
    var updateUserDebugMsg = function () {
        var text = "WebSocket: " + ws_status;
        p.updateUserDebugMsg(text);
    }
    var ws_location = "ws://" + location.host + (location.pathname.endsWith('/') ? location.pathname.slice(0, -1) : location.pathname) + "/ws";
    var ws_waiting_list = [];
    var wsSetup = function () {
        ws = new WebSocket(ws_location + "?room=" + roomid + "&id=" + uuid);
        

        // connected
        ws.addEventListener('open', function (event) {
            ws_is_connected = true;
            ws_reconnect_interval = 0;
            ws.send("INIT");
            if (ws_is_first_connect) {
                ws_status = "connected, pulling log...";
                ws.send("PULL");
            }
            ws_status = "connected, sending log...";
            updateUserDebugMsg();
            console.log("WebSocket connected: ", event);
            while (ws_waiting_list.length > 0) {
                ws.send(ws_waiting_list.shift());
            }
            ws_status = "connected";
            updateUserDebugMsg();
            ws.send("HELLO");
            ws_is_first_connect = false;
        });

        // server disconnect
        ws.addEventListener('close', function (event) {
            ws_status = "disconnected, reconnect interval " + ws_reconnect_interval + "ms";
            ws_is_connected = false;
            updateUserDebugMsg();
            console.log("WebSocket close: ", event, ws_reconnect_interval);
            ws_timer = setTimeout(wsSetup, ws_reconnect_interval);
        });

        // connection failure
        ws.addEventListener('error', function (event) {
            ws_status = "error";
            ws_is_connected = false;
            updateUserDebugMsg();
            console.log("WebSocket error: ", event);
            if (ws_reconnect_interval <= 32000) {
                ws_reconnect_interval = ws_reconnect_interval + 500;
            }
        });

        // set up draw event listener
        p.clearClickEventListener();
        p.addClickEventListener(function (e, f) {
            var msg = JSON.stringify(e);
            if (ws_is_connected) {
                ws.send(msg);
            } else {
                ws_waiting_list.push(msg);
            }
        });

        ws.addEventListener('message', function (event) {
            var d = JSON.parse(event.data)
            console.log("WebSocket received: ", d);
            p.addClickEvent(d);
        });

        return ws;
    }
    var ws = wsSetup();

    // disable context menu
    window.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
};

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
