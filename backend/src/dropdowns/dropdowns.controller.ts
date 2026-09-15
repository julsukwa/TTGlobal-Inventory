import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DropdownsService } from './dropdowns.service.js';
import { CreateDropdownDto } from './dto/create-dropdown.dto.js';
import { UpdateDropdownDto } from './dto/update-dropdown.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('dropdowns')
export class DropdownsController {
  constructor(private readonly dropdownsService: DropdownsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest, @Query('category') category?: string) {
    this.assertAdmin(req);
    return this.dropdownsService.findAll(category);
  }

  @Get('active/:category')
  findActive(@Param('category') category: string) {
    return this.dropdownsService.findActive(category);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateDropdownDto) {
    this.assertAdmin(req);
    return this.dropdownsService.create(dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDropdownDto,
  ) {
    this.assertAdmin(req);
    return this.dropdownsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    this.assertAdmin(req);
    return this.dropdownsService.deactivate(id);
  }

  @Patch(':id/reactivate')
  reactivate(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    this.assertAdmin(req);
    return this.dropdownsService.reactivate(id);
  }

  private assertAdmin(req: AuthenticatedRequest) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }
}
