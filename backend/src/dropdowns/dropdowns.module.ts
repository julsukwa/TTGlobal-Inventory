import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DropdownsController } from './dropdowns.controller.js';
import { DropdownsService } from './dropdowns.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [DropdownsController],
  providers: [DropdownsService],
})
export class DropdownsModule {}
