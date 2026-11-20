"""SOMA TD bridge v1. Pure protocol core; also exercised outside TouchDesigner."""
import json
import math
import secrets
import time
from collections import deque

SCHEMA = 'soma.td-bridge'
ORIGINS = {'https://soma-motion-studio.vercel.app', 'https://soma-motion-studio-pangarsagulangsatriya-progs-projects.vercel.app', 'http://localhost:4173', 'http://127.0.0.1:4173'}

def number(value, low=None, high=None):
    return (type(value) in (int, float) and math.isfinite(value)
            and (low is None or value >= low) and (high is None or value <= high))

def text(value, maximum=500):
    return isinstance(value, str) and 0 < len(value) <= maximum

class Receiver:
    def __init__(self, token, clock=time.monotonic, origins=None):
        self.token = token
        self.clock = clock
        self.origins = set(origins or ORIGINS)
        self.client = None
        self.connection = None
        self.seq = 0
        self.session = None
        self.last_packet = 0
        self.last_state = 0
        self.streaming = False
        self.armed = False
        self.actors = []
        self.pulses = {}
        self.last_event = None
        self.event_at = -100
        self.cue = {}
        self.seen = set()
        self.order = deque()
        self.mode = 'rehearsal'

    def clear(self):
        self.armed = False
        self.streaming = False
        self.actors = []
        self.pulses = {}
        self.last_event = None
        self.event_at = -100

    def close(self, client):
        if client == self.client:
            self.clear()
            self.client = None
            self.connection = None

    def reply(self, kind, **fields):
        return dict(schema=SCHEMA, version=1, type=kind, connectionId=self.connection, **fields)

    def receive(self, client, raw):
        if not isinstance(raw, str) or len(raw.encode('utf-8')) > 16384:
            raise ValueError('packet size')
        try:
            p = json.loads(raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('non-finite')))
        except (TypeError, ValueError):
            raise ValueError('invalid JSON')
        if not isinstance(p, dict) or p.get('schema') != SCHEMA or p.get('version') != 1:
            raise ValueError('protocol version')
        if not text(p.get('connectionId'), 128) or not text(p.get('sessionId'), 128):
            raise ValueError('session identity')
        if type(p.get('generation')) is not int or p['generation'] < 0 or type(p.get('seq')) is not int or p['seq'] <= 0:
            raise ValueError('sequence')
        if not number(p.get('atMs'), 0):
            raise ValueError('timestamp')
        kind = p.get('type')
        if kind == 'hello':
            if self.client is not None or p.get('origin') not in self.origins or not secrets.compare_digest(str(p.get('token', '')), self.token):
                raise ValueError('pairing rejected')
            self.clear()
            self.client, self.connection = client, p['connectionId']
            self.seq = p['seq']
            self.session = (p['sessionId'], p['generation'])
            self.last_packet = self.clock()
            self.seen.clear(); self.order.clear()
            return self.reply('hello-ack')
        if client != self.client or p['connectionId'] != self.connection or p['seq'] <= self.seq:
            raise ValueError('client or sequence')
        session = (p['sessionId'], p['generation'])
        if session != self.session:
            if self.streaming and not (kind == 'control' and p.get('action') in ('reset', 'stop', 'blackout')):
                raise ValueError('missing reset')
            self.clear(); self.seen.clear(); self.order.clear(); self.session = session
        self.seq = p['seq']
        if kind == 'heartbeat':
            self.last_packet = self.clock()
            return self.reply('heartbeat-ack', ackSeq=p['seq'])
        if kind == 'control':
            action = p.get('action')
            if action in ('stop', 'reset', 'blackout'):
                self.clear()
            elif action == 'start':
                self.clear(); self.streaming = True; self.last_state = self.clock()
            elif action == 'cue' and isinstance(p.get('cue'), dict):
                self.cue = p['cue']
            else:
                raise ValueError('control')
        elif kind == 'state':
            if not self.streaming or not isinstance(p.get('actors'), list) or len(p['actors']) > 2:
                raise ValueError('state')
            for actor in p['actors']:
                if not isinstance(actor, dict) or not text(actor.get('id'), 64) or not number(actor.get('confidence'), 0, 1):
                    raise ValueError('actor')
                if actor.get('tracking') not in ('visible', 'lost', 'identity-uncertain') or not isinstance(actor.get('feet'), dict):
                    raise ValueError('tracking')
                for side in ('left', 'right'):
                    foot = actor['feet'].get(side)
                    if foot is None:
                        continue
                    if not isinstance(foot, dict) or not number(foot.get('x'), 0, 1) or not number(foot.get('y'), 0, 1) or not number(foot.get('confidence'), 0, 1):
                        raise ValueError('foot')
                    if foot.get('coordinateSpace') not in ('image-uv', 'floor-uv', 'simulated-floor-uv'):
                        raise ValueError('coordinate space')
                    if foot.get('headingRad') is not None and not number(foot['headingRad']):
                        raise ValueError('heading')
            self.actors = p['actors']
            self.mode = p.get('mode', 'rehearsal')
            self.last_state = self.clock()
            if p.get('sourceFresh') is not True:
                self.clear()
        elif kind == 'event':
            e = p.get('event')
            test = p.get('test') is True
            if not self.streaming and not test:
                raise ValueError('stream stopped')
            if not isinstance(e, dict) or not text(e.get('eventId')) or not text(e.get('actorId'), 64):
                raise ValueError('event')
            if e['actorId'].startswith('unassigned-') or e.get('foot') not in ('left', 'right') or e.get('kind') not in ('contact', 'slide', 'pivot', 'release', 'lift'):
                raise ValueError('event identity')
            if not number(e.get('x'), 0, 1) or not number(e.get('y'), 0, 1) or not number(e.get('confidence'), 0, 1):
                raise ValueError('event coordinate')
            if e.get('kind') == 'contact' and (e.get('verified') is not True or e.get('verification') not in ('simulated', 'video-estimate', 'detected-estimate')):
                raise ValueError('unverified contact')
            if (e.get('sessionId'), e.get('generation')) != self.session:
                raise ValueError('event session')
            key = (*self.session, e['eventId'])
            if key not in self.seen:
                self.seen.add(key); self.order.append(key)
                if len(self.order) > 4096:
                    self.seen.discard(self.order.popleft())
                actor = {'performer-1': 'a', 'A': 'a', 'B': 'b'}.get(e['actorId'])
                if actor:
                    channel = '{}_{}_{}'.format(actor, e['foot'], e['kind'])
                    self.pulses[channel] = self.pulses.get(channel, 0) + 1
                self.last_event = dict(e, test=test)
                self.event_at = self.clock()
        else:
            raise ValueError('packet type')
        self.last_packet = self.clock()
        return None

    def tick(self):
        now = self.clock()
        if self.client is not None and (now-self.last_packet > 1 or self.streaming and now-self.last_state > 1):
            self.clear()
        return self.armed and self.streaming

    def channels(self):
        gate = self.tick()
        result = {'scene_gate': int(gate), 'source_fresh': int(self.streaming), 'rehearsal': int(self.mode != 'live'),
                  'preview_pulse': int(self.clock()-self.event_at < .25), 'uncalibrated': 0}
        for actor in ('a', 'b'):
            result[actor+'_conf'] = 0
            for side in ('left', 'right'):
                for suffix in ('x', 'y', 'valid', 'contact', 'slide', 'pivot', 'release', 'lift'):
                    result[f'{actor}_{side}_{suffix}'] = 0
        for actor in self.actors:
            label = {'performer-1': 'a', 'A': 'a', 'B': 'b'}.get(actor['id'])
            if not label or actor['tracking'] != 'visible':
                continue
            result[label+'_conf'] = actor['confidence']
            for side in ('left', 'right'):
                foot = actor['feet'].get(side)
                if foot:
                    prefix = label+'_'+side
                    result[prefix+'_x'], result[prefix+'_y'] = foot['x'], foot['y']
                    result[prefix+'_valid'] = 1
                    if foot['coordinateSpace'] == 'image-uv':
                        result['uncalibrated'] = 1
        result.update(self.pulses)
        self.pulses = {}
        return result
