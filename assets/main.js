function onReady() {
    // set up paint canvas
    p = JSPaint();
    p.init(document.getElementById('canvasDiv'));

    // set up sync service
    var config = { syncURL: "https://jspaint-test-jimu.wilddogio.com" };
    wilddog.initializeApp(config);
    var ref = wilddog.sync().ref("/canvas/0");
    var connectedRef = wilddog.sync().ref("/.info/connected");

    connectedRef.on("value", function (snap) {
        if (snap.val() === true) {
            p.updateUserDebugMsg("Online");
        } else {
            p.updateUserDebugMsg("Offline");
        }
    });

    // set up draw event listener
    p.addClickEventListener(function(e, f){
        ref.child("events").push(e);
        console.log(ref.child("events"));
    });

    // Initial update 
    // p.doInitialUpdate(ref.child("events"));
    
    
    window.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); return false; });
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
