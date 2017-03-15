var JSPaint = function () {

    "use strict";

    var canvasContext,
        canvasDiv,
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

        // Redraws the canvas.
        redraw = function () {

            // console.log("redraw", curTool, "last redraw to: ", lastRedrawPtr);

            if (clickEvents.length - lastRedrawPtr > 0) {

                // For each point drawn
                for (var i = 0; i < clickEvents.length - lastRedrawPtr; i += 1) {
                    var currentRedrawPtr = i + lastRedrawPtr;
                    // ignore out of canvas things
                    if (clickEvents[currentRedrawPtr].clickX <= drawingAreaWidth
                        && clickEvents[currentRedrawPtr].clickX >= 0
                        && clickEvents[currentRedrawPtr].clickY <= drawingAreaHeight
                        && clickEvents[currentRedrawPtr].clickY >= 0
                    ) {
                        canvasContext.beginPath();

                        // If dragging then draw a line between the two points
                        if (clickEvents[currentRedrawPtr].clickDrag && currentRedrawPtr) {
                            canvasContext.moveTo(clickEvents[currentRedrawPtr - 1].clickX, clickEvents[currentRedrawPtr - 1].clickY);
                        } else {
                            // The x position is moved over one pixel so a circle even if not dragging
                            canvasContext.moveTo(clickEvents[currentRedrawPtr].clickX - 1, clickEvents[currentRedrawPtr].clickY);
                        }
                        canvasContext.lineTo(clickEvents[currentRedrawPtr].clickX, clickEvents[currentRedrawPtr].clickY);

                        if (clickEvents[currentRedrawPtr].clickTool === "eraser") {
                            canvasContext.strokeStyle = 'white';
                        } else {
                            canvasContext.strokeStyle = clickEvents[currentRedrawPtr].clickColor;
                        }

                        canvasContext.lineCap = "round";
                        canvasContext.lineJoin = "round";
                        canvasContext.lineWidth = clickEvents[currentRedrawPtr].clickSize;
                        canvasContext.closePath();
                        canvasContext.stroke();
                    }
                }
            }
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
                    redraw();
                },

                dragDrawing = function (e) {
                    var mouse = getCurrentMousePointerPos(e);
                    if (paint) {
                        addClick(mouse.X, mouse.Y, true);
                        redraw();
                    }
                    // Prevent the whole page from dragging if on mobile
                    e.preventDefault();
                },

                releaseDrawing = function () {
                    paint = false;
                    redraw();
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
            redraw();
            createUserEvents();
        },

        addClickEventListener = function (f) {
            clickEventListeners.push(f);
        },

        onresize = function (e) {
            canvasDrawRatio = getPixelRatio();
            drawingAreaWidth = canvasDiv.offsetWidth;
            drawingAreaHeight = canvasDiv.offsetHeight;
            canvasContext.canvas.width = canvasDiv.offsetWidth;
            canvasContext.canvas.height = canvasDiv.offsetHeight;
            if (e) redraw();
        },

        init = function (element) {
            canvasDiv = element;
            var canvasElement;
            canvasElement = document.createElement('canvas');
            canvasElement.setAttribute('id', 'drawing');
            canvasElement.setAttribute('class', 'jspaint');
            canvasDiv.appendChild(canvasElement);
            if (typeof G_vmlCanvasManager !== "undefined") {
                canvasElement = G_vmlCanvasManager.initElement(canvasElement);
            }
            canvasContext = canvasElement.getContext("2d");
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
    };
};
