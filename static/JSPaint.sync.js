var JSPaintSync = function (paint, ws_location, params) {
    // dict to URL params
    // https://stackoverflow.com/questions/7045065/how-do-i-turn-a-javascript-dictionary-into-an-encoded-url-string
    function param_serialize(obj) {
        var str = [];
        for(var p in obj)
             str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        return str.join("&");
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
    };
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
        send(t);
    };
    var wsSetup = function () {
        ws_is_connected = false;
        ws_status = "initializating...";
        updateUserDebugMsg();
        // if WebSocket is still active, close it.
        if (ws) {
            ws.close();
        }
        ws = new WebSocket(ws_location + "?" + param_serialize(params));

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
            ws_is_connected = false;
            ws_status = "disconnected, reconnect interval " + ws_reconnect_interval + "ms";
            updateUserDebugMsg();
            // console.log("WebSocket close: ", event, ws_reconnect_interval);
            ws_timer = setTimeout(wsSetup, ws_reconnect_interval);
        });

        // connection failure
        ws.addEventListener('error', function (event) {
            ws_is_connected = false;
            ws_status = "error";
            updateUserDebugMsg();
            // console.log("WebSocket error: ", event);
            if (ws_reconnect_interval <= 32000) {
                ws_reconnect_interval = ws_reconnect_interval + 500;
            }
        });

        // set up draw event listener
        p.clearEventListener('click');
        p.addEventListener('click', function (e, f) {
            var msg = JSON.stringify(e);
            send(msg);
        });

        ws.addEventListener('message', function (event) {
            try {
                var d = JSON.parse(event.data)
                p.addClickEvent(d);
            } catch (e){
                // got control message
                var msg = event.data.split(" ");
                if (msg[0].startsWith("CLEAR")) {
                    p.clearCanvas(msg[1]);
                }
            }
        });

        // set up UI event listeners
        document.getElementById("clear").addEventListener("click", function () {
            sendControlMsg("CLEAR");
            p.clearCanvas();
        });

        return ws;
    };

    return {
        init: wsSetup,
    }
}
