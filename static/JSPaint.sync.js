var JSPaintSync = function (paint, ws_location, params) {
    // dict to URL params
    // https://stackoverflow.com/questions/7045065/how-do-i-turn-a-javascript-dictionary-into-an-encoded-url-string
    var param_serialize = function (obj) {
        var str = [];
        for(var p in obj)
             str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        return str.join("&");
    }

    var deferHelper = function () {
        var deferredFunctions = [],
            addTask = function (f) { deferredFunctions.push(f); },
            runTasks = function () {
                for (var i = deferredFunctions.length; i > 0; --i) {
                    deferredFunctions[i]();
                }
            };
        return {
            addTask: addTask,
            runTasks: runTasks,
        };
    }

    // set up websocket
    var ws = {
        status: "disconnected",
        is_first_connect: true,
        connected: false,
        reconnect_interval: 0,
        timer: null,
        socket: null,
        waiting_list: [],
        paint_event_defer: null,
    };

    var updateUserDebugMsg = function () {
        var text = "WebSocket: " + ws.status;
        // p.updateUserDebugMsg(text);
        console.log(text);
    };
    var send = function (msg) {
        if (ws.connected) {
            ws.socket.send(msg);
        } else {
            ws.waiting_list.push(msg);
        }
    };
    var sendControlMsg = function (msg, args) {
        var t = msg + " " + Date.now();
        if (args) t = t + " " + args;
        send(t);
    };
    var wsSetup = function () {
        if (ws.paint_event_defer) ws.paint_event_defer.runTasks();
        ws.paint_event_defer = deferHelper();
        ws.connected = false;
        ws.status = "initializating...";
        updateUserDebugMsg();
        // if WebSocket is still active, close it.
        if (ws.socket) {
            ws.socket.close();
        }
        ws.socket = new WebSocket(ws_location + "?" + param_serialize(params));

        // connected
        ws.socket.addEventListener('open', function (event) {
            ws.connected = true;
            ws.reconnect_interval = 0;
            sendControlMsg("INIT");
            if (ws.is_first_connect) {
                ws.status = "connected, pulling log...";
                sendControlMsg("PULL");
            }
            ws.status = "connected, sending log...";
            updateUserDebugMsg();
            // console.log("WebSocket connected: ", event);
            while (ws.waiting_list.length > 0) {
                send(ws.waiting_list.shift());
            }
            ws.status = "connected";
            updateUserDebugMsg();
            sendControlMsg("HELLO");
            ws.is_first_connect = false;
        });

        // server disconnect
        ws.socket.addEventListener('close', function (event) {
            ws.is_connected = false;
            ws.status = "disconnected, reconnect interval " + ws.reconnect_interval + "ms";
            updateUserDebugMsg();
            ws.timer = setTimeout(wsSetup, ws.reconnect_interval);
        });

        // connection failure
        ws.socket.addEventListener('error', function (event) {
            ws.is_connected = false;
            ws.status = "error";
            updateUserDebugMsg();
            // console.log("WebSocket error: ", event);
            if (ws.reconnect_interval <= 32000) {
                ws.reconnect_interval = ws.reconnect_interval + 500;
            }
        });

        // set up draw event listener
        ws.paint_event_defer.addTask(p.addEventListener('click', function (e, f) {
            var msg = JSON.stringify(e);
            send(msg);
        }));

        ws.paint_event_defer.addTask(p.addEventListener('updateDebugMessage', function (e) {
            e.websocket = {
                status: ws.status,
                connected: ws.connected,
                reconnect_interval: ws.reconnect_interval,
                waiting_list_length: ws.waiting_list.length
            };
        }));

        ws.socket.addEventListener('message', function (event) {
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
