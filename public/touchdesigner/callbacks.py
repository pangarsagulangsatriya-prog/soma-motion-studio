"""Callbacks for webserver1. Installed by install_soma.py."""
import json

def receiver(dat):
    return dat.parent().fetch('soma_receiver')

def onHTTPRequest(dat, request, response):
    response['statusCode'] = 403
    response['statusReason'] = 'Forbidden'
    response['data'] = 'SOMA local WebSocket receiver'
    return response

def onWebSocketOpen(dat, client):
    pass

def onWebSocketReceiveText(dat, client, data):
    r = receiver(dat)
    try:
        reply = r.receive(client, data)
        if reply:
            dat.webSocketSendText(client, json.dumps(reply))
    except (ValueError, TypeError, KeyError):
        r.close(client)
        dat.webSocketClose(client)

def onWebSocketClose(dat, client):
    receiver(dat).close(client)

def onWebSocketReceiveBinary(dat, client, data):
    receiver(dat).close(client)
    dat.webSocketClose(client)

def onWebSocketReceivePing(dat, client, data):
    dat.webSocketSendPong(client, data)

def onServerStop(dat):
    r = receiver(dat)
    r.close(r.client)
