import importlib.util
import json
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('receiver',pathlib.Path(__file__).parents[1]/'public/touchdesigner/soma_receiver.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class ProtocolTest(unittest.TestCase):
 def setUp(self):
  self.now=1.;self.r=mod.Receiver('test-pairing-1234',lambda:self.now);self.seq=0
  self.send('hello',token='test-pairing-1234',origin='http://localhost:4173')
 def packet(self,kind,**kw):
  self.seq+=1
  return dict(schema=mod.SCHEMA,version=1,type=kind,connectionId='conn',sessionId='session',generation=1,seq=self.seq,atMs=10,**kw)
 def send(self,kind,**kw):
  return self.r.receive('client',json.dumps(self.packet(kind,**kw)))
 def event(self,**kw):
  return dict(eventId='step-1',actorId='A',foot='left',kind='contact',x=.2,y=.3,confidence=1,verified=True,verification='simulated',sessionId='session',generation=1,**kw)
 def test_duplicate_event_pulses_once(self):
  e=self.event();self.send('event',test=True,event=e);self.send('event',test=True,event=e)
  self.assertEqual(self.r.channels()['a_left_contact'],1)
  self.assertEqual(self.r.channels()['a_left_contact'],0)
  self.assertFalse(self.r.armed)
 def test_timeout_latches_black(self):
  self.send('control',action='start');self.r.armed=True
  self.now+=1.01;self.r.tick();self.assertFalse(self.r.armed);self.assertFalse(self.r.streaming)
  self.send('heartbeat');self.assertFalse(self.r.armed)
 def test_heartbeat_does_not_keep_stale_state_alive(self):
  self.send('control',action='start');self.r.armed=True
  self.now+=1.01;self.send('heartbeat');self.r.tick();self.assertFalse(self.r.armed)
 def test_stop_reset_blackout(self):
  for action in ('stop','reset','blackout'):
   self.send('control',action='start');self.r.armed=True
   self.send('control',action=action);self.assertFalse(self.r.armed)
 def test_invalid_inputs_and_sequence(self):
  for update in ({'x':float('nan')},{'x':2},{'actorId':'unassigned-0'},{'verified':False},{'generation':0}):
   e=self.event();e.update(update)
   with self.assertRaises(ValueError):self.send('event',test=True,event=e)
  p=self.packet('heartbeat');self.r.receive('client',json.dumps(p))
  with self.assertRaises(ValueError):self.r.receive('client',json.dumps(p))
  with self.assertRaises(ValueError):self.r.receive('client','x'*17000)
 def test_pairing_and_second_client(self):
  p=self.packet('hello',token='wrong',origin='https://evil.example')
  with self.assertRaises(ValueError):self.r.receive('other',json.dumps(p))
  self.assertEqual(self.r.client,'client')
 def test_disconnect_clears(self):
  self.send('control',action='start');self.r.armed=True;self.r.close('client')
  self.assertFalse(self.r.armed);self.assertIsNone(self.r.client)

if __name__=='__main__':unittest.main()
