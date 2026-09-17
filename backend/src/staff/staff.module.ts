import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
