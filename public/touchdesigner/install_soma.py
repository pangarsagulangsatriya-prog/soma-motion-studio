"""In TD Textport: exec(compile(open('/absolute/path/install_soma.py').read(), '/absolute/path/install_soma.py', 'exec'))"""
from pathlib import Path
import secrets
import types

folder = Path(SOMA_STARTER_DIR).resolve() if 'SOMA_STARTER_DIR' in globals() else Path(__file__).resolve().parent
module = types.ModuleType('soma_receiver')
exec(compile((folder/'soma_receiver.py').read_text(), str(folder/'soma_receiver.py'), 'exec'), module.__dict__)
root = op('/project1')
if root is None:
    raise RuntimeError('Buka project TouchDesigner dengan /project1 terlebih dahulu.')
name = 'soma_bridge'
index = 2
while root.op(name) is not None:
    name = 'soma_bridge_'+str(index); index += 1
base = root.create(baseCOMP, name)
page = base.appendCustomPage('SOMA')
page.appendToggle('Arm', label='Nyalakan output TD')[0].val = False
page.appendStr('Token', label='Kode pairing')[0].val = secrets.token_urlsafe(24)
r = module.Receiver(str(base.par.Token))
base.store('soma_receiver', r)
callbacks = base.create(textDAT, 'callbacks')
callbacks.text = (folder/'callbacks.py').read_text()
server = base.create(webserverDAT, 'webserver1')
server.par.active = False
server.par.port = 8765
server.par.localaddress = '127.0.0.1'
server.par.callbacks = callbacks.path
chop_callbacks = base.create(textDAT, 'chop_callbacks')
chop_callbacks.text = '''def onCook(scriptOp):
    r = scriptOp.parent().fetch('soma_receiver')
    values = r.channels()
    scriptOp.clear()
    scriptOp.numSamples = 1
    for name, value in values.items():
        scriptOp.appendChan(name)[0] = value
'''
channels = base.create(scriptCHOP, 'channels')
channels.par.callbacks = chop_callbacks.path
execute = base.create(executeDAT, 'watchdog')
execute.par.frameend = True
execute.text = '''def onFrameEnd(frame):
    base = me.parent()
    r = base.fetch('soma_receiver')
    r.tick()
    # Only an operator toggle may arm; blackout, stop and timeout latch it off.
    previous = base.fetch('soma_arm_previous', False)
    requested = bool(base.par.Arm)
    if requested and not previous and r.streaming:
        r.armed = True
    if not requested:
        r.armed = False
    if not r.armed:
        base.par.Arm = False
    base.store('soma_arm_previous', bool(base.par.Arm))
    base.op('channels').cook(force=True)
'''
circle = base.create(circleTOP, 'preview_contact')
circle.par.resolutionw = 512; circle.par.resolutionh = 512
preview = base.create(levelTOP, 'preview_pulse')
preview.inputConnectors[0].connect(circle)
preview.par.opacity.expr = "op('channels')['preview_pulse'][0]"
level = base.create(levelTOP, 'output_gate')
level.inputConnectors[0].connect(preview)
level.par.opacity.expr = "op('channels')['scene_gate'][0]"
out = base.create(nullTOP, 'OUT')
out.inputConnectors[0].connect(level)
for i, node in enumerate([server, callbacks, execute, channels, circle, preview, level, out]):
    node.nodeX = (i % 4)*220; node.nodeY = -(i//4)*180
server.par.active = True
print('SOMA receiver:', base.path)
print('Alamat: ws://127.0.0.1:8765')
print('Kode pairing:', str(base.par.Token))
print('Preview: preview_pulse. Output OUT tetap gelap sampai Mulai Kirim Data dan Arm di TD.')
