var JSPaint = (function () {

    "use strict";

    var contexts = {},
        clickEvents = [],
        clickEventsListeners = [],
        lastRedrawPtr = 0,
        gestureRecognizer,
        paint = false,
        curTool = "marker",
        curSize = 20,
        drawingAreaWidth,
        drawingAreaHeight,
        colorPurple = {
            r: 203,
            g: 53,
            b: 148
        },
        colorGreen = {
            r: 101,
            g: 155,
            b: 65
        },
        colorYellow = {
            r: 255,
            g: 207,
            b: 51
        },
        colorBrown = {
            r: 152,
            g: 105,
            b: 40
        },
        curColor = colorGreen,

        setTool = function (newTool) {
            curTool = newTool;
        },

        setColor = function (newColor) {
            curColor = newColor;
        },

        setColorFromRGB = function (r, g, b) {
            curColor.r = r;
            curColor.g = g;
            curColor.b = b;
        },

        setSize = function (newSize) {
            curSize = newSize;
        },

        addClick = function (x, y, dragging) {
            event = {
                clickX: x,
                clickY: y,
                clickTool: curTool,
                clickColor: curColor,
                clickSize: curSize,
                clickDrag: dragging,
                timestamp: Date.now(),
            };
            clickEvents.push(event);
            for (var i in clickEventsListeners) {
                clickEventsListeners[i](event, clickEvents);
            }
            // console.log(event);
        },

        clearClick = function () {
            // clickEvents = [clickEvents[clickEvents - 1]];
            lastRedrawPtr = clickEvents.length;
        },

        // Redraws the canvas.
        redraw = function () {

            var locX,
                locY,
                radius,
                i,
                selected;

            // console.log("redraw", curTool, "last redraw to: ", lastRedrawPtr);

            if (clickEvents.length - lastRedrawPtr > 0) {

                // For each point drawn
                for (i = 0; i < clickEvents.length - lastRedrawPtr; i += 1) {
                    var currentRedrawPtr = i + lastRedrawPtr;

                    contexts.drawing.beginPath();

                    // Set the drawing radius
                    radius = clickEvents[currentRedrawPtr].clickSize;

                    // If dragging then draw a line between the two points
                    if (clickEvents[currentRedrawPtr].clickDrag && currentRedrawPtr) {
                        contexts.drawing.moveTo(clickEvents[currentRedrawPtr - 1].clickX, clickEvents[currentRedrawPtr - 1].clickY);
                    } else {
                        // The x position is moved over one pixel so a circle even if not dragging
                        contexts.drawing.moveTo(clickEvents[currentRedrawPtr].clickX - 1, clickEvents[currentRedrawPtr].clickY);
                    }
                    contexts.drawing.lineTo(clickEvents[currentRedrawPtr].clickX, clickEvents[currentRedrawPtr].clickY);

                    // Set the drawing color
                    if (curTool === "eraser") {
                        contexts.drawing.strokeStyle = 'white';
                    } else {
                        contexts.drawing.strokeStyle = "rgb(" + clickEvents[currentRedrawPtr].clickColor.r + ", " + clickEvents[currentRedrawPtr].clickColor.g + ", " + clickEvents[currentRedrawPtr].clickColor.b + ")";
                    }

                    contexts.drawing.lineCap = "round";
                    contexts.drawing.lineJoin = "round";
                    contexts.drawing.lineWidth = radius;
                    contexts.drawing.stroke();
                    contexts.drawing.closePath();
                }
            }

        },

        // Add mouse and touch event listeners to the canvas
        createUserEvents = function () {

            var

                getCurrentMousePointerPos = function (e) {
                    return {
                        X: e.changedPointers[0].offsetX,
                        Y: e.changedPointers[0].offsetY,
                    };
                },

                pressDrawing = function (e) {
                    // Mouse down location
                    var mouse = getCurrentMousePointerPos(e);
                    // console.log("pressDrawing", mouse.X, mouse.Y);
                    // console.log(e);
                    paint = true;
                    addClick(mouse.X, mouse.Y, false);

                    redraw();
                },

                dragDrawing = function (e) {
                    var mouse = getCurrentMousePointerPos(e);
                    // console.log("dragDrawing", mouse.X, mouse.Y);
                    // console.log(e);
                    if (curTool !== "bucket") {
                        if (paint) {
                            addClick(mouse.X, mouse.Y, true);
                            redraw();
                        }
                    }

                    // Prevent the whole page from dragging if on mobile
                    e.preventDefault();
                },

                releaseDrawing = function () {
                    // console.log("releaseDrawing");
                    if (curTool !== "bucket") {
                        paint = false;
                        redraw();
                    }
                },

                cancelDrawing = function () {
                    console.log("cancleDrawing");
                    if (curTool === "bucket") {
                        paint = false;
                    }
                };

            var gestureRecognizer = new Hammer(contexts.outline.canvas);
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
            clickEventsListeners.push(f);
        },

        onresize = function() {
            drawingAreaWidth = contexts.drawing.offsetX;
            drawingAreaHeight = contexts.drawing.offsetY;
        },

        // Creates a canvas element, loads images, adds events, and draws the canvas for the first time.
        init = function () {
            var canvasElement;

            canvasElement = document.createElement('canvas');
            // canvasElement.setAttribute('width', drawingAreaWidth);
            // canvasElement.setAttribute('height', drawingAreaHeight);
            canvasElement.setAttribute('id', 'drawing');
            canvasElement.setAttribute('class', 'jspaint');
            // canvasElement.style.marginLeft = drawingAreaX + "px";
            // canvasElement.style.marginTop = drawingAreaY + "px";
            document.getElementById('canvasDiv').appendChild(canvasElement);
            if (typeof G_vmlCanvasManager !== "undefined") {
                canvasElement = G_vmlCanvasManager.initElement(canvasElement);
            }
            contexts.drawing = canvasElement.getContext("2d"); // Grab the 2d canvas context

            canvasElement = document.createElement('canvas');
            // canvasElement.setAttribute('width', drawingAreaWidth);
            // canvasElement.setAttribute('height', drawingAreaHeight);
            canvasElement.setAttribute('id', 'outline');
            canvasElement.setAttribute('class', 'jspaint');
            // canvasElement.style.marginLeft = drawingAreaX + "px";
            // canvasElement.style.marginTop = drawingAreaY + "px";
            document.getElementById('canvasDiv').appendChild(canvasElement);
            if (typeof G_vmlCanvasManager !== "undefined") {
                canvasElement = G_vmlCanvasManager.initElement(canvasElement);
            }
            contexts.outline = canvasElement.getContext("2d"); // Grab the 2d canvas context

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
}());
