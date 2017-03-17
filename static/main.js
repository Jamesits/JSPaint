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
    var ws_location = (location.protocol.toLowerCase().startsWith("https")?"wss://":"ws://") + location.host + (location.pathname.endsWith('/') ? location.pathname.slice(0, -1) : location.pathname) + "/ws";

    var s = JSPaintSync(p, ws_location, {
        room: getURLParameter('room') || 0,
        id: uuid,
    });

    s.init();

    // disable context menu
    window.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
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
