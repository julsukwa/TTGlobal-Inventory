import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { StockOutService } from './stock-out.service.js';
import { CreateStockOutDto } from './dto/create-stock-out.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('stock-out')
export class StockOutController {
  constructor(private readonly stockOutService: StockOutService) {}

  // Declared before the ':invoiceNumber' route below so a lookup path never
  // gets shadowed by it.
  @Get('lookup/list-number')
  lookupByListNumber(
    @Req() req: AuthenticatedRequest,
    @Query('listNumber') listNumber: string,
    @Query('shipmentId') shipmentId?: string,
  ) {
    this.assertAdminOrSales(req);

    if (!listNumber) {
      throw new BadRequestException('listNumber is required');
    }

    if (shipmentId !== undefined) {
      const parsedShipmentId = Number(shipmentId);
      if (!Number.isInteger(parsedShipmentId)) {
        throw new BadRequestException('shipmentId must be a valid integer');
      }
      return this.stockOutService.getLookupByListNumberAndShipment(listNumber, parsedShipmentId);
    }

    return this.stockOutService.getLookupByListNumber(listNumber);
  }

  @Get('lookup/batch')
  lookupByBatch(@Req() req: AuthenticatedRequest, @Query('batchId') batchId: string) {
    this.assertAdminOrSales(req);

    if (!batchId) {
      throw new BadRequestException('batchId is required');
    }

    return this.stockOutService.getLookupByBatch(batchId);
  }

  @Get()
  findAll(@Query('year') year?: string) {
    let parsedYear: number | undefined;

    if (year !== undefined) {
      parsedYear = Number(year);
      if (!Number.isInteger(parsedYear)) {
        throw new BadRequestException('year must be a valid integer');
      }
    }

    return this.stockOutService.findAll(parsedYear);
  }

  @Get(':invoiceNumber')
  findOne(@Param('invoiceNumber') invoiceNumber: string) {
    return this.stockOutService.findOne(invoiceNumber);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateStockOutDto) {
    this.assertAdminOrSales(req);
    return this.stockOutService.create(dto, req.user.id);
  }

  private assertAdminOrSales(req: AuthenticatedRequest) {
    if (!['ADMIN', 'STAFF_SALES'].includes(req.user.role)) {
      throw new ForbiddenException('Admin or sales access required');
    }
  }
}
