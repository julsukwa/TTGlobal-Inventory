import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
