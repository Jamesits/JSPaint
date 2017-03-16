FROM ubuntu:latest
MAINTAINER James Swineson <jamesswineson@gmail.com>

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y git python3 python3-pip\
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/{{lib,share}/locale,share/{man,doc,info,gnome/help,cracklib,il8n},{lib,lib64}/gconv,bin/localedef,sbin/build-locale-archive}

RUN pip3 install --upgrade pip \
    && pip3 install tornado

WORKDIR /usr/local/src/JSPaint
ADD ./ ./

EXPOSE 80
CMD ["/usr/bin/python3.5", "/usr/local/src/JSPaint/server.py"]