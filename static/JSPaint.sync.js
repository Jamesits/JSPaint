var JSPaintSync = function (paint, ws_location, params) {
    var cseq = 0;
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
                    try {
                        deferredFunctions[i]();
                    }
                    catch (err) {
                        console.log("Unable to execute deferred function ", deferredFunctions[i], err.message);
                    }
                }
                deferredFunctions.length = 0;
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
        ping: {
            interval: 1000,
            timer: null,
            lastPingTimeStamp: 0,
            lastPongTimeStamp: 0,
            lastUpload: 0,
            lastDownload: 0,
            lastRTT: 0,
        },
        socket: null,
        waiting_list: [],
        paint_event_defer: null,
        debug_msg: "",
        online_number: 0,
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
        // if WebSocket is still active, close it.
        if (ws.socket) {
            ws.socket.close();
        }
        ws.socket = new WebSocket(ws_location + "?" + param_serialize(params));

        var wsPing = function () {
            if (ws.connected) {
                ws.ping.lastPingTimeStamp = Date.now();
                sendControlMsg("PING");
            }
        }

        // connected
        ws.socket.addEventListener('open', function (event) {
            ws.connected = true;
            ws.reconnect_interval = 0;
            sendControlMsg("INIT");
            if (ws.is_first_connect) {
                ws.status = "pulling log...";
                sendControlMsg("PULL");
            }
            ws.status = "sending log...";
            // console.log("WebSocket connected: ", event);
            while (ws.waiting_list.length > 0) {
                send(ws.waiting_list.shift());
            }
            ws.status = "connected";
            sendControlMsg("HELLO");
            ws.is_first_connect = false;
            ws.ping.timer = setTimeout(wsPing, ws.ping.interval);
        });

        // server disconnect
        ws.socket.addEventListener('close', function (event) {
            ws.is_connected = false;
            ws.status = "disconnected";
            ws.timer = setTimeout(wsSetup, ws.reconnect_interval);
        });

        // connection failure
        ws.socket.addEventListener('error', function (event) {
            ws.is_connected = false;
            ws.status = "error";
            // console.log("WebSocket error: ", event);
            if (ws.reconnect_interval <= 32000) {
                ws.reconnect_interval = ws.reconnect_interval + 500;
            }
        });

        // set up draw event listener
        p.addEventListener('newStroke', function (e, f) {
            e.cseq = ++cseq;
            e.ctime = Date.now();
            var msg = JSON.stringify(e);
            send(msg);
            return true;
        });

        p.addEventListener('updateDebugMessage', function (e) {
            e.websocket = {
                status: ws.status,
                connected: ws.connected,
                reconnect_interval: ws.reconnect_interval,
                waiting_list_length: ws.waiting_list.length,
                last_upload_latency: ws.ping.lastUpload,
                last_download_latency: ws.ping.lastDownload,
                last_rtt: ws.ping.lastRTT,
            };
            // because e.onepaper is created before this event listener
            // we can edit it now
            if (ws.connected) {
                e.onepaper.online_clients = ws.online_number;
            } else {
                e.onepaper.online_clients = 0;
            }
        });

        var serverMsgHandlers = {
            "CLEAR": function (msg) { p.clearCanvas(msg[1]); },
            "PONG": function (msg) {
                ws.ping.lastPongTimeStamp = Date.now();
                ws.ping.lastRTT = ws.ping.lastPongTimeStamp - ws.ping.lastPingTimeStamp;
                var serverPongTimeStamp = parseInt(msg[1]);
                ws.ping.lastUpload = serverPongTimeStamp - ws.ping.lastPingTimeStamp;
                ws.ping.lastDownload = ws.ping.lastPongTimeStamp - serverPongTimeStamp;
                ws.ping.timer = setTimeout(wsPing, ws.ping.interval);
            },
            "ONLINE": function (msg) {
                ws.online_number = parseInt(msg[1]);
            },
            "CONFIRM": function (msg) {

            },
        };

        ws.socket.addEventListener('message', function (event) {
            try {
                var d = JSON.parse(event.data)
                p.addStroke(d);
            } catch (e){
                // got control message
                var msg = event.data.split(" ");
                for (var key in serverMsgHandlers) {
                    if (msg[0] == key) {
                        serverMsgHandlers[key](msg);
                    }
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
