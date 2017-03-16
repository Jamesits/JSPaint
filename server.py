import tornado.ioloop
import tornado.web
import tornado.websocket
import os
import time
import json

from tornado.options import define, options, parse_command_line

define("port", default=8888, help="run on the given port", type=int)

# we gonna store clients in dictionary..
clients = dict()

class IndexHandler(tornado.web.RequestHandler):
    @tornado.web.asynchronous
    def get(self):
        # self.write("This is your response")
        self.render("index.html")
        # we don't need self.finish() because self.render() is fallowed by
        # self.finish() inside tornado
        # self.finish()

class WebSocketHandler(tornado.websocket.WebSocketHandler):
    def open(self, *args):
        self.room = self.get_argument("room")
        self.id = self.get_argument("id")
        self.stream.set_nodelay(True)
        print("HELLO room {} id {}".format(self.room, self.id))
        if self.room not in clients:
            clients[self.room] = dict()
        clients[self.room][self.id] = {"id": self.id, "object": self}

    def on_message(self, message):
        """
        when we receive some message we want some message handler..
        for this example i will just print message to console
        """
        m = json.loads(message)
        m['serverTime'] = int(time.time() * 1000)
        m['clientId'] = self.id
        m['room'] = self.room
        print("UPDATE {}".format(m))

    def on_close(self):
        print("BYE")
        if self.id in clients[self.room]:
            del clients[self.room][self.id]

settings = {
    "static_path": os.path.join(os.path.dirname(__file__), "static")
}

app = tornado.web.Application([
    (r'/', IndexHandler),
    (r'/ws', WebSocketHandler),
], **settings)

if __name__ == '__main__':
    parse_command_line()
    app.listen(options.port)
    tornado.ioloop.IOLoop.instance().start()
