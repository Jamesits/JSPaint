"use strict";
var JSPaint = function () {
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
        // last unfinished event point
        lastPoint: null,
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
            },
            properties: {
                lastBackgroundFrame: null,
            },
        },
        refreshDebugMsg: {
            enabled: true,
            interval: 500,
            func: function (p) {
                p.content = {
                    core: {
                        polling_rate: p.eps.toFixed(2),
                        redraw_enabled: backgroundProcesses.redraw.enabled,
                        redraw_fps: p.fps.toFixed(2),
                        redraw_interval: backgroundProcesses.redraw.interval.toFixed(2) + "ms",
                        dpi_ratio: canvasProperties.dpiPercentage,
                        commited_strokes: events.commited.length,
                        commiting_strokes: events.commiting.length,
                        queueing_strokes: events.queuing.length,
                    },
                    pen: {
                        down: pen.down,
                        tool: pen.tool,
                        size: pen.size,
                        color: pen.color,
                    },
                    background_process: {},
                };
                for (var i in backgroundProcesses) {
                    p.content.background_process[i] = backgroundProcesses[i].enabled + " " + backgroundProcesses[i].interval + "ms";
                }
                triggerEvent('updateDebugMessage', p.content);

                // generate table from debug content
                var html = "<table><caption>Stats for nerds</caption><tr>";
                var dataArray = [];
                var seq = 0;
                var max = 0;
                for (var i in p.content) {
                    html += '<th colspan="2">' + i + "</th>";
                    dataArray[seq * 2] = Object.keys(p.content[i]);
                    dataArray[seq * 2 + 1] = Object.values(p.content[i]);
                    max = Math.max(Object.keys(p.content[i]).length, max);
                    seq++;
                }
                html += "</tr>";
                for (var i = 0; i < max; i++) {
                    html += '<tr>';
                    for (var j = 0; j < seq; j++) {
                        if (dataArray[j * 2][i]) {
                            html += '<td>' + dataArray[j * 2][i] + '</td><td>' + dataArray[j * 2 + 1][i] + '</td>';
                        } else {
                            html += '<td></td><td></td>';
                        }
                    }
                    html += '</tr>';
                }
                html += '</table>';
                dom.debugDiv.innerHTML = html;
            },
            properties: {
                fps: 0,
                eps: 0,
                lastEvent: 0,
                userMsg: "",
                content: null,
            },
        },
        checkDevicePixelRatio: {
            enabled: true,
            interval: 100,
            func: function (p) {
                canvasProperties.dpiPercentage = canvasOperations.getPixelRatio(dom.canvasContext);
                if (canvasProperties.dpiPercentage !== p.lastdpiPercentage) {
                    // setSize(curSize);
                    onresize();
                    p.lastdpiPercentage = canvasProperties.dpiPercentage;
                }
            },
            properties: {},
        },
    };

    var initBackgroundProcesses = function () {
        for (var n in backgroundProcesses) {
            var p = backgroundProcesses[n];
            // create timed function for every background process
            p.timeFunc = (function (isForced) {
                if (this.func && (isForced || this.enabled)) this.func(this.properties);
                this.timer = window.setTimeout(this.timeFunc, this.interval);
            }).bind(p);
            // launch them asyncly
            p.timer = window.setTimeout(p.timeFunc, 1);
        }
    };

    var triggerBackgroundProcess = function (name) {
        window.clearTimeout(backgroundProcesses[name].timer);
        backgroundProcesses[name].timeFunc(true);
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
    // all objects whose attributes may be public accessable should be put in publicAccessibleObjects
    // then use publicProperties to define public name and its access route
    // use get('name') and set('name', 'newValue') outside
    var publicAccessibleObjects = {
        pen,
    };

    var publicProperties = {
        tool: 'pen.tool',
        size: 'pen.size',
        color: 'pen.color',
    };

    var get = function (property) {
        var path = publicProperties[property].split(".");
        var obj = publicAccessibleObjects;
        while (path.length) {
            obj = obj[path.shift()];
        }
        return obj;
    };

    var set = function (property, newValue) {
        var path = publicProperties[property].split(".");
        var obj = publicAccessibleObjects;
        while (path.length > 1) {
            obj = obj[path.shift()];
        }
        obj[path[0]] = newValue;
    };

    // debugging
    var calcEventRate = function () {
        window.setTimeout(function () {
            var current_time = performance.now();
            backgroundProcesses.refreshDebugMsg.properties.eps = (backgroundProcesses.refreshDebugMsg.properties.eps + 1000 / (current_time - backgroundProcesses.refreshDebugMsg.properties.lastEvent)) / 2;
            backgroundProcesses.refreshDebugMsg.properties.lastEvent = current_time;
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

    var draw = function (context, stroke) {
        if (!(tools[stroke.tool])) return;

        context.beginPath();

        context.moveTo(stroke.p0.x * canvasProperties.dpiPercentage, stroke.p0.y * canvasProperties.dpiPercentage);
        context.lineTo(stroke.p1.x * canvasProperties.dpiPercentage, stroke.p1.y * canvasProperties.dpiPercentage);

        context.strokeStyle = stroke.color;
        context.globalCompositeOperation = "source-over";
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = stroke.size * canvasProperties.dpiPercentage;
        if (tools[stroke.tool].setCanvasContextOption) {
            helper.objCopy(context, tools[stroke.tool].setCanvasContextOption());
        }

        context.closePath();
        context.stroke();
    };

    // when user inputs, draw instantly with a fake movement
    var instantDrawPoint = function (p) {
        // TODO: check mouse speed
        var fakeStroke = {
            p0: {
                x: p.x - 1,
                y: p.y,
            },
            p1: p,
            dpi: canvasProperties.dpiPercentage,
            zoom: canvasProperties.zoom,
            color: pen.color,
            tool: pen.tool,
            size: pen.size,
        };
        draw(dom.canvasContext, fakeStroke);
    };

    var instantDrawStroke = function (s) {
        draw(dom.canvasContext, s);
    }

    // user event processing
    var initUserEvents = function () {
        var getCurrentMousePointerPos = function (e) {
                return {
                    X: e.changedPointers[0].clientX,
                    Y: e.changedPointers[0].clientY,
                };
            },

            addClick = function (e) {
                calcEventRate();
                try {
                    var mouse = getCurrentMousePointerPos(e);
                    var currentPoint = {
                        x: mouse.X,
                        y: mouse.Y,
                    };
                    if (pen.down && events.lastPoint != null) {
                        var stroke = {
                            p0: {
                                x: events.lastPoint.x,
                                y: events.lastPoint.y,
                            },
                            p1: {
                                x: mouse.X,
                                y: mouse.Y,
                            },
                            dpi: canvasProperties.dpiPercentage,
                            zoom: canvasProperties.zoom,
                            color: pen.color,
                            tool: pen.tool,
                            size: pen.size,
                        };
                        triggerEvent('newStroke', stroke);
                        events.lastPoint = currentPoint;
                    } else if (pen.down) {
                        triggerEvent('newStartPoint', currentPoint);
                        events.lastPoint = currentPoint;
                    } else {
                        triggerEvent('newEndPoint', currentPoint);
                        events.lastPoint = null;
                    }
                } catch (ex) {
                }
            },

            penDown = function (e) {
                pen.down = true;
                addClick(e);
            },

            penMove = function (e) {
                addClick(e);
                // Prevent the whole page from dragging if on mobile
                e.preventDefault();
            },

            penUp = function (e) {
                // add new stroke
                addClick(e);
                pen.down = false;
                // trigger ending point
                addClick(e);
            },

            penCancel = function (e) {
                pen.down = false;
                addClick(e);
            };

        gestureRecognizer = new Hammer(dom.canvasContext.canvas);
        gestureRecognizer.get('pan').set({
            direction: Hammer.DIRECTION_ALL,
            threshold: 0,
        });
        gestureRecognizer.on('panstart', penDown);
        gestureRecognizer.on('panmove', penMove);
        gestureRecognizer.on('panend', penUp);
        gestureRecognizer.on('pancancel', penCancel);

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
        newStartPoint: [instantDrawPoint],
        newStroke: [instantDrawStroke],
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
        dom.debugDiv = document.createElement('div');
        dom.debugDiv.setAttribute('id', 'debug');
        dom.canvasDiv.appendChild(dom.debugDiv);
        dom.debugDiv.addEventListener('click', function () { dom.debugDiv.setAttribute('class', 'hide'); });

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