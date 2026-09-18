import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StickerStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { StickerQueueService } from './sticker-queue.service.js';
import { MarkPrintedDto } from './dto/mark-printed.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('sticker-queue')
export class StickerQueueController {
  constructor(private readonly stickerQueueService: StickerQueueService) {}

  @Get('shipment/:shipmentId')
  findByShipment(
    @Param('shipmentId', ParseIntPipe) shipmentId: number,
    @Query('status') status?: string,
  ) {
    return this.stickerQueueService.findByShipment(
      shipmentId,
      this.parseStatus(status),
    );
  }

  @Get('shipment/:shipmentId/count')
  getCountByShipment(@Param('shipmentId', ParseIntPipe) shipmentId: number) {
    return this.stickerQueueService.getCountByShipment(shipmentId);
  }

  @Get('batch/:batchId')
  findByBatch(@Param('batchId') batchId: string) {
    return this.stickerQueueService.findByBatch(batchId);
  }

  @Patch('mark-printed')
  markPrinted(@Req() req: AuthenticatedRequest, @Body() dto: MarkPrintedDto) {
    this.assertAdminOrWarehouse(req);
    return this.stickerQueueService.markPrinted(dto.ids);
  }

  @Patch('shipment/:shipmentId/mark-all-printed')
  markAllPrintedForShipment(
    @Req() req: AuthenticatedRequest,
    @Param('shipmentId', ParseIntPipe) shipmentId: number,
  ) {
    this.assertAdminOrWarehouse(req);
    return this.stickerQueueService.markAllPrintedForShipment(shipmentId);
  }

  private parseStatus(status?: string): StickerStatus | undefined {
    if (!status) return undefined;
    if (status !== StickerStatus.PENDING && status !== StickerStatus.PRINTED) {
      throw new BadRequestException('status must be PENDING or PRINTED');
    }
    return status;
  }

  private assertAdminOrWarehouse(req: AuthenticatedRequest) {
    if (!['ADMIN', 'STAFF_WAREHOUSE'].includes(req.user.role)) {
      throw new ForbiddenException('Admin or warehouse access required');
    }
  }
}
