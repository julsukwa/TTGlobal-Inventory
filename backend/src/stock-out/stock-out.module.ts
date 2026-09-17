import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StockOutController } from './stock-out.controller.js';
import { StockOutService } from './stock-out.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [StockOutController],
  providers: [StockOutService],
})
export class StockOutModule {}
