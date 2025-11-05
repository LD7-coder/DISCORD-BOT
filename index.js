
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const cron = require('node-cron');

// USAR LA VARIABLE DE ENTORNO BOT_TOKEN
const TOKEN = process.env.BOT_TOKEN;

// Depuración: verifica si está definida (sin mostrar el token)
console.log('🔑 BOT_TOKEN está definido:', !!TOKEN);

if (!TOKEN) {
  console.error('❌ Error: BOT_TOKEN no está definido en las variables de entorno.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const CANAL_COMANDOS_ID = '1427355836455325828';
const CANAL_ID = '1427357947465564190'; // ID del canal/foro donde publicar

function leerPreguntas() {
  const data = fs.readFileSync('preguntas.json', 'utf-8');
  return JSON.parse(data);
}

function guardarPreguntas(preguntas) {
  fs.writeFileSync('preguntas.json', JSON.stringify(preguntas, null, 2));
}

// Comando para agregar preguntas
client.on('messageCreate', message => {
  if (!message.content.startsWith('#') || message.author.bot) return;

  const args = message.content.slice(1).split(' ');
  const comando = args.shift().toLowerCase();

  if (comando === 'addq') {
    if (message.channel.id !== CANAL_COMANDOS_ID)
      return message.reply('Por favor usa este comando en el canal de comandos.');

    const pregunta = args.join(' ');
    if (!pregunta) return message.reply('Debes escribir una pregunta.');

    const preguntas = leerPreguntas();
    preguntas.push(pregunta);
    guardarPreguntas(preguntas);

    message.reply('Pregunta agregada');
  }
});

// Cron: pregunta semanal (Lunes 8:00)
cron.schedule('0 8 * * 1', async () => {
  const preguntas = leerPreguntas();
  if (preguntas.length === 0) return console.log('No hay preguntas disponibles.');

  const index = Math.floor(Math.random() * preguntas.length);
  const pregunta = preguntas.splice(index, 1)[0];
  guardarPreguntas(preguntas);

  try {
    const canal = await client.channels.fetch(CANAL_ID);
    if (canal && canal.type === ChannelType.GuildForum) {
      await canal.threads.create({
        name: `PREGUNTA SEMANA: ${pregunta.substring(0, 90)}`,
        message: { content: `📢 **Pregunta del dia:**\n${pregunta}` }
      });
      console.log('✅ Post de pregunta semanal creado.');
    } else if (canal) {
      await canal.send(`📢 **Pregunta del dia:**\n${pregunta}`);
      console.log('✅ Mensaje enviado en canal normal.');
    } else {
      console.error('❌ No se pudo obtener el canal.');
    }
  } catch (err) {
    console.error('❌ Error al crear el post en el foro:', err);
  }
}, { scheduled: true });

// Cron: SORPRESA aleatoria (~20% diario → ~1-2 veces/semana)
cron.schedule('0 10 * * *', async () => {
  const probabilidad = Math.random();
  if (probabilidad <= 0.20) {
    try {
      const canal = await client.channels.fetch(CANAL_ID);
      if (canal && canal.type === ChannelType.GuildForum) {
        await canal.threads.create({
          name: '🎉 SORPRESA 🎉',
          message: { content: 'FUCKING LUIS ENRIQUE!!!' }
        });
        console.log('🎉 Mensaje sorpresa publicado (foro).');
      } else if (canal) {
        await canal.send('FUCKING LUIS ENRIQUE!!!!');
        console.log('🎉 Mensaje sorpresa enviado (canal normal).');
      } else {
        console.error('❌ No se pudo obtener el canal para la sorpresa.');
      }
    } catch (err) {
      console.error('❌ Error al publicar sorpresa:', err);
    }
  } else {
    console.log('No hay sorpresa hoy 🎲');
  }
}, { scheduled: true });

client.once('ready', () => {
  console.log(`🤖 Bot listo! Conectado como ${client.user.tag}`);
});

client.login(TOKEN);
