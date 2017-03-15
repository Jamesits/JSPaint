function onReady() {
    // set up paint canvas
    p = JSPaint();
    p.init(document.getElementById('canvasDiv'));

    // set up draw event listener
    p.addClickEventListener(function(e, f){

    });

    // disable context menu
    window.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
}

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
