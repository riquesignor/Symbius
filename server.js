const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

let rooms = {};

wss.on('connection', (ws) => {
  console.log('Usuário conectado');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const { type, room } = data;

      // Entrar na sala
      if (type === 'join') {
        ws.room = room;
        if (!rooms[room]) rooms[room] = [];
        rooms[room].push(ws);
        console.log(`${data.user} entrou na sala ${room}`);
      }

      // Enviar mensagem para todos na sala (exceto quem enviou)
      if (type === 'message') {
        const roomClients = rooms[room] || [];
        roomClients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'message',        // ← o app verifica esse campo
              mensagem: data.mensagem, // ← o app usa esse campo
              nome_remetente: data.nome_remetente,
              nome_destinatario: data.nome_destinatario,
              remetenteUid: data.remetenteUid,
              sala: data.sala,
              foto: data.foto || null
            }));
          }
        });
      }

    } catch (err) {
      console.log("Erro ao processar mensagem:", err);
    }
  });

  ws.on('close', () => {
    for (let room in rooms) {
      rooms[room] = rooms[room].filter(client => client !== ws);
    }
    console.log('Usuário desconectado');
  });
});

console.log("Servidor WebSocket rodando em ws://localhost:3001");