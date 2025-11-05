// index.js
const { Client } = require('pg');
const fs = require('fs');
const { Client: DiscordClient, GatewayIntentBits, ChannelType } = require('discord.js');
const cron = require('node-cron');

// TOKEN del bot
const TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

console.log(`🔑 BOT_TOKEN está definido: ${!!TOKEN}`);
console.log(`🗄️ DATABASE_URL está definido: ${!!DATABASE_URL}`);
console.log('🔍 Variables disponibles:');
console.log(Object.keys(process.env).filter(v => v.includes('DATABASE') || v.includes('BOT')));

if (!TOKEN || !DATABASE_URL) {
  console.error('❌ Faltan variables de entorno (BOT_TOKEN o DATABASE_URL)');
  process.exit(1);
}

// Crear conexión PostgreSQL
const db = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // 🚨 IMPORTANTE para Railway
});

db.connect()
  .then(() => console.log('✅ Conectado a PostgreSQL correctamente'))
  .catch(err => console.error('❌ Error conectando a PostgreSQL:', err));

// Crear cliente de Discord
const client = new DiscordClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const CANAL_COMANDOS_ID = '1427355836455325828';
const CANAL_ID = '1427357947465564190';

// Asegurar tabla
async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS preguntas (
      id SERIAL PRIMARY KEY,
      texto TEXT NOT NULL
    )
  `);
  console.log('📋 Tabla "preguntas" lista.');
}

// Agregar pregunta
client.on('messageCreate', async message => {
  if (!message.content.startsWith('#') || message.author.bot) return;

  const args = message.content.slice(1).split(' ');
  const comando = args.shift().toLowerCase();

  if (comando === 'addq') {
    if (message.channel.id !== CANAL_COMANDOS_ID)
      return message.reply('Por favor usa este comando en el canal de comandos.');

    const pregunta = args.join(' ');
    if (!pregunta) return message.reply('Debes escribir una pregunta.');

    await db.query('INSERT INTO preguntas (texto) VALUES ($1)', [pregunta]);
    message.reply('Pregunta agregada');
  }
});

// Enviar pregunta semanal
cron.schedule('0 8 * * 1', async () => {
  try {
    const res = await db.query('SELECT id, texto FROM preguntas');
    if (res.rows.length === 0) return console.log('No hay preguntas disponibles.');

    const index = Math.floor(Math.random() * res.rows.length);
    const pregunta = res.rows[index];

    await db.query('DELETE FROM preguntas WHERE id = $1', [pregunta.id]);

    const canal = await client.channels.fetch(CANAL_ID);
    if (canal && canal.type === ChannelType.GuildForum) {
      await canal.threads.create({
        name: `PREGUNTA SEMANA: ${pregunta.texto.substring(0, 90)}`,
        message: { content: `📢 **Pregunta del dia:**\n${pregunta.texto}` }
      });
      console.log('✅ Pregunta publicada en foro');
    } else if (canal) {
      await canal.send(`📢 **Pregunta del dia:**\n${pregunta.texto}`);
      console.log('✅ Pregunta enviada al canal normal');
    }
  } catch (err) {
    console.error('❌ Error al crear la pregunta semanal:', err);
  }
});

// Sorpresa aleatoria (~20% de probabilidad diaria)
cron.schedule('0 10 * * *', async () => {
  if (Math.random() <= 0.20) {
    try {
      const canal = await client.channels.fetch(CANAL_ID);
      if (canal && canal.type === ChannelType.GuildForum) {
        await canal.threads.create({
          name: '🎉 SORPRESA 🎉',
          message: { content: 'FUCKING LUIS ENRIQUE SE LA TRAGA ENTERA!!!!' }
        });
      } else if (canal) {
        await canal.send('FUCKING LUIS ENRIQUE SE LA TRAGA ENTERA!!!!');
      }
      console.log('🎉 Mensaje sorpresa publicado.');
    } catch (err) {
      console.error('❌ Error al publicar sorpresa:', err);
    }
  } else {
    console.log('No hay sorpresa hoy 🎲');
  }
});

client.once('ready', async () => {
  console.log(`🤖 Bot listo! Conectado como ${client.user.tag}`);
  await initDB();
});

client.login(TOKEN);

