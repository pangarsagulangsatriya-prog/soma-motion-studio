"""Local integration fixture: runs the production protocol core over WebSocket."""
import asyncio
import importlib.util
import json
import pathlib
import websockets

spec=importlib.util.spec_from_file_location('receiver',pathlib.Path(__file__).parents[1]/'public/touchdesigner/soma_receiver.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
r=module.Receiver('test-pairing-1234',origins={'test'})
async def handler(ws):
 client=str(id(ws))
 try:
  async for raw in ws:
   try:
    reply=r.receive(client,raw)
    packet=json.loads(raw)
    if packet['type']=='event':
     print('EVENT '+str(r.channels()['a_left_contact']),flush=True)
    if packet['type']=='state':
     print('STATE '+str(len(r.actors)),flush=True)
    if packet['type']=='control':
     print('CONTROL '+packet['action'],flush=True)
    if reply:await ws.send(json.dumps(reply))
   except (ValueError,TypeError,KeyError) as error:
    print('ERROR '+str(error),flush=True);await ws.close()
 finally:r.close(client)
async def main():
 async with websockets.serve(handler,'127.0.0.1',18765,max_size=16384):
  print('READY',flush=True)
  await asyncio.Future()
asyncio.run(main())
