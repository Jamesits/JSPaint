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
    var ws_location = (location.protocol.toLowerCase().startsWith("https")?"wss://":"ws://") + location.host + (location.pathname.endsWith('/') ? location.pathname.slice(0, -1) : location.pathname) + "/ws";
    var ws_waiting_list = [];
    var send = function (msg) {
        if (ws_is_connected) {
            ws.send(msg);
        } else {
            ws_waiting_list.push(msg);
        }
    };
    var sendControlMsg = function (msg, args) {
        var t = msg + " " + Date.now();
        if (args) t = t + " " + args;
        if (ws_is_connected) {
            ws.send(t);
        } else {
            ws_waiting_list.push(t);
        }
    }
    var wsSetup = function () {
        ws_status = "initializating...";
        updateUserDebugMsg();
        ws = new WebSocket(ws_location + "?room=" + roomid + "&id=" + uuid);
        

        // connected
        ws.addEventListener('open', function (event) {
            ws_is_connected = true;
            ws_reconnect_interval = 0;
            sendControlMsg("INIT");
            if (ws_is_first_connect) {
                ws_status = "connected, pulling log...";
                sendControlMsg("PULL");
            }
            ws_status = "connected, sending log...";
            updateUserDebugMsg();
            // console.log("WebSocket connected: ", event);
            while (ws_waiting_list.length > 0) {
                send(ws_waiting_list.shift());
            }
            ws_status = "connected";
            updateUserDebugMsg();
            sendControlMsg("HELLO");
            ws_is_first_connect = false;
        });

        // server disconnect
        ws.addEventListener('close', function (event) {
            ws_status = "disconnected, reconnect interval " + ws_reconnect_interval + "ms";
            ws_is_connected = false;
            updateUserDebugMsg();
            // console.log("WebSocket close: ", event, ws_reconnect_interval);
            ws_timer = setTimeout(wsSetup, ws_reconnect_interval);
        });

        // connection failure
        ws.addEventListener('error', function (event) {
            ws_status = "error";
            ws_is_connected = false;
            updateUserDebugMsg();
            // console.log("WebSocket error: ", event);
            if (ws_reconnect_interval <= 32000) {
                ws_reconnect_interval = ws_reconnect_interval + 500;
            }
        });

        // set up draw event listener
        p.clearClickEventListener();
        p.addClickEventListener(function (e, f) {
            var msg = JSON.stringify(e);
            send(msg);
        });

        ws.addEventListener('message', function (event) {
            try {
                var d = JSON.parse(event.data)
                p.addClickEvent(d);
            } catch (e){
                // got control message
                if (event.data === "CLEAR") {
                    p.clearCanvas();
                }
            }
        });

        // set up UI event listeners
        document.getElementById("clear").addEventListener("click", function () {
            sendControlMsg("CLEAR");
            p.clearCanvas();
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
