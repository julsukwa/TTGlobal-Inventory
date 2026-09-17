import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
