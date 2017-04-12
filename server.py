import tornado.ioloop
import tornado.web
import tornado.websocket
import os
import time
import datetime
import json
import copy
import sys

from tornado.options import define, options, parse_command_line

define("port", default=80, help="run on the given port", type=int)

def getServerTimestamp():
    return int(time.time() * 1000)

def broadcastToRoom(room, message):
    for c_index in clients[room]:
        clients[room][c_index]["buffer"].append(message)

def nullHandler(client, message):
    pass

def pullHandler(client, message):
    clients[client.room][client.id]["buffer"] = room_history[client.room] + \
        clients[client.room][client.id]["buffer"]

def updateHandler(client, message):
    room_history[client.room].append(message)
    for c_index in clients[client.room]:
        c = clients[client.room][c_index]
        if c["id"] != client.id:
            c["buffer"].append(message)

def clearHandler(client, message):
    room_history[client.room] = list()
    for c_index in clients[client.room]:
        c = clients[client.room][c_index]
        c["buffer"] = list()
        c["object"].write_message("CLEAR " + str(getServerTimestamp()))


def pingHandler(client, message):
    client.write_message("PONG " + str(getServerTimestamp()))

# we gonna store clients in dictionary..
clients = dict()
room_history = dict()
commands = {
    "INIT": nullHandler,
    "PULL": pullHandler,
    "HELLO": nullHandler,
    "CLEAR": clearHandler,
    "PING": pingHandler,
}
push_interval = 0.01

class IndexHandler(tornado.web.RequestHandler):
    @tornado.web.asynchronous
    def get(self):
        self.render("index.html")

class WebSocketHandler(tornado.websocket.WebSocketHandler):
    def open(self, *args):
        self.room = self.get_argument("room")
        self.id = self.get_argument("id")
        self.stream.set_nodelay(True)
        print(str(getServerTimestamp()) +
              " CONNECT room {} id {}".format(self.room, self.id), file=sys.stderr)
        if self.room not in clients or self.room not in room_history:
            clients[self.room] = dict()
            room_history[self.room] = []
        clients[self.room][self.id] = {"id": self.id, "object": self, "buffer": []}
        broadcastToRoom(self.room, "ONLINE " + str(len(clients[self.room])))

    def on_message(self, message):
        """
        when we receive some message we want some message handler..
        for this example i will just print message to console
        """
        try:
            m = json.loads(message)
            m['serverTime'] = getServerTimestamp()
            m['clientId'] = self.id
            m['room'] = self.room
            print("UPDATE {}".format(m))
            updateHandler(self, m)
        except json.decoder.JSONDecodeError:
            command = message.split(" ")
            print(str(getServerTimestamp()) + " {} COMMAND {}".format(self.id, message))
            if len(command) >= 2:
                if command[0] in commands:
                    commands[command[0]](self, message)

    def on_close(self):
        print(str(getServerTimestamp()) +
              " BYE room {} id {}".format(self.room, self.id), file=sys.stderr)
        if self.id in clients[self.room]:
            del clients[self.room][self.id]
        broadcastToRoom(self.room, "ONLINE " + str(len(clients[self.room])))

    @classmethod
    def server_push(cls):
        for room in clients:
            for client in clients[room]:
                c = clients[room][client]
                while len(c["buffer"]) and c["object"] is not None:
                    print(str(getServerTimestamp()) + " PUSH {}, {} messages remaining".format(
                        c["id"],
                        len(c["buffer"])
                        ))
                    try:
                        msg = c["buffer"][0]
                        c["object"].write_message(msg)
                        c["buffer"].pop(0)
                    except WebSocketClosedError:
                        print(str(getServerTimestamp()) +
                              " ERROR: unable to send to {}".format(c["id"]), file=sys.stderr)

        # schedule next push
        tornado.ioloop.IOLoop.instance().add_timeout(
            datetime.timedelta(seconds=push_interval), WebSocketHandler.server_push)

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
        datetime.timedelta(seconds=push_interval), WebSocketHandler.server_push)
    print("Server listening on port {}...".format(options.port), file=sys.stderr)
    tornado.ioloop.IOLoop.instance().start()
