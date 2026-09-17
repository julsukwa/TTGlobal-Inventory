import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { StockInService } from './stock-in.service.js';
import { ManualStockInDto } from './dto/manual-stock-in.dto.js';
import { CsvStockInDto } from './dto/csv-stock-in.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('stock-in')
export class StockInController {
  constructor(private readonly stockInService: StockInService) {}

  @Post('manual')
  processManual(@Req() req: AuthenticatedRequest, @Body() dto: ManualStockInDto) {
    this.assertCanStockIn(req);
    return this.stockInService.processManualStockIn(dto, req.user.id);
  }

  @Post('csv')
  processCsv(@Req() req: AuthenticatedRequest, @Body() dto: CsvStockInDto) {
    this.assertCanStockIn(req);
    return this.stockInService.processCsvStockIn(dto, req.user.id);
  }

  @Get('batches/:shipmentId')
  getBatches(@Param('shipmentId', ParseIntPipe) shipmentId: number) {
    return this.stockInService.getBatches(shipmentId);
  }

  @Get('inventory/batch/:batchId')
  getInventoryByBatch(@Param('batchId') batchId: string) {
    return this.stockInService.getInventoryByBatch(batchId);
  }

  @Get('inventory/:shipmentId')
  getInventoryByShipment(
    @Param('shipmentId', ParseIntPipe) shipmentId: number,
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('status') status?: string,
    @Query('listNumber') listNumber?: string,
    @Query('search') search?: string,
  ) {
    return this.stockInService.getInventoryByShipment(shipmentId, {
      category,
      brand,
      status,
      listNumber,
      search,
    });
  }

  private assertCanStockIn(req: AuthenticatedRequest) {
    if (!['ADMIN', 'STAFF_WAREHOUSE'].includes(req.user.role)) {
      throw new ForbiddenException('Admin or warehouse access required');
    }
  }
}
