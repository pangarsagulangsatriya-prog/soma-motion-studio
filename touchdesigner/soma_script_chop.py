"""Paste into a Script CHOP callbacks DAT. Change the Web Server DAT path as needed.

This exports data channels and short event pulses; scene_gate is deliberately
ALWAYS 0 until the TD operator provides independent manual arming.
"""
import time


def onCook(scriptOp):
    scriptOp.clear()
    scriptOp.numSamples = 1
    server = op('webserver1')
    state = server.fetch('soma_bridge', None) if server else None
    now = time.monotonic()
    alive = bool(state and state.get('state') and not state.get('blackout') and
                 now - state.get('state_monotonic', 0) < 1.0)
    packet = state.get('state') if state else None
    actors = packet.get('actors', []) if alive and packet else []
    actor_map = {actor['id']: actor for actor in actors}
    # Solo actors use performer-1; expose them through A channels.
    if 'A' not in actor_map and 'performer-1' in actor_map:
        actor_map['A'] = actor_map['performer-1']
    data = {}
    for actor_key, prefix in (('A', 'a'), ('B', 'b')):
        actor = actor_map.get(actor_key, {})
        feet = actor.get('feet', {})
        for side in ('left', 'right'):
            foot = feet.get(side) or {}
            name = prefix + '_' + side
            data[name + '_x'] = float(foot.get('x') or 0)
            data[name + '_y'] = float(foot.get('y') or 0)
            data[name + '_confidence'] = float(foot.get('confidence') or 0)
            data[name + '_valid'] = float(bool(foot))
            data[name + '_contact'] = float(foot.get('status') == 'contact')
    data['source_fresh'] = float(alive)
    data['scene_gate'] = 0.0  # physical gate belongs to a separate TD operator decision
    pulses = state.get('pulses', {}) if state else {}  # allow synthetic Trigger Uji before streaming
    for actor in ('A', 'B'):
        for side in ('L', 'R'):
            key = 'contact_{}_{}'.format(actor, side)
            data[key] = float(pulses.get(key, 0) > now)
    for name, value in data.items():
        channel = scriptOp.appendChan(name)
        channel[0] = value
    return
