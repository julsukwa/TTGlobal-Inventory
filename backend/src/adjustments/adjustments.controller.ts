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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdjustmentsService } from './adjustments.service.js';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import { UpdateAdjustmentDto } from './dto/update-adjustment.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('adjustments')
export class AdjustmentsController {
  constructor(private readonly adjustmentsService: AdjustmentsService) {}

  // Declared before the bare GET() below so a literal path is never at risk
  // of being shadowed if a ':id' route is added later.
  @Get('export')
  async exportCsv(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    this.assertAdminOrWarehouse(req);

    const csv = await this.adjustmentsService.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="adjustments.csv"');
    res.send(csv);
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('faultType') faultType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    this.assertAdminOrWarehouse(req);
    return this.adjustmentsService.findAll({ search, faultType, dateFrom, dateTo });
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAdjustmentDto) {
    this.assertAdminOrWarehouse(req);
    return this.adjustmentsService.create(dto, req.user.id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdjustmentDto,
  ) {
    this.assertAdminOrWarehouse(req);
    return this.adjustmentsService.update(id, dto);
  }

  private assertAdminOrWarehouse(req: AuthenticatedRequest) {
    if (!['ADMIN', 'STAFF_WAREHOUSE'].includes(req.user.role)) {
      throw new ForbiddenException('Admin or warehouse access required');
    }
  }
}
