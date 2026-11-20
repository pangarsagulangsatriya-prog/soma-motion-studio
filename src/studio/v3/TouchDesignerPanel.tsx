import {useState,useSyncExternalStore} from 'react';
import type {TouchDesignerBridge} from '../../footprints/touchdesigner/TouchDesignerBridge.ts';
export function TouchDesignerPanel({bridge}:{bridge:TouchDesignerBridge}){
 const state=useSyncExternalStore(bridge.subscribe,bridge.getSnapshot,bridge.getSnapshot);
 const [address,setAddress]=useState('ws://127.0.0.1:8765');
 const [token,setToken]=useState('');
 const connected=state.phase==='connected'||state.phase==='streaming';
 const busy=connected||state.phase==='connecting';
 return <div className="soma-td-panel" aria-label="Sambungan TouchDesigner">
  <div className="soma-td-status" role="status"><strong>{state.phase==='streaming'?'Mengirim data':state.phase==='connected'?'Terhubung':state.phase==='connecting'?'Menghubungkan…':state.phase==='error'?'Koneksi gagal':'Belum terhubung'}</strong><span>{state.hz} Hz · {state.events} pemicu</span></div>
  <label>Alamat lokal<input aria-label="Alamat TouchDesigner" value={address} disabled={busy} onChange={e=>setAddress(e.target.value)} spellCheck={false}/></label>
  <label>Kode pairing<input aria-label="Kode pairing TouchDesigner" type="password" autoComplete="off" value={token} disabled={busy} onChange={e=>setToken(e.target.value)} placeholder="Salin dari receiver TD"/></label>
  <div className="soma-td-actions">
   {!busy?<button className="ops-r1-primary-cta" disabled={token.trim().length<12} onClick={()=>bridge.connect(address,token)}>Hubungkan TouchDesigner</button>:
    state.phase==='connecting'?<button onClick={()=>bridge.disconnect()}>Batalkan</button>:
    state.phase==='streaming'?<button className="ops-r1-primary-cta" onClick={()=>bridge.stop()}>Hentikan Data</button>:
    <button className="ops-r1-primary-cta" disabled={!state.ready} onClick={()=>bridge.start()}>Mulai Kirim Data</button>}
   <button disabled={!connected} onClick={()=>bridge.test()}>Kirim Trigger Uji</button>
  </div>
  <p className="ops-r1-output-hint">{state.message}{connected&&!state.ready?' · Siapkan sumber di Track.':''}</p>
  <details><summary>Setup & detail</summary>
   <p>Posisi kaki 20 Hz · kontak, geser, putar, lepas. MP4 dan 3D ditandai latihan. Nyalakan output lewat kontrol TD.</p>
   <a href={`${import.meta.env.BASE_URL}touchdesigner/soma-touchdesigner-starter.zip`} download>Unduh receiver TouchDesigner</a>
   <p>Ekstrak ZIP, jalankan install_soma.py di Textport TD, lalu salin kode pairing. Izinkan akses jaringan lokal saat browser meminta.</p>
   {busy&&<button onClick={()=>bridge.disconnect()}>Putuskan Koneksi</button>}
  </details>
 </div>;
}
