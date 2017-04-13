import tornado.ioloop
import tornado.web
import tornado.websocket
import os
import time
import datetime
import json
import copy
import sys
import re
import logging
import string
import signal

from tornado.options import define, options, parse_command_line

# we gonna store clients in dictionary..
clients = dict()
room_history = dict()
is_closing = False
delete_scheduled_rooms = []
# second
push_interval = 0.01
# ms
delete_room_interval = 5*1000

def signal_handler(signum, frame):
    global is_closing
    logging.info('exiting...')
    is_closing = True


define("port", default=80, help="run on the given port", type=int)

def getServerTimestamp():
    return int(time.time() * 1000)

def broadcastToRoom(room, message):
    for c_index in clients[room]:
        clients[room][c_index]["buffer"].append(message)

def saveRoom(room):
    filename = "history_{}_{}.json".format(room, getServerTimestamp())
    valid_chars = frozenset("-_.() %s%s" % (string.ascii_letters, string.digits))
    filename = ''.join(c for c in filename if c in valid_chars)
    logging.info("Saving room {} to file {}...".format(room, filename))
    with open(filename, 'w') as outfile:
        json.dump(room_history[room], outfile)

def deleteRoom():
    global delete_scheduled_rooms
    for i in delete_scheduled_rooms:
        if getServerTimestamp() - i[0] > delete_room_interval:
            saveRoom(i[1])
            logging.info("Deleting room {}...".format(i[1]))
            del clients[i[1]]
            del room_history[i[1]]
            delete_scheduled_rooms.remove(i)

    tornado.ioloop.IOLoop.instance().add_timeout(
        datetime.timedelta(seconds=5), deleteRoom)

def scheduleDeleteRoom(room):
    delete_scheduled_rooms.append((getServerTimestamp(), room))

def unscheduleDeleteRoom(room):
    global delete_scheduled_rooms
    delete_scheduled_rooms = list(filter(lambda x: x[1]!= room, delete_scheduled_rooms))

def nullHandler(client, message):
    pass

def initHandler(client, message):
    if client.room not in clients or client.room not in room_history:
        logging.info("Creating room {}...".format(client.room))
        clients[client.room] = dict()
        room_history[client.room] = []
    else:
        unscheduleDeleteRoom(client.room)
    clients[client.room][client.id] = {
        "id": client.id, "object": client, "buffer": []}
    broadcastToRoom(client.room, "ONLINE " + str(len(clients[client.room])))

def reconnectHandler(client, message):
    if client.room not in clients or client.room not in room_history or len(room_history[client.room]) == 0:
        # server restarted; client reconnecting
        logging.info("Room {} recreated, refreshing client...".format(client.room))
        # not sure how to implement this
        # client["buffer"].append("REFRESH")
    initHandler(client, message)

def pullHandler(client, message):
    clients[client.room][client.id]["buffer"] = room_history[client.room] + \
        clients[client.room][client.id]["buffer"]

def updateHandler(client, message):
    room_history[client.room].append(message)
    for c_index in clients[client.room]:
        c = clients[client.room][c_index]
        if c["id"] != client.id:
            c["buffer"].append(message)
        else:
            c["buffer"].append("CONFIRM " + str(message["cseq"]) + " " + str(message["stime"]))

def clearHandler(client, message):
    room_history[client.room] = list()
    for c_index in clients[client.room]:
        c = clients[client.room][c_index]
        c["buffer"] = list()
        c["object"].write_message("CLEAR " + str(getServerTimestamp()))


def pingHandler(client, message):
    client.write_message("PONG " + str(getServerTimestamp()))

def saveHandler(client, message):
    saveRoom(client.room)

commands = {
    "RECONNECT": reconnectHandler,
    "INIT": initHandler,
    "PULL": pullHandler,
    "HELLO": nullHandler,
    "CLEAR": clearHandler,
    "PING": pingHandler,
    "SAVE": saveHandler,
}

class IndexHandler(tornado.web.RequestHandler):
    @tornado.web.asynchronous
    def get(self):
        self.render("index.html")

class WebSocketHandler(tornado.websocket.WebSocketHandler):
    def open(self, *args):
        self.room = self.get_argument("room")
        self.id = self.get_argument("id")
        self.stream.set_nodelay(True)
        logging.info("CONNECT room {} id {}".format(self.room, self.id))

    def on_message(self, message):
        """
        when we receive some message we want some message handler..
        for this example i will just print message to console
        """
        try:
            m = json.loads(message)
            m['stime'] = getServerTimestamp()
            m['cid'] = self.id
            m['room'] = self.room
            logging.debug("UPDATE {}".format(m))
            updateHandler(self, m)
        except json.decoder.JSONDecodeError:
            command = message.split(" ")
            logging.debug("{} COMMAND {}".format(self.id, message))
            if len(command) >= 2:
                if command[0] in commands:
                    commands[command[0]](self, message)

    def on_close(self):
        logging.info("BYE room {} id {}".format(self.room, self.id))
        if self.room in clients and self.id in clients[self.room]:
            del clients[self.room][self.id]
        broadcastToRoom(self.room, "ONLINE " + str(len(clients[self.room])))
        if len(clients[self.room]) == 0:
            # nobody left
            scheduleDeleteRoom(self.room)

    @classmethod
    def server_push(cls):
        for room in clients:
            for client in clients[room]:
                c = clients[room][client]
                while len(c["buffer"]) and c["object"] is not None:
                    logging.debug("PUSH {}, {} messages remaining".format(
                        c["id"],
                        len(c["buffer"])
                        ))
                    try:
                        msg = c["buffer"][0]
                        c["object"].write_message(msg)
                        c["buffer"].pop(0)
                    except WebSocketClosedError:
                        logging.error("ERROR: unable to send to {}".format(c["id"]))

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


def try_exit():
    global is_closing
    if is_closing:
        for room in clients:
            saveRoom(room)
        tornado.ioloop.IOLoop.instance().stop()
        logging.info('exit success')

if __name__ == '__main__':
    signal.signal(signal.SIGINT, signal_handler)
    parse_command_line()
    app.listen(options.port)
    tornado.ioloop.PeriodicCallback(try_exit, 100).start()
    tornado.ioloop.IOLoop.instance().add_timeout(
        datetime.timedelta(seconds=5), deleteRoom)
    tornado.ioloop.IOLoop.instance().add_timeout(
        datetime.timedelta(seconds=push_interval), WebSocketHandler.server_push)
    logging.info("Server listening on port {}...".format(options.port))
    tornado.ioloop.IOLoop.instance().start()
