var JSPaint = function () {

    "use strict";

    // helper functions
    var helper = {
        // RGB to color string
        colorFromRGB: function (r, g, b) {
            curColor = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        },

        sort_by_server_timestamp: function (a, b) {
            var a_time = a.serverTime || a.clientTime || (a.x + a.y);
            var b_time = b.serverTime || b.clientTime || (b.x + b.y);
            var ret = a_time - b_time;
            if (ret == 0) {
                a_time += a.clientTime;
                b_time += b.clientTime;
                ret = a_time - b_time;
            }
            if (ret == 0) {
                a_time = a.x + a.y;
                b_time = b.x + b.y;
                ret = a_time - b_time;
            }
        },

        // merge sort
        // from https://github.com/millermedeiros/amd-utils/blob/master/src/array/sort.js
        mergeSort: function (arr, compareFn) {
            var defaultCompare = function (a, b) {
                return a < b ? -1 : (a > b ? 1 : 0);
            };

            var merge = function (left, right, compareFn) {
                var result = [];

                while (left.length && right.length) {
                    if (compareFn(left[0], right[0]) <= 0) {
                        // if 0 it should preserve same order (stable)
                        result.push(left.shift());
                    } else {
                        result.push(right.shift());
                    }
                }

                if (left.length) {
                    result.push.apply(result, left);
                }

                if (right.length) {
                    result.push.apply(result, right);
                }

                return result;
            };

            if (arr.length < 2) {
                return arr;
            }

            if (compareFn == null) {
                compareFn = defaultCompare;
            }

            var mid, left, right;

            mid = ~~(arr.length / 2);
            left = mergeSort(arr.slice(0, mid), compareFn);
            right = mergeSort(arr.slice(mid, arr.length), compareFn);

            return merge(left, right, compareFn);
        },

        // remove element from array
        // removeFromArray(array, element1, [element2, [element3, [...]]])
        removeFromArray: function (array) {
            var what, a = arguments,
                L = a.length,
                ax;
            while (L > 1 && arr.length) {
                what = a[--L];
                while ((ax = arr.indexOf(what)) !== -1) {
                    arr.splice(ax, 1);
                }
            }
            return arr;
        },

        // copy object properties
        objCopy: function (dest, src) {
            for (var attr in src) {
                dest[attr] = src[attr];
            }
        },
    };

    // canvas context operations
    var canvasOperations = {
        getPixelRatio: function (context) {
            var backingStore = context.backingStorePixelRatio ||
                context.webkitBackingStorePixelRatio ||
                context.mozBackingStorePixelRatio ||
                context.msBackingStorePixelRatio ||
                context.oBackingStorePixelRatio ||
                context.backingStorePixelRatio || 1;
            return (window.devicePixelRatio || 1) / backingStore;
        },
        clear: function (context) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        },
    };

    // global DOM objects
    var dom = {
        canvasContext: null,
        canvasDiv: null,
        bgCanvasContext: null,
        debugDiv: null,
    };

    var canvasProperties = {
        drawingAreaWidth: 640,
        drawingAreaHeight: 480,
        lastdpiPercentage: 1,
        dpiPercentage: 1,
        zoom: 1,
    };

    // a Hammer.js instance
    var gestureRecognizer;

    // event flow
    var events = {
        // server commited
        commited: [],
        // on commit process
        commiting: [],
        // pre-rendered but not commited
        queuing: [],
    };

    // canvas draw status
    var pen = {
        down: false,
        tool: "marker",
        size: 2,
        color: "#000000",
    };

    // background process
    var backgroundProcesses = {
        redraw: {
            enabled: true,
            interval: 50,
            func: function (p) {
                triggerEvent('redraw', p);
            },
            properties: {
                lastBackgroundFrame: null,
            },
        },
        checkDevicePixelRatio: {
            enabled: true,
            interval: 100,
            func: function () {
                dpiPercentage = canvasOperations.getPixelRatio(dom.canvasContext);
                if (dpiPercentage !== lastdpiPercentage) {
                    setSize(curSize);
                    onresize();
                    lastdpiPercentage = dpiPercentage;
                }
            },
            properties: {},
        },
        refreshDebugMsg: {
            enabled: true,
            interval: 500,
            func: function (p) {
                var text = "EPS: " + p.eps.toFixed(2) + (backgroundProcesses.redraw.enabled ? " Optimal FPS: " + p.fps.toFixed(2) + " Refresh Interval: " + backgroundProcesses.redraw.interval.toFixed(2) + "ms" : " Refresh Disabled") + " Ratio: " + canvasProperties.dpiPercentage + " Strokes: " + (events.commited.length + events.commiting.length + events.queuing.length) + " " + p.userMsg;
                dom.debugDiv.innerHTML = text;
            },
            properties: {
                fps: 0,
                eps: 0,
                lastEvent: 0,
                userMsg: "",
            },
        }
    };

    var initBackgroundProcesses = function () {
        for (var n in backgroundProcesses) {
            var p = backgroundProcesses[n];
            // create timed function for every background process
            p.timeFunc = function () {
                if (p.func && p.enabled) p.func(p.properties);
                p.timer = window.setTimeout(p.timeFunc, p.interval);
            };
            // launch them asyncly
            window.setTimeout(p.timeFunc, 1);
        }
    };

    var triggerBackgroundProcess = function (name) {
        window.clearTimeout(backgroundProcesses[name].timer);
        backgroundProcesses[name].timeFunc();
    }

    var onresize = function (e) {
        canvasProperties.dpiPercentage = canvasOperations.getPixelRatio(dom.canvasContext);
        canvasProperties.drawingAreaWidth = dom.canvasDiv.offsetWidth;
        canvasProperties.drawingAreaHeight = dom.canvasDiv.offsetHeight;
        dom.canvasContext.canvas.width = dom.canvasDiv.offsetWidth * canvasProperties.dpiPercentage;
        dom.canvasContext.canvas.height = dom.canvasDiv.offsetHeight * canvasProperties.dpiPercentage;
        dom.bgCanvasContext.canvas.width = dom.canvasDiv.offsetWidth * canvasProperties.dpiPercentage;
        dom.bgCanvasContext.canvas.height = dom.canvasDiv.offsetHeight * canvasProperties.dpiPercentage;
        if (e) triggerEvent(redraw);
    };

    // global getter and setter
    var publicProperties = {
        tool: pen.tool,
        size: pen.size,
        color: pen.color,
        debugMsg: backgroundProcesses.refreshDebugMsg.properties.userMsg,
    };
    var get = function (property) {
        return publicProperties[property];
    };
    var set = function (property, newValue) {
        publicProperties[property] = newValue;
    };

    // debugging
    var calcEventRate = function () {
        window.setTimeout(function () {
            var current_time = performance.now();
            debug.eps = (debug.eps + 1000 / (current_time - debug.lastEvent)) / 2;
            debug.lastEvent = current_time;
        }, 1);
    };

    // drawing
    var tools = {
        marker: {},
        eraser: {
            setCanvasContextOption: function () {
                return {
                    globalCompositeOperation: "destination-out",
                };
            }
        },
    };

    var draw = function (canvasContext, currentStroke, lastStroke) {
        if (!(tools[currentStroke.tool])) return;
        canvasContext.beginPath();

        // If dragging then draw a line between the two points
        if (currentStroke.draw && lastStroke && lastStroke.tool !== "clear") {
            canvasContext.moveTo(lastStroke.x * dpiPercentage, lastStroke.y * dpiPercentage);
        } else {
            // The x position is moved over one pixel so a circle even if not dragging
            canvasContext.moveTo((currentStroke.x - 1) * dpiPercentage, currentStroke.y * dpiPercentage);
        }
        canvasContext.lineTo(currentStroke.x * dpiPercentage, currentStroke.y * dpiPercentage);

        canvasContext.strokeStyle = currentStroke.color;
        canvasContext.globalCompositeOperation = "source-over";
        canvasContext.lineCap = "round";
        canvasContext.lineJoin = "round";
        canvasContext.lineWidth = currentStroke.size / currentStroke.dpiPercentage * dpiPercentage;
        if (tools[currentStroke.tool].setCanvasContextOption) {
            helper.objCopy(canvasContext, tools[currentStroke.tool].setCanvasContextOption());
        }

        canvasContext.closePath();
        canvasContext.stroke();
    };

    // draw on the background canvas, then copy content to foreground
    var backgroundRedraw = function (p) {
        var t0 = performance.now();

        // clear canvas
        dom.bgCanvasContext.clearRect(0, 0, dom.bgCanvasContext.canvas.width, dom.bgCanvasContext.canvas.height);

        helper.mergeSort(events.commited, helper.sort_by_server_timestamp);

        var drawArray = function (arr) {
            for (var currentRedrawPtr = 0; currentRedrawPtr < arr.length; currentRedrawPtr += 1) {
                draw(dom.bgCanvasContext, arr[currentRedrawPtr], arr[currentRedrawPtr - 1]);
            }
        };

        drawArray(events.commited);
        drawArray(events.commiting);
        drawArray(events.queuing);

        p.lastBackgroundFrame = dom.bgCanvasContext.getImageData(0, 0, dom.bgCanvasContext.canvas.width, dom.bgCanvasContext.canvas.height);
        dom.canvasContext.putImageData(p.lastBackgroundFrame, 0, 0);

        var t1 = performance.now();
        backgroundProcesses.refreshDebugMsg.properties.fps = (backgroundProcesses.refreshDebugMsg.properties.fps + 1000 / (t1 - t0)) / 2;
    };

    // user event processing
    var initUserEvents = function () {
        var getCurrentMousePointerPos = function (e) {
                return {
                    X: e.changedPointers[0].clientX,
                    Y: e.changedPointers[0].clientY,
                };
            },

            addClick = function (x, y, e) {
                triggerEvent('click', {
                    x: x,
                    y: y,
                    e: e
                });
            },

            canvasAppend = function () {
                triggerEvent('redraw');
            },

            pressDrawing = function (e) {
                calcEventRate();
                var mouse = getCurrentMousePointerPos(e);
                pen.down = true;
                addClick(mouse.X, mouse.Y, false);
                canvasAppend();
            },

            dragDrawing = function (e) {
                calcEventRate();
                var mouse = getCurrentMousePointerPos(e);
                if (pen.down) {
                    addClick(mouse.X, mouse.Y, true);
                    canvasAppend();
                }
                // Prevent the whole page from dragging if on mobile
                e.preventDefault();
            },

            releaseDrawing = function () {
                calcEventRate();
                pen.down = false;
                canvasAppend();
            },

            cancelDrawing = function () {
                calcEventRate();
                pen.down = false;
            };

        gestureRecognizer = new Hammer(dom.canvasContext.canvas);
        gestureRecognizer.get('pan').set({
            direction: Hammer.DIRECTION_ALL,
            threshold: 0,
        });
        gestureRecognizer.on('panstart', pressDrawing);
        gestureRecognizer.on('panmove', dragDrawing);
        gestureRecognizer.on('panend', releaseDrawing);
        gestureRecognizer.on('pancancel', cancelDrawing);

        window.addEventListener('resize', function (e) {
            triggerEvent('resize', e);
        });
    };

    var clearCanvas = function (timestamp) {
        helper.clearCanvas(dom.canvasContext);
    };

    // event listeners
    var eventListeners = {
        resize: [onresize],
        redraw: [function () { triggerBackgroundProcess('redraw'); }],
    };

    // event listeners operation
    var addEventListener = function (e, f) {
        if (eventListeners[e]) {
            eventListeners[e].push(f);
        } else {
            eventListeners[e] = [f];
        }
        return function () {
            removeEventListener(e, f);
        };
    };

    var removeEventListener = function (e, f) {
        if (eventListeners[e]) {
            helper.removeFromArray(eventListeners[e], f);
        }
    };

    var triggerEvent = function (e) {
        if (eventListeners[e]) {
            for (var i in eventListeners[e]) {
                eventListeners[e][i].apply(this, Array.from(arguments).slice(1));
            }
        }
    };

    // object initialize
    var init = function (element) {
        dom.canvasDiv = element;

        var canvasElement;
        // create visible canvas
        canvasElement = document.createElement('canvas');
        canvasElement.setAttribute('id', 'drawing');
        canvasElement.setAttribute('class', 'jspaint');
        dom.canvasDiv.appendChild(canvasElement);
        if (typeof G_vmlCanvasManager !== "undefined") {
            canvasElement = G_vmlCanvasManager.initElement(canvasElement);
        }
        dom.canvasContext = canvasElement.getContext("2d");
        // create background canvas
        canvasElement = document.createElement('canvas');
        canvasElement.setAttribute('id', 'bgdrawing');
        canvasElement.setAttribute('class', 'background');
        dom.canvasDiv.appendChild(canvasElement);
        if (typeof G_vmlCanvasManager !== "undefined") {
            canvasElement = G_vmlCanvasManager.initElement(canvasElement);
        }
        dom.bgCanvasContext = canvasElement.getContext("2d");

        // debug information display div
        dom.debugDiv = document.getElementById("debug");

        triggerEvent('resize');

        initBackgroundProcesses();
        initUserEvents();
    };

    return {
        init: init,
        get: get,
        set: set,
        addEventListener: addEventListener,
        removeEventListener: removeEventListener,
        triggerEvent: triggerEvent,
    };
};