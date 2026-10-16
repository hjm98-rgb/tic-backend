// 多人实时房间游戏大厅 —— 井字棋(2人对战) + 大厅聊天（单文件：后端 + 内联前端）
// 部署到 Render/Railway 等云运行时；端口从环境变量取（平台注入 PORT）
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

const HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>实时对战大厅</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1224;color:#e8ecff;min-height:100vh}
  header{background:linear-gradient(90deg,#0ea5e9,#10b981);padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  header h1{font-size:19px}
  .name{display:flex;gap:8px;margin-left:auto;align-items:center}
  .name input{background:#0b0e20;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:7px 10px;color:#fff;font-size:14px;width:110px}
  main{max-width:900px;margin:20px auto;padding:0 14px;display:flex;gap:16px;flex-wrap:wrap}
  .card{background:#1a1e38;border:1px solid #2c3160;border-radius:14px;padding:16px;flex:1 1 300px}
  .card h2{font-size:16px;margin-bottom:12px;color:#c7cbff}
  button{background:#0ea5e9;color:#fff;border:0;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:14px}
  button.secondary{background:#232750}
  input[type=text]{background:#12152b;border:1px solid #2c3160;border-radius:8px;padding:9px 10px;color:#fff;font-size:14px}
  .row{display:flex;gap:8px;margin-bottom:10px}
  .row input{flex:1}
  #board{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:300px;margin:10px auto}
  #board button{aspect-ratio:1;font-size:44px;font-weight:700;background:#232750;border:1px solid #2c3160;border-radius:10px;cursor:pointer;color:#fff}
  #board button:disabled{cursor:default;opacity:.85}
  #board .x{color:#f87171}#board .o{color:#60a5fa}
  #status{text-align:center;font-size:15px;min-height:22px;margin:8px 0}
  #chat{height:180px;overflow:auto;background:#12152b;border:1px solid #2c3160;border-radius:8px;padding:8px;font-size:13px;margin-bottom:8px}
  #chat div{margin:2px 0}
  .sys{color:#94a3b8;font-style:italic}
  .send{display:flex;gap:8px}.send input{flex:1}
  footer{text-align:center;color:#667;font-size:12px;padding:18px}
  .hidden{display:none!important}
</style>
</head>
<body>
<header>
  <h1>⚔ 实时对战大厅</h1>
  <div class="name">
    <input id="myname" placeholder="昵称" maxlength="12">
    <button class="secondary" onclick="saveName()">设置</button>
  </div>
</header>
<main>
  <div class="card">
    <h2>开始 / 加入对局</h2>
    <div class="row">
      <button onclick="createRoom()">创建房间</button>
      <input id="joinid" placeholder="输入房间号">
      <button class="secondary" onclick="joinRoom()">加入</button>
    </div>
    <div class="row"><input id="roomId" readonly placeholder="房间号（发给朋友）"></div>
    <div id="status">连接中…</div>
    <div id="board" class="hidden"></div>
    <div style="text-align:center" id="boardCtl" class="hidden"><button class="secondary" onclick="leave()">离开房间</button></div>
  </div>
  <div class="card">
    <h2>大厅聊天</h2>
    <div id="chat"></div>
    <div class="send">
      <input id="chattext" placeholder="房间内输入 /restart 可重开" maxlength="200">
      <button onclick="sendChat()">发送</button>
    </div>
  </div>
</main>
<footer>部署在云运行时 · 由豆包为你生成</footer>
<script>
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  const ws = new WebSocket(proto + location.host);
  let myMark = null, roomId = null, myName = '玩家' + Math.floor(Math.random()*100);
  const $ = id => document.getElementById(id);
  function log(text, sys) { const d = document.createElement('div'); d.className = sys ? 'sys' : ''; d.textContent = text; $('chat').appendChild(d); $('chat').scrollTop = $('chat').scrollHeight; }
  function saveName(){ const v=$('myname').value.trim(); if(v) myName=v.slice(0,12); log('昵称设为：'+myName); }
  function createRoom(){ ws.send(JSON.stringify({type:'create', name:myName})); }
  function joinRoom(){ const id=$('joinid').value.trim(); if(id) ws.send(JSON.stringify({type:'join', id, name:myName})); }
  function renderRoom(room) {
    roomId = room.id; $('roomId').value = room.id;
    $('board').classList.remove('hidden'); $('boardCtl').classList.remove('hidden');
    const marks = {}; room.players.forEach(p => marks[p.mark] = p.name);
    $('status').textContent = room.state === 'wait' ? '等待对手加入…' :
      (room.state === 'over' ? (room.winner === 'draw' ? '平局！' : marks[room.winner] + ' 获胜！') : '轮到：' + marks[room.turn] + (marks[room.turn]===myName?'（你）':''));
    const b = $('board'); b.innerHTML = '';
    room.board.forEach((v,i) => {
      const btn = document.createElement('button');
      if (v) { btn.textContent = v; btn.className = v==='X'?'x':'o'; }
      btn.disabled = !(room.state==='playing' && myMark===room.turn && !v);
      btn.onclick = () => ws.send(JSON.stringify({type:'move', i}));
      b.appendChild(btn);
    });
  }
  function leave(){ ws.send(JSON.stringify({type:'leave'})); roomId=null; $('board').classList.add('hidden'); $('boardCtl').classList.add('hidden'); $('status').textContent='已离开房间'; }
  function sendChat(){ const t=$('chattext').value.trim(); if(t){ ws.send(JSON.stringify({type:'chat', text:t})); $('chattext').value=''; } }
  ws.onopen = () => $('status').textContent = '已连接，创建或加入房间开始对战';
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type==='room_joined') { myMark = m.room.players.find(p=>p.name===myName)?.mark || null; renderRoom(m.room); log('已进入房间 '+m.room.id, true); }
    else if (m.type==='update') { renderRoom(m.room); }
    else if (m.type==='chat') { log(m.from+': '+m.text, false); }
    else if (m.type==='error') { log('错误：'+m.msg, true); }
  };
  $('chattext').addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(); });
  $('joinid').addEventListener('keydown', e=>{ if(e.key==='Enter') joinRoom(); });
</script>
</body>
</html>`;

app.get('/', (req, res) => res.type('html').send(HTML));

// ---- 房间系统 ----
// rooms: Map<roomId, { board, turn, players: Map<ws, {name, mark}>, state, winner }>
const rooms = new Map();
const roomOf = new Map(); // ws -> roomId

function genId() { let id; do { id = Math.random().toString(36).slice(2, 8); } while (rooms.has(id)); return id; }
function roomState(room) {
  return { id: room.id, players: [...room.players.values()].map(p => ({ name: p.name, mark: p.mark })), state: room.state, turn: room.turn, board: room.board, winner: room.winner, counts: room.players.size };
}
function sendRoom(room, type, data) {
  const msg = JSON.stringify({ type, ...data });
  room.players.forEach((_, ws) => { if (ws.readyState === 1) ws.send(msg); });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }
    const room = roomOf.has(ws) ? rooms.get(roomOf.get(ws)) : null;
    switch (m.type) {
      case 'create': {
        if (room) return;
        const rid = genId();
        const r = { id: rid, board: Array(9).fill(''), turn: 'X', state: 'wait', winner: null, players: new Map() };
        r.players.set(ws, { name: String(m.name || '玩家1').slice(0, 12) || '玩家1', mark: 'X' });
        rooms.set(rid, r); roomOf.set(ws, rid);
        sendRoom(r, 'room_joined', { room: roomState(r) });
        break;
      }
      case 'join': {
        if (room) return;
        const r = rooms.get(String(m.id));
        if (!r) { ws.send(JSON.stringify({ type: 'error', msg: '房间不存在' })); break; }
        if (r.players.size >= 2) { ws.send(JSON.stringify({ type: 'error', msg: '房间已满' })); break; }
        r.players.set(ws, { name: String(m.name || '玩家2').slice(0, 12) || '玩家2', mark: 'O' });
        roomOf.set(ws, r.id); r.state = 'playing';
        sendRoom(r, 'room_joined', { room: roomState(r) });
        sendRoom(r, 'chat', { from: '系统', text: '对手已加入，游戏开始！X 先行。' });
        break;
      }
      case 'move': {
        if (!room || room.state !== 'playing') return;
        const p = room.players.get(ws); if (!p || p.mark !== room.turn) return;
        const i = parseInt(m.i, 10);
        if (!(i >= 0 && i < 9) || room.board[i] !== '') return;
        room.board[i] = p.mark;
        const win = checkWin(room.board);
        if (win) { room.state = 'over'; room.winner = win; }
        else if (room.board.every(x => x)) { room.state = 'over'; room.winner = 'draw'; }
        else room.turn = room.turn === 'X' ? 'O' : 'X';
        sendRoom(room, 'update', { room: roomState(room) });
        if (room.state === 'over') {
          const who = room.winner === 'draw' ? '平局' : (room.winner === 'X' ? 'X（先手）' : 'O（后手）');
          sendRoom(room, 'chat', { from: '系统', text: '对局结束：' + who + ' 获胜！输入 /restart 可再来一局。' });
        }
        break;
      }
      case 'chat': {
        if (!room) break;
        const p = room.players.get(ws); if (!p) break;
        const t = String(m.text || '').slice(0, 200); if (!t) break;
        if (t === '/restart' && room.state === 'over') {
          room.board = Array(9).fill(''); room.turn = 'X'; room.state = 'playing'; room.winner = null;
          sendRoom(room, 'update', { room: roomState(room) });
          sendRoom(room, 'chat', { from: '系统', text: '重新开局，X 先行。' });
          break;
        }
        sendRoom(room, 'chat', { from: p.name, text: t });
        break;
      }
      case 'leave': { if (room) closeRoom(ws); break; }
      default: break;
    }
  });
  ws.on('close', () => { if (roomOf.has(ws)) closeRoom(ws); });
});

function closeRoom(ws) {
  const rid = roomOf.get(ws); const room = rooms.get(rid);
  roomOf.delete(ws); if (!room) return;
  room.players.delete(ws);
  if (room.players.size === 0) { rooms.delete(rid); return; }
  const left = room.players.get(ws);
  room.state = 'over'; room.winner = null; room.board = Array(9).fill('');
  sendRoom(room, 'update', { room: roomState(room) });
  sendRoom(room, 'chat', { from: '系统', text: (left ? left.name + ' 离开了' : '一位玩家离开了') + '。等待新玩家或重开。' });
}

function checkWin(b) {
  const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,c,d] of L) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return null;
}

server.listen(PORT, '0.0.0.0', () => console.log('listening on ' + PORT));
