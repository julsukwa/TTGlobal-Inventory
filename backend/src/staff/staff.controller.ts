import {
  Body,
  Controller,
  Delete,
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
import { StaffService } from './staff.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest, @Query('search') search?: string) {
    this.assertAdmin(req);
    return this.staffService.findAll(search);
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    this.assertAdmin(req);
    return this.staffService.findOne(id);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateStaffDto) {
    this.assertAdmin(req);
    return this.staffService.create(dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffDto,
  ) {
    this.assertAdmin(req);
    return this.staffService.update(id, dto);
  }

  @Patch(':id/change-password')
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
  ) {
    this.assertAdmin(req);
    return this.staffService.changePassword(id, dto);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    this.assertAdmin(req);
    return this.staffService.toggleStatus(id);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    this.assertAdmin(req);
    return this.staffService.remove(id);
  }

  private assertAdmin(req: AuthenticatedRequest) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }
}
