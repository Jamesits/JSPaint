var JSPaint = (function () {

    "use strict";

    var contexts = {},
        clickEvents = [],
        clickEventsListeners = [],
        lastRedrawPtr = 0,
        paint = false,
        curTool = "marker",
        curSize = 20,
        // drawingAreaX = 0,
        // drawingAreaY = 0,
        drawingAreaWidth,
        drawingAreaHeight,
        totalLoadResources = 1,
        curLoadResNum = 0,
        colorLayerData,
        outlineLayerData,
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

        matchOutlineColor = function (r, g, b, a) {

            return (r + g + b < 100 && a === 255);
        },

        matchStartColor = function (pixelPos, startR, startG, startB) {

            var r = outlineLayerData.data[pixelPos],
                g = outlineLayerData.data[pixelPos + 1],
                b = outlineLayerData.data[pixelPos + 2],
                a = outlineLayerData.data[pixelPos + 3];

            // If current pixel of the outline image is black
            if (matchOutlineColor(r, g, b, a)) {
                return false;
            }

            r = colorLayerData.data[pixelPos];
            g = colorLayerData.data[pixelPos + 1];
            b = colorLayerData.data[pixelPos + 2];

            // If the current pixel matches the clicked color
            if (r === startR && g === startG && b === startB) {
                return true;
            }

            // If current pixel matches the new color
            if (r === curColor.r && g === curColor.g && b === curColor.b) {
                return false;
            }

            // Return the difference in current color and start color within a tolerance
            return (Math.abs(r - startR) + Math.abs(g - startG) + Math.abs(b - startB) < 255);
        },

        colorPixel = function (pixelPos, r, g, b, a) {

            colorLayerData.data[pixelPos] = r;
            colorLayerData.data[pixelPos + 1] = g;
            colorLayerData.data[pixelPos + 2] = b;
            colorLayerData.data[pixelPos + 3] = a !== undefined ? a : 255;
        },

        floodFill = function (startX, startY, startR, startG, startB) {

            var newPos,
                x,
                y,
                pixelPos,
                reachLeft,
                reachRight,
                drawingBoundLeft = 0,
                drawingBoundTop = 0,
                drawingBoundRight = drawingAreaWidth - 1,
                drawingBoundBottom = drawingAreaHeight - 1,
                pixelStack = [
                    [startX, startY]
                ];

            while (pixelStack.length) {

                newPos = pixelStack.pop();
                x = newPos[0];
                y = newPos[1];

                // Get current pixel position
                pixelPos = (y * drawingAreaWidth + x) * 4;

                // Go up as long as the color matches and are inside the canvas
                while (y >= drawingBoundTop && matchStartColor(pixelPos, startR, startG, startB)) {
                    y -= 1;
                    pixelPos -= drawingAreaWidth * 4;
                }

                pixelPos += drawingAreaWidth * 4;
                y += 1;
                reachLeft = false;
                reachRight = false;

                // Go down as long as the color matches and in inside the canvas
                while (y <= drawingBoundBottom && matchStartColor(pixelPos, startR, startG, startB)) {
                    y += 1;

                    colorPixel(pixelPos, curColor.r, curColor.g, curColor.b);

                    if (x > drawingBoundLeft) {
                        if (matchStartColor(pixelPos - 4, startR, startG, startB)) {
                            if (!reachLeft) {
                                // Add pixel to stack
                                pixelStack.push([x - 1, y]);
                                reachLeft = true;
                            }
                        } else if (reachLeft) {
                            reachLeft = false;
                        }
                    }

                    if (x < drawingBoundRight) {
                        if (matchStartColor(pixelPos + 4, startR, startG, startB)) {
                            if (!reachRight) {
                                // Add pixel to stack
                                pixelStack.push([x + 1, y]);
                                reachRight = true;
                            }
                        } else if (reachRight) {
                            reachRight = false;
                        }
                    }

                    pixelPos += drawingAreaWidth * 4;
                }
            }
        },

        // Start painting with paint bucket tool starting from pixel specified by startX and startY
        paintAt = function (startX, startY) {

            var pixelPos = (startY * drawingAreaWidth + startX) * 4,
                r = colorLayerData.data[pixelPos],
                g = colorLayerData.data[pixelPos + 1],
                b = colorLayerData.data[pixelPos + 2],
                a = colorLayerData.data[pixelPos + 3];

            if (r === curColor.r && g === curColor.g && b === curColor.b) {
                // Return because trying to fill with the same color
                return;
            }

            if (matchOutlineColor(r, g, b, a)) {
                // Return because clicked outline
                return;
            }

            floodFill(startX, startY, r, g, b);

            redraw();
        },

        // Add mouse and touch event listeners to the canvas
        createUserEvents = function () {

            var

                getCurrentMousePointerPos = function (e) {
                    // var rect = contexts.outline.canvas.getBoundingClientRect();
                    // console.log(rect.top, rect.right, rect.bottom, rect.left);

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
                    if (curTool === "bucket") {
                        // Mouse click location on drawing area
                        paintAt(mouse.X, mouse.Y);
                    } else {
                        paint = true;
                        addClick(mouse.X, mouse.Y, false);
                    }

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

            var mc = new Hammer(contexts.outline.canvas);
            mc.get('pan').set({
                direction: Hammer.DIRECTION_ALL,
                threshold: 1,
            });
            mc.on('panstart', pressDrawing);
            mc.on('panmove', dragDrawing);
            mc.on('panend', releaseDrawing);
            mc.on('pancancel', cancelDrawing);

            window.addEventListener('resize', onresize);
        },

        // Calls the redraw function after all neccessary resources are loaded.
        resourceLoaded = function () {
            onresize();
            curLoadResNum += 1;
            if (curLoadResNum === totalLoadResources) {
                redraw();
                createUserEvents();
            }
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
