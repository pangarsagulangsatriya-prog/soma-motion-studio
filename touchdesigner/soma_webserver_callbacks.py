"""SOMA TD Bridge v1 — paste this file into a Web Server DAT callbacks Text DAT.

Set Web Server DAT Local Address=127.0.0.1, Port=8765, Active=On.
A session token is regenerated when the server starts:
    op('webserver1').fetch('soma_token')
Never expose this Web Server DAT directly on the internet or enable physical light here.
"""
import json
import math
import secrets
import time

SCHEMA = 'soma.td-bridge'
VERSION = 1
MAX_SIZE = 16384
SOURCE = ('camera', 'phone', 'video', 'simulator', 'touch')
KINDS = ('contact', 'slide', 'pivot', 'release', 'presence', 'movement', 'lift')
BASIS = ('calibrated-estimate', 'image-2d', 'simulated', 'presence-only')


def _initial():
    return {'clients': {}, 'state': None, 'state_monotonic': 0.0,
            'blackout': True, 'cue': None, 'pulses': {}, 'last_event_ids': [],
            'event_ids': set(), 'last_event': None, 'last_test': None}


def _data(dat):
    result = dat.fetch('soma_bridge', None)
    if not isinstance(result, dict):
        result = _initial()
        dat.store('soma_bridge', result)
    return result


def _blackout(data):
    data['blackout'] = True
    data['state'] = None
    data['pulses'] = {}
    data['state_monotonic'] = 0.0


def _safe_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _bounded(value):
    return _safe_number(value) and 0 <= value <= 1


def _send(dat, client, message):
    dat.webSocketSendText(client, json.dumps(message, separators=(',', ':')))


def onServerStart(dat):
    dat.store('soma_token', secrets.token_urlsafe(24))
    dat.store('soma_bridge', _initial())
    return


def onServerStop(dat):
    _blackout(_data(dat))
    return


def onHTTPRequest(dat, request, response):
    response['statusCode'] = 404
    response['statusReason'] = 'Not Found'
    response['data'] = 'SOMA TouchDesigner WebSocket only'
    return response


def onWebSocketOpen(dat, client, uri):
    if uri not in ('/', ''):
        dat.webSocketClose(client)
    return


def onWebSocketClose(dat, client):
    data = _data(dat)
    if client in data['clients']:
        del data['clients'][client]
        _blackout(data)
    return


def onWebSocketReceiveText(dat, client, message):
    data = _data(dat)
    if not isinstance(message, str) or len(message) > MAX_SIZE:
        dat.webSocketClose(client)
        return
    try:
        packet = json.loads(message)
    except (TypeError, ValueError):
        return
    if not isinstance(packet, dict) or packet.get('schema') != SCHEMA or packet.get('version') != VERSION:
        return
    kind = packet.get('type')
    if kind == 'hello':
        token = packet.get('token')
        expected = dat.fetch('soma_token', '')
        session = packet.get('sessionId')
        nonce = packet.get('nonce')
        if (not isinstance(token, str) or not isinstance(expected, str) or not expected or
                not secrets.compare_digest(token, expected) or
                not isinstance(session, str) or len(session) > 100 or not session.startswith('soma-') or
                not isinstance(nonce, str) or len(nonce) > 100):
            dat.webSocketClose(client)
            return
        # One performance session at a time. Another client cannot take the stage silently.
        for old_client in list(data['clients']):
            if old_client != client:
                dat.webSocketClose(old_client)
                del data['clients'][old_client]
        _blackout(data)
        data['event_ids'].clear()
        data['last_event_ids'].clear()
        data['clients'][client] = {'session': session, 'seq': 0, 'generation': -1,
                                   'last_seen': time.monotonic()}
        _send(dat, client, {'schema': SCHEMA, 'version': VERSION, 'type': 'hello-ack',
                            'sessionId': session, 'nonce': nonce})
        return
    current = data['clients'].get(client)
    if current is None or packet.get('sessionId') != current['session']:
        return
    seq = packet.get('seq')
    gen = packet.get('generation')
    if (not isinstance(seq, int) or isinstance(seq, bool) or seq <= current['seq'] or
            not isinstance(gen, int) or isinstance(gen, bool) or gen < 0):
        return
    if gen < current['generation']:
        return
    current['seq'] = seq
    current['last_seen'] = time.monotonic()
    if gen > current['generation']:
        current['generation'] = gen
        _blackout(data)
        data['event_ids'].clear()
        data['last_event_ids'].clear()
    if kind == 'heartbeat':
        return
    if kind == 'control':
        action = packet.get('action')
        if action in ('blackout', 'reset', 'stop'):
            _blackout(data)
        elif action == 'cue':
            cue = packet.get('cue')
            if isinstance(cue, dict) and isinstance(cue.get('index'), int) and 0 < cue['index'] <= 8:
                data['cue'] = {'index': cue['index'], 'label': str(cue.get('label', ''))[:44]}
        return
    if kind == 'state':
        if packet.get('source') not in SOURCE or packet.get('mode') not in ('live', 'rehearsal'):
            return
        if packet.get('coordinateSpace') not in ('floor-uv', 'image-uv', 'simulated-floor-uv'):
            return
        actors = packet.get('actors')
        if not isinstance(actors, list) or len(actors) > 2:
            return
        clean = []
        for actor in actors:
            if not isinstance(actor, dict):
                return
            identity = actor.get('id')
            if identity not in ('A', 'B', 'performer-1'):
                return
            feet = actor.get('feet')
            if not isinstance(feet, dict):
                return
            allowed = {}
            for side in ('left', 'right'):
                foot = feet.get(side)
                if foot is None:
                    allowed[side] = None
                    continue
                if (not isinstance(foot, dict) or not _bounded(foot.get('x')) or
                        not _bounded(foot.get('y')) or not _bounded(foot.get('confidence')) or
                        foot.get('coordinateBasis') not in BASIS or
                        foot.get('status') not in ('contact', 'slide', 'pivot', 'release', 'movement', None)):
                    return
                heading = foot.get('headingRad')
                if heading is not None and not _safe_number(heading):
                    return
                allowed[side] = {key: foot.get(key) for key in
                                 ('x', 'y', 'confidence', 'coordinateBasis', 'status', 'headingRad')}
            clean.append({'id': identity, 'feet': allowed})
        data['state'] = {'actors': clean, 'source': packet['source'], 'mode': packet['mode'],
                         'coordinateSpace': packet['coordinateSpace']}
        data['state_monotonic'] = time.monotonic()
        data['blackout'] = False
        # Data only; manual projector gate is separate and starts OFF.
        return
    if kind == 'event':
        event = packet.get('event')
        if not isinstance(event, dict) or event.get('kind') not in KINDS or \
                event.get('foot') not in ('left', 'right') or \
                event.get('actorId') not in ('A', 'B', 'performer-1') or \
                event.get('coordinateBasis') not in BASIS or \
                not _bounded(event.get('x')) or not _bounded(event.get('y')) or \
                not _bounded(event.get('confidence')):
            return
        is_test = packet.get('test') is True
        if not is_test and (data['state'] is None or time.monotonic() - data['state_monotonic'] > 1.0):
            return
        if event.get('kind') == 'contact' and event.get('verified') is not True:
            return
        event_id = event.get('eventId')
        if not isinstance(event_id, str) or len(event_id) > 500:
            return
        if event_id in data['event_ids']:
            return
        data['event_ids'].add(event_id)
        data['last_event_ids'].append(event_id)
        if len(data['last_event_ids']) > 1200:
            data['event_ids'].discard(data['last_event_ids'].pop(0))
        data['last_event'] = event
        if is_test:
            data['last_test'] = event_id
        # Short pulse can feed a Trigger CHOP. It does not authorize physical light.
        key = 'contact_{}_{}'.format(event['actorId'], event['foot'][0].upper())
        if event['kind'] != 'contact':
            key = '{}_{}_{}'.format(event['kind'], event['actorId'], event['foot'][0].upper())
        data['pulses'][key] = time.monotonic() + 0.15
        return


def onWebSocketReceiveBinary(dat, client, message):
    return


def onWebSocketReceivePing(dat, client, payload):
    dat.webSocketSendPong(client, data=payload)
    return


def onWebSocketReceivePong(dat, client, payload):
    return
