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
        canvasDrawRatio = 1,
        lastBackgroundFrame,
        debug = {
            fps: 0,
            userMsg: "",
        },
        debugTimer,
        redrawTimer,

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
            curSize = newSize;
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
                clickX: x,
                clickY: y,
                clickTool: curTool,
                clickColor: curColor,
                clickSize: curSize,
                clickDrag: dragging,
                canvasDrawRatio: canvasDrawRatio,
                timestamp: Date.now(),
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
            if (currentStroke.clickTool === "clear") return;
            canvasContext.beginPath();

            // If dragging then draw a line between the two points
            if (currentStroke.clickDrag && lastStroke && lastStroke.clickTool !== "clear") {
                canvasContext.moveTo(lastStroke.clickX * lastStroke.canvasDrawRatio, lastStroke.clickY * lastStroke.canvasDrawRatio);
            } else {
                // The x position is moved over one pixel so a circle even if not dragging
                canvasContext.moveTo(currentStroke.clickX * currentStroke.canvasDrawRatio - 1, currentStroke.clickY * currentStroke.canvasDrawRatio);
            }
            canvasContext.lineTo(currentStroke.clickX * currentStroke.canvasDrawRatio, currentStroke.clickY * currentStroke.canvasDrawRatio);

            if (currentStroke.clickTool === "eraser") {
                canvasContext.strokeStyle = 'white';
            } else {
                canvasContext.strokeStyle = currentStroke.clickColor;
            }

            canvasContext.lineCap = "round";
            canvasContext.lineJoin = "round";
            canvasContext.lineWidth = currentStroke.clickSize * currentStroke.canvasDrawRatio;
            canvasContext.closePath();
            canvasContext.stroke();
        },

        canvasAppend = function () {
            for (var currentRedrawPtr = lastRedrawPtr; currentRedrawPtr < clickEvents.length; currentRedrawPtr += 1) {
                draw(canvasContext, clickEvents[currentRedrawPtr], clickEvents[currentRedrawPtr - 1]);
            }
            clearClick();
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
            if (debug.fps == 0) {
                debug.fps = 1000 / (t1 - t0);
            } else {
                debug.fps = (debug.fps + 1000 / (t1 - t0)) / 2;
            }
        },

        autoRedraw = function () {
            redraw();
            redrawTimer = window.setTimeout(autoRedraw, 1/5);
        },

        // Add mouse and touch event listeners to the canvas
        createUserEvents = function () {
            var getCurrentMousePointerPos = function (e) {
                    return {
                        X: e.changedPointers[0].offsetX,
                        Y: e.changedPointers[0].offsetY,
                    };
                },

                pressDrawing = function (e) {
                    var mouse = getCurrentMousePointerPos(e);
                    paint = true;
                    addClick(mouse.X, mouse.Y, false);
                    canvasAppend();
                },

                dragDrawing = function (e) {
                    var mouse = getCurrentMousePointerPos(e);
                    if (paint) {
                        addClick(mouse.X, mouse.Y, true);
                        canvasAppend();
                    }
                    // Prevent the whole page from dragging if on mobile
                    e.preventDefault();
                },

                releaseDrawing = function () {
                    paint = false;
                    canvasAppend();
                },

                cancelDrawing = function () {
                    paint = false;
                };

            var gestureRecognizer = new Hammer(canvasContext.canvas);
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

        onresize = function (e) {
            canvasDrawRatio = getPixelRatio();
            drawingAreaWidth = canvasDiv.offsetWidth;
            drawingAreaHeight = canvasDiv.offsetHeight;
            canvasContext.canvas.width = canvasDiv.offsetWidth * canvasDrawRatio;
            canvasContext.canvas.height = canvasDiv.offsetHeight * canvasDrawRatio;
            bgCanvasContext.canvas.width = canvasDiv.offsetWidth * canvasDrawRatio;
            bgCanvasContext.canvas.height = canvasDiv.offsetHeight * canvasDrawRatio;
            if (e) redraw();
        },

        printDebugMsg = function () {
            var text = "FPS: " + debug.fps + " " + debug.userMsg;
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

            debugDiv = document.getElementById("debug");

            debugTimer = window.setInterval(printDebugMsg, 500);

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
        clearCanvas: clearCanvas,
        updateUserDebugMsg: updateUserDebugMsg,
        doInitialSync: doInitialSync,
    };
};
