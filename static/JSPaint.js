var JSPaint = function () {

    "use strict";

    var canvasContext,
        canvasDiv,
        bgCanvasContext,
        debugDiv,
        clickEvents = [],
        clickEventListeners = [],
        lastRedrawPtr = 0,
        gestureRecognizer,
        paint = false,
        curTool = "marker",
        curSize = 2,
        drawingAreaWidth,
        drawingAreaHeight,
        curColor = "#000000",
        lastdpiPercentage = 1,
        dpiPercentage = 1,
        bgRefresh = false,
        bgRefreshInterval = 500,
        debugMsgRefreshInterval = 500,
        pixelRatioCheckInterval = 100,
        lastBackgroundFrame,
        debug = {
            fps: 0,
            eps: 0,
            lastEvent: 0,
            userMsg: "",
        },
        debugTimer,
        redrawTimer,
        devicePixelRatioCheckTimer,

        setTool = function (newTool) {
            curTool = newTool;
        },

        setColor = function (newColor) {
            curColor = newColor;
        },

        setColorFromRGB = function (r, g, b) {
            curColor = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        },

        setSize = function (newSize) {
            curSize = newSize / lastdpiPercentage * dpiPercentage;
        },

        getPixelRatio = function () {
            var backingStore = canvasContext.backingStorePixelRatio ||
                canvasContext.webkitBackingStorePixelRatio ||
                canvasContext.mozBackingStorePixelRatio ||
                canvasContext.msBackingStorePixelRatio ||
                canvasContext.oBackingStorePixelRatio ||
                canvasContext.backingStorePixelRatio || 1;

            return (window.devicePixelRatio || 1) / backingStore;
        },

        addClick = function (x, y, dragging) {
            event = {
                x: x,
                y: y,
                tool: curTool,
                color: curColor,
                size: curSize,
                draw: dragging,
                dpiPercentage: dpiPercentage,
                clientTime: Date.now(),
            };
            clickEvents.push(event);
            for (var i in clickEventListeners) {
                clickEventListeners[i](event, clickEvents);
            }
        },

        clearClick = function () {
            // clickEvents = [clickEvents[clickEvents - 1]];
            lastRedrawPtr = clickEvents.length;
        },

        draw = function (canvasContext, currentStroke, lastStroke) {
            if (currentStroke.tool === "clear") return;
            canvasContext.beginPath();

            // If dragging then draw a line between the two points
            if (currentStroke.draw && lastStroke && lastStroke.tool !== "clear") {
                canvasContext.moveTo(lastStroke.x * dpiPercentage, lastStroke.y * dpiPercentage);
            } else {
                // The x position is moved over one pixel so a circle even if not dragging
                canvasContext.moveTo((currentStroke.x - 1) * dpiPercentage, currentStroke.y * dpiPercentage);
            }
            canvasContext.lineTo(currentStroke.x * dpiPercentage, currentStroke.y * dpiPercentage);

            if (currentStroke.tool === "eraser") {
                canvasContext.strokeStyle = 'white';
            } else {
                canvasContext.strokeStyle = currentStroke.color;
            }

            canvasContext.lineCap = "round";
            canvasContext.lineJoin = "round";
            canvasContext.lineWidth = currentStroke.size / currentStroke.dpiPercentage * dpiPercentage;
            canvasContext.closePath();
            canvasContext.stroke();
        },

        canvasAppend = function () {
            for (var currentRedrawPtr = lastRedrawPtr; currentRedrawPtr < clickEvents.length; currentRedrawPtr += 1) {
                draw(canvasContext, clickEvents[currentRedrawPtr], clickEvents[currentRedrawPtr - 1]);
                lastRedrawPtr++;
            }
        },

        // Redraws the canvas.
        redraw = function () {
            var t0 = performance.now();
            // console.log("redraw", curTool, "last redraw to: ", lastRedrawPtr);

            if (clickEvents.length > 0) {

                // For each point drawn
                for (var currentRedrawPtr = 0; currentRedrawPtr < clickEvents.length; currentRedrawPtr += 1) {
                    draw(bgCanvasContext, clickEvents[currentRedrawPtr], clickEvents[currentRedrawPtr - 1]);
                }
            }

            lastBackgroundFrame = bgCanvasContext.getImageData(0, 0, bgCanvasContext.canvas.width, bgCanvasContext.canvas.height);
            canvasContext.putImageData(lastBackgroundFrame, 0, 0);
            var t1 = performance.now();
            debug.fps = (debug.fps + 1000 / (t1 - t0)) / 2;
        },

        autoRedraw = async function () {
            if (bgRefresh) redraw();
            redrawTimer = window.setTimeout(autoRedraw, bgRefreshInterval);
        },

        calcEventRate = async function() {
            var current_time = performance.now();
            debug.eps = (debug.eps + 1000 / (current_time - debug.lastEvent)) / 2;
            debug.lastEvent = current_time;
        },

        // Add mouse and touch event listeners to the canvas
        createUserEvents = function () {
            var getCurrentMousePointerPos = function (e) {
                    return {
                        X: e.changedPointers[0].clientX,
                        Y: e.changedPointers[0].clientY,
                    };
                },

                pressDrawing = function (e) {
                    calcEventRate();
                    var mouse = getCurrentMousePointerPos(e);
                    paint = true;
                    addClick(mouse.X, mouse.Y, false);
                    canvasAppend();
                },

                dragDrawing = function (e) {
                    calcEventRate();
                    var mouse = getCurrentMousePointerPos(e);
                    if (paint) {
                        addClick(mouse.X, mouse.Y, true);
                        canvasAppend();
                    }
                    // Prevent the whole page from dragging if on mobile
                    e.preventDefault();
                },

                releaseDrawing = function () {
                    calcEventRate();
                    paint = false;
                    canvasAppend();
                },

                cancelDrawing = function () {
                    calcEventRate();
                    paint = false;
                };

            gestureRecognizer = new Hammer(canvasContext.canvas);
            gestureRecognizer.get('pan').set({
                direction: Hammer.DIRECTION_ALL,
                threshold: 1,
            });
            gestureRecognizer.on('panstart', pressDrawing);
            gestureRecognizer.on('panmove', dragDrawing);
            gestureRecognizer.on('panend', releaseDrawing);
            gestureRecognizer.on('pancancel', cancelDrawing);

            window.addEventListener('resize', onresize);
        },

        // Calls the redraw function after all neccessary resources are loaded.
        resourceLoaded = function () {
            onresize();
            autoRedraw();
            createUserEvents();
        },

        addClickEventListener = function (f) {
            clickEventListeners.push(f);
        },

        clearClickEventListener = function () {
            clickEventListeners.length = 0;
        },

        checkPixelRatioChange = function () {
            dpiPercentage = getPixelRatio();
            if (dpiPercentage !== lastdpiPercentage) {
                setSize(curSize);
                onresize();
                lastdpiPercentage = dpiPercentage;
            }
        },

        onresize = function (e) {
            dpiPercentage = getPixelRatio();
            drawingAreaWidth = canvasDiv.offsetWidth;
            drawingAreaHeight = canvasDiv.offsetHeight;
            canvasContext.canvas.width = canvasDiv.offsetWidth * dpiPercentage;
            canvasContext.canvas.height = canvasDiv.offsetHeight * dpiPercentage;
            bgCanvasContext.canvas.width = canvasDiv.offsetWidth * dpiPercentage;
            bgCanvasContext.canvas.height = canvasDiv.offsetHeight * dpiPercentage;
            if (e) redraw();
        },

        printDebugMsg = function () {
            var text = "EPS: " + debug.eps.toFixed(2) + (bgRefresh ? " Optimal FPS: " + debug.fps.toFixed(2) + " Refresh Interval: " + bgRefreshInterval.toFixed(2) + "ms" : " Refresh Disabled") + " Ratio: " + dpiPercentage + " Strokes: " + clickEvents.length + " " + debug.userMsg;
            debugDiv.innerHTML = text;
        },

        updateUserDebugMsg = function (text) {
            debug.userMsg = text;
        },

        clearCanvas = function () {
            clickEvents.length = 0;
            lastRedrawPtr = 0;
            canvasContext.clearRect(0, 0, canvasContext.canvas.width, canvasContext.canvas.height);
            bgCanvasContext.clearRect(0, 0, bgCanvasContext.canvas.width, bgCanvasContext.canvas.height);
            for (var i in clickEventListeners) {
                clickEventListeners[i](event, clickEvents);
            }
            //redraw();
        },

        doInitialSync = function (events) {

        },

        autoRefresh = function (status) {
            if (status !== undefined) bgRefresh = !!status;
            return bgRefresh;
        },

        init = function (element) {
            canvasDiv = element;
            var canvasElement;

            // create visible canvas
            canvasElement = document.createElement('canvas');
            canvasElement.setAttribute('id', 'drawing');
            canvasElement.setAttribute('class', 'jspaint');
            canvasDiv.appendChild(canvasElement);
            if (typeof G_vmlCanvasManager !== "undefined") {
                canvasElement = G_vmlCanvasManager.initElement(canvasElement);
            }
            canvasContext = canvasElement.getContext("2d");

            // create background canvas
            canvasElement = document.createElement('canvas');
            canvasElement.setAttribute('id', 'bgdrawing');
            canvasElement.setAttribute('class', 'background');
            canvasDiv.appendChild(canvasElement);
            if (typeof G_vmlCanvasManager !== "undefined") {
                canvasElement = G_vmlCanvasManager.initElement(canvasElement);
            }
            bgCanvasContext = canvasElement.getContext("2d");

            // check pixel ratio change
            devicePixelRatioCheckTimer = window.setInterval(checkPixelRatioChange, pixelRatioCheckInterval);

            debugDiv = document.getElementById("debug");
            debugTimer = window.setInterval(printDebugMsg, debugMsgRefreshInterval);

            resourceLoaded();
        };

    return {
        init: init,
        redraw: redraw,
        setTool: setTool,
        setColor: setColor,
        setColorFromRGB: setColorFromRGB,
        setSize: setSize,
        addClickEventListener: addClickEventListener,
        clearClickEventListener: clearClickEventListener,
        clearCanvas: clearCanvas,
        updateUserDebugMsg: updateUserDebugMsg,
        doInitialSync: doInitialSync,
        autoRefresh: autoRefresh,
    };
};