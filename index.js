if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const cron = require('node-cron');
const { Client: PgClient } = require('pg'); // <-- agregado

// CONECTAR BASE DE DATOS
const db = new PgClient({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

db.connect()
  .then(async () => {
    console.log('✅ Conectado a la base de datos PostgreSQL.');

    // Crear tabla si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS preguntas (
        id SERIAL PRIMARY KEY,
        texto TEXT NOT NULL
      );
    `);
  })
  .catch(err => console.error('❌ Error conectando a PostgreSQL:', err));

const TOKEN = process.env.BOT_TOKEN;
console.log('🔑 BOT_TOKEN está definido:', !!TOKEN);

if (!TOKEN) {
  console.error('❌ Error: BOT_TOKEN no está definido.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const CANAL_COMANDOS_ID = '1427355836455325828';
const CANAL_ID = '1427357947465564190';

// Comando para agregar preguntas
client.on('messageCreate', async message => {
  if (!message.content.startsWith('#') || message.author.bot) return;

  const args = message.content.slice(1).split(' ');
  const comando = args.shift().toLowerCase();

  if (comando === 'addq') {
    if (message.channel.id !== CANAL_COMANDOS_ID)
      return message.reply('Por favor usa este comando en el canal de comandos.');

    const pregunta = args.join(' ');
    if (!pregunta) return message.reply('Debes escribir una pregunta.');

    try {
      await db.query('INSERT INTO preguntas (texto) VALUES ($1)', [pregunta]);
      message.reply('Pregunta agregada a la base de datos.');
    } catch (err) {
      console.error('❌ Error al insertar pregunta:', err);
      message.reply('Error al guardar la pregunta.');
    }
  }
});

// Cron: pregunta semanal
cron.schedule('0 8 * * 1', async () => {
  try {
    const { rows } = await db.query('SELECT * FROM preguntas');
    if (rows.length === 0) return console.log('No hay preguntas disponibles.');

    const index = Math.floor(Math.random() * rows.length);
    const pregunta = rows[index];

    await db.query('DELETE FROM preguntas WHERE id = $1', [pregunta.id]);

    const canal = await client.channels.fetch(CANAL_ID);
    if (canal && canal.type === ChannelType.GuildForum) {
      await canal.threads.create({
        name: `PREGUNTA SEMANA: ${pregunta.texto.substring(0, 90)}`,
        message: { content: `📢 **Pregunta de la semana:**\n${pregunta.texto}` }
      });
    } else {
      await canal.send(`📢 **Pregunta de la semana:**\n${pregunta.texto}`);
    }

    console.log('✅ Pregunta semanal publicada.');
  } catch (err) {
    console.error('❌ Error en cron semanal:', err);
  }
}, { scheduled: true });

// Cron: mensaje sorpresa (~1–2 veces por semana)
cron.schedule('0 10 * * *', async () => {
  const probabilidad = Math.random();
  if (probabilidad <= 0.20) {
    try {
      const canal = await client.channels.fetch(CANAL_ID);
      if (canal && canal.type === ChannelType.GuildForum) {
        await canal.threads.create({
          name: '🎉 SORPRESA 🎉',
          message: { content: 'FUCKING LUIS ENRIQUE!!!!' }
        });
      } else if (canal) {
        await canal.send('FUCKING LUIS ENRIQUE!!!!!!');
      }
      console.log('🎉 Mensaje sorpresa publicado.');
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
