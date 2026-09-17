import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StockInController } from './stock-in.controller.js';
import { StockInService } from './stock-in.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [StockInController],
  providers: [StockInService],
})
export class StockInModule {}
