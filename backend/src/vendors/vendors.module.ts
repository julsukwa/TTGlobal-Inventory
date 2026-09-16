import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { VendorsController } from './vendors.controller.js';
import { VendorsService } from './vendors.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [VendorsController],
  providers: [VendorsService],
})
export class VendorsModule {}
