function onReady() {
    // set up paint canvas
    JSPaint.init();
    JSPaint.setColorFromRGB(255, 0, 0);
    JSPaint.setSize(2);

    // set up sync service
    // var config = { syncURL: "https://jspaint-test-jimu.wilddogio.com " };
    // wilddog.initializeApp(config);
    // var ref = wilddog.sync().ref();

    // set up draw event listener
    JSPaint.addClickEventListener(function(e){
        console.log('event', e);
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
