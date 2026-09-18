import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StickerQueueController } from './sticker-queue.controller.js';
import { StickerQueueService } from './sticker-queue.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [StickerQueueController],
  providers: [StickerQueueService],
})
export class StickerQueueModule {}
