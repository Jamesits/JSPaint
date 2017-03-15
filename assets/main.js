function onReady() {
    // set up paint canvas
    p = JSPaint();
    p.init(document.getElementById('canvasDiv'));

    // set up sync service
    // var config = { syncURL: "https://jspaint-test-jimu.wilddogio.com" };
    // wilddog.initializeApp(config);
    // var ref = wilddog.sync().ref();

    // set up draw event listener
    p.addClickEventListener(function(e, f){
        console.log('event', e, f);
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
