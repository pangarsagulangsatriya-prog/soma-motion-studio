"""Run with python -m unittest touchdesigner/test_receiver.py (does not require TD)."""
import unittest
from . import soma_webserver_callbacks as receiver
from . import soma_script_chop as chop_module

class MockDAT:
    def __init__(self):
        self.storage = {}
        self.sent = []
        self.closed = []
    def store(self, key, value):
        self.storage[key] = value
    def fetch(self, key, default=None):
        return self.storage.get(key, default)
    def webSocketSendText(self, client, value):
        import json
        self.sent.append((client, json.loads(value)))
    def webSocketClose(self, client):
        self.closed.append(client)
    def webSocketSendPong(self, client, data):
        pass

class MockCHOP:
    def __init__(self):
        self.data = {}
        self.numSamples = 1
    def clear(self):
        self.data = {}
    def appendChan(self, name):
        values = [0.0]
        self.data[name] = values
        return values

class TestReceiver(unittest.TestCase):
    def setUp(self):
        self.dat = MockDAT()
        receiver.onServerStart(self.dat)
        self.token = self.dat.fetch('soma_token')
        self.session='soma-local-test'
        self.client='127.0.0.1:9999'
    def send(self, value):
        import json
        receiver.onWebSocketReceiveText(self.dat, self.client, json.dumps({'schema':'soma.td-bridge','version':1,'sessionId':self.session,**value}))
    def auth(self):
        self.send({'type':'hello','nonce':'nonce-123','token':self.token})
        self.assertEqual(self.dat.sent[-1][1]['type'],'hello-ack')
    def test_invalid_token_rejected(self):
        self.send({'type':'hello','nonce':'nonce-123','token':'invalid'})
        self.assertIn(self.client,self.dat.closed)
    def test_hello_state_event_duplicate_and_blackout(self):
        self.auth()
        self.send({'type':'control','seq':1,'generation':1,'action':'reset'})
        state={'type':'state','seq':2,'generation':1,'source':'simulator','mode':'rehearsal',
               'coordinateSpace':'simulated-floor-uv','actors':[{'id':'A','feet':{'left':{'x':.4,'y':.3,'confidence':.9,
               'coordinateBasis':'simulated','status':'contact','headingRad':0},'right':None}}]}
        self.send(state)
        self.assertFalse(self.dat.fetch('soma_bridge')['blackout'])
        event={'type':'event','seq':3,'generation':1,'event':{'kind':'contact','actorId':'A','foot':'left',
              'coordinateBasis':'simulated','x':.4,'y':.3,'confidence':.9,'verified':True,'eventId':'one'}}
        self.send(event)
        self.send({**event,'seq':4})
        self.assertEqual(len(self.dat.fetch('soma_bridge')['event_ids']),1)
        chop_module.op=lambda _:self.dat
        script=MockCHOP()
        chop_module.onCook(script)
        self.assertEqual(script.data['source_fresh'][0],1)
        self.assertEqual(script.data['scene_gate'][0],0)
        self.assertEqual(script.data['contact_A_L'][0],1)
        self.send({'type':'control','seq':5,'generation':1,'action':'blackout'})
        chop_module.onCook(script)
        self.assertEqual(script.data['source_fresh'][0],0)
        self.assertEqual(script.data['contact_A_L'][0],0)
    def test_heartbeat_does_not_keep_old_tracking_alive(self):
        self.auth()
        data=self.dat.fetch('soma_bridge')
        data['state']={'actors':[],'source':'camera','mode':'live'}
        data['blackout']=False
        data['state_monotonic']=receiver.time.monotonic()-4
        self.send({'type':'heartbeat','seq':1,'generation':1})
        chop_module.op=lambda _:self.dat
        script=MockCHOP();chop_module.onCook(script)
        self.assertEqual(script.data['source_fresh'][0],0)

if __name__=='__main__':
    unittest.main()
