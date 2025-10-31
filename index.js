const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const cron = require('node-cron');
const token = require('./token.js');

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = token.token;
const CANAL_COMANDOS_ID = '1427717887132565664';
const CANAL_ID = '1427719052348096584'; // Asegúrate de que sea el ID del canal de tipo FORO

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

    message.reply('Pregunta agregada ✅');
  }
});

// Cron job: cada lunes a las 10:00 (hora del servidor)
cron.schedule('0 8 * * *', async () => {
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
        message: {
          content: `📢 **Pregunta de la semana:**\n${pregunta}`
        }
      });
      console.log('Post creado correctamente en el foro.');
    } else {
      console.error('El canal no es de tipo foro o no se pudo obtener.');
    }
  } catch (err) {
    console.error('No se pudo crear el post en el foro:', err);
  }
}, { scheduled: true });

client.once('ready', () => {
  console.log(`Bot listo! Conectado como ${client.user.tag}`);
});

client.login(TOKEN);
