import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.enableCors({ origin: 'http://localhost:5173', credentials: true });
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
