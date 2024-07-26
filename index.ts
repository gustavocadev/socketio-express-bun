import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();

// cors es para permitir que cualquier cliente se conecte al servidor una vez se despliegue en render o cualquier otro servicio
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer);
const prisma = new PrismaClient();

type ChatMensaje = {
  id: string;
  nombres: string;
  apellidos: string;
  mensaje: string;

  fecha: number;
};

type ChatMensajeData = {
  id: string;
  mensaje: string;
};

const getChatMensajes = async (): Promise<ChatMensaje[]> => {
  const mensajes = await prisma.chat.findMany({
    include: {
      user: true,
    },
  });

  const mensajesFormateados = mensajes.map((mensaje) => ({
    id: mensaje.user.id,
    nombres: mensaje.user.nombres,
    apellidos: `${mensaje.user.apellidoPaterno} ${mensaje.user.apellidoMaterno}`,
    mensaje: mensaje.message,
    fecha: mensaje.createdAt.getTime(),
  }));

  return mensajesFormateados;
};

io.on('connection', async (socket) => {
  console.log(`Nuevo cliente conectado ${socket.id}`);

  const chatMensajes = await getChatMensajes();
  socket.emit('recibir-mensajes', chatMensajes);

  socket.on('enviar-mensaje', async (data: ChatMensajeData) => {
    const user = await prisma.user.findUnique({
      where: {
        id: data.id,
      },
    });
    if (!user) return;

    await prisma.chat.create({
      data: {
        message: data.mensaje,
        user: {
          connect: {
            id: data.id,
          },
        },
      },
    });

    const chatMensajes = await getChatMensajes();
    io.emit('recibir-mensajes', chatMensajes);
  });
});

const port = process.env.PORT ?? 3000;
httpServer.listen(port, () => {
  console.log(`Servidor corriendo en el puerto http://localhost:${port}`);
});
