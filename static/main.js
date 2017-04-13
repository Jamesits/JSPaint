var hasClass = function (el, className) {
    if (el) {
        if (el.classList)
            return el.classList.contains(className);
        else
            return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
    } else return false;
};

var addClass = function (el, className) {
    if (el.classList)
        el.classList.add(className);
    else if (!hasClass(el, className)) el.className += " " + className;
};

var removeClass = function (el, className) {
    if (el.classList)
        el.classList.remove(className);
    else if (hasClass(el, className)) {
        var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
        el.className = el.className.replace(reg, ' ');
    }
};

var resetEnabledButton = function () {
    var elems = document.getElementsByClassName('round-button');
    for (var i in elems) {
        if (elems.hasOwnProperty(i)) {
            removeClass(elems[i], 'round-button-selected');
        }
    }
};

var p;
var onReady = function () {

    "use strict";

    // check URL params
    var getURLParameter = function (name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
    }

    // set up paint canvas
    p = JSPaint();
    p.init(document.getElementById('canvasDiv'));

    // generate UUID for this client
    var uuid = localStorage.getItem('uuid');
    if (!uuid) {
        uuid = UUID.generate().toString();
        localStorage.setItem('uuid', uuid);
    }

    // WebSocket URL
    var ws_location = (location.protocol.toLowerCase().startsWith("https") ? "wss://" : "ws://") + location.host + (location.pathname.endsWith('/') ? location.pathname.slice(0, -1) : location.pathname) + "/ws";
    var room = getURLParameter('room') || "default";
    
    p.addEventListener('updateDebugMessage', function (e) {
        e.onepaper = {
            ws: ws_location,
            uuid: uuid,
            room: room,
        };
    })

    var s = JSPaintSync(p, ws_location, {
        room: room,
        id: uuid,
    });

    s.init();

    // disable context menu
    window.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });

    // bind toolbar events
    document.getElementById('black').addEventListener('click', function () { 
        p.set('tool', 'marker');
        p.set('color', '#000000');
        resetEnabledButton();
        addClass(document.getElementById('black'), 'round-button-selected');
    });
    document.getElementById('red').addEventListener('click', function () {
        p.set('tool', 'marker');
        p.set('color', '#FF0000');
        resetEnabledButton();
        addClass(document.getElementById('red'), 'round-button-selected');
    });
    document.getElementById('blue').addEventListener('click', function () {
        p.set('tool', 'marker');
        p.set('color', '#00FF00');
        resetEnabledButton();
        addClass(document.getElementById('blue'), 'round-button-selected');
    });
    document.getElementById('green').addEventListener('click', function () {
        p.set('tool', 'marker');
        p.set('color', '#0000FF');
        resetEnabledButton();
        addClass(document.getElementById('green'), 'round-button-selected');
    });
    document.getElementById('erase').addEventListener('click', function () {
        p.set('tool', 'eraser');
        resetEnabledButton();
        addClass(document.getElementById('erase'), 'round-button-selected');
    });
    document.getElementById('strokeSize').addEventListener('change', function () {
        p.set('size', this.value);
    });
    // document.getElementById('clear').addEventListener('click', function () {
    //     p.clearCanvas();
    // });
    document.getElementById('displaydebug').addEventListener('click', function () {
        document.getElementById('debug').setAttribute('class', 'show');
    });

    // hide debug panel
    document.getElementById('debug').setAttribute('class', 'hide');
};

(function ready(fn) {
    if (document.readyState != 'loading'){
        fn();
    } else if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        document.attachEvent('onreadystatechange', function() {
          if (document.readyState != 'loading')
              fn();
        });
    }
})(onReady);
