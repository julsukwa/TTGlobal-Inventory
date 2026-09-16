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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.customersService.findAll(search);
  }

  @Get('export')
  async exportCsv(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    this.assertRole(req, ['ADMIN', 'STAFF_SALES']);

    const csv = await this.customersService.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOne(id);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCustomerDto) {
    this.assertRole(req, ['ADMIN', 'STAFF_SALES']);
    return this.customersService.create(dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    this.assertRole(req, ['ADMIN', 'STAFF_SALES']);
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    this.assertRole(req, ['ADMIN']);
    return this.customersService.remove(id);
  }

  private assertRole(req: AuthenticatedRequest, allowed: string[]) {
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
