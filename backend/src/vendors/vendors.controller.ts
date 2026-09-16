import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { VendorsService } from './vendors.service.js';
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { UpdateVendorDto } from './dto/update-vendor.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    this.assertAdmin(req);
    return this.vendorsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.vendorsService.findActive();
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateVendorDto) {
    this.assertAdmin(req);
    return this.vendorsService.create(dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVendorDto,
  ) {
    this.assertAdmin(req);
    return this.vendorsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    this.assertAdmin(req);
    return this.vendorsService.deactivate(id);
  }

  @Patch(':id/reactivate')
  reactivate(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    this.assertAdmin(req);
    return this.vendorsService.reactivate(id);
  }

  private assertAdmin(req: AuthenticatedRequest) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }
}
