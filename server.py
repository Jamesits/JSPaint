import tornado.ioloop
import tornado.web
import tornado.websocket
import os
import time
import datetime
import json
import copy

from tornado.options import define, options, parse_command_line

define("port", default=8888, help="run on the given port", type=int)

def nullHandler(client, message):
    pass

def pullHandler(client, message):
    clients[client.room][client.id]["buffer"] = room_history[client.room] + \
        clients[client.room][client.id]["buffer"]

def updateHandler(client, message):
    room_history[client.room].append(message)
    for c_index in clients[client.room]:
        c = clients[client.room][c_index]
        if not (c["id"] == client.id):
            c["buffer"].append(message)

# we gonna store clients in dictionary..
clients = dict()
room_history = dict()
commands = {
    "INIT": nullHandler,
    "PULL": pullHandler,
    "HELLO": nullHandler,
}

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
        print("CONNECT room {} id {}".format(self.room, self.id))
        if self.room not in clients or self.room not in room_history:
            clients[self.room] = dict()
            room_history[self.room] = []
        clients[self.room][self.id] = {"id": self.id, "object": self, "buffer": []}

    def on_message(self, message):
        """
        when we receive some message we want some message handler..
        for this example i will just print message to console
        """
        try:
            m = json.loads(message)
            m['serverTime'] = int(time.time() * 1000)
            m['clientId'] = self.id
            m['room'] = self.room
            print("UPDATE {}".format(m))
            updateHandler(self, message)
        except json.decoder.JSONDecodeError:
            print("COMMAND {} from {}".format(message, self.id))
            if message in commands:
                commands[message](self, message)
            

    def on_close(self):
        print("BYE")
        if self.id in clients[self.room]:
            del clients[self.room][self.id]

    @classmethod
    def server_push(cls):
        print("PUSH")
        for room in clients:
            for client in clients[room]:
                c = clients[room][client]
                while len(c["buffer"]):
                    print("PUSH {}, {} messages remaining".format(c["id"],
                    len(c["buffer"])))
                    c["object"].write_message(c["buffer"].pop(0))
        # schedule next push
        tornado.ioloop.IOLoop.instance().add_timeout(
            datetime.timedelta(seconds=1), WebSocketHandler.server_push)

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
    tornado.ioloop.IOLoop.instance().add_timeout(
        datetime.timedelta(seconds=1), WebSocketHandler.server_push)
    tornado.ioloop.IOLoop.instance().start()
