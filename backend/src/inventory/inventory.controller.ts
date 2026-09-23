import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { InventoryService } from './inventory.service.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';

interface AuthenticatedRequest extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('status') status?: string,
    @Query('vendor') vendor?: string,
    @Query('shipmentId') shipmentId?: string,
    @Query('listNumber') listNumber?: string,
    @Query('assetIdSource') assetIdSource?: string,
    @Query('search') search?: string,
    @Query('processor') processor?: string,
    @Query('generation') generation?: string,
    @Query('ram') ram?: string,
    @Query('storage') storage?: string,
    @Query('includeOldIssued') includeOldIssued?: string,
  ) {
    return this.inventoryService.findAll({
      category,
      brand,
      status,
      vendor,
      shipmentId,
      listNumber,
      assetIdSource,
      search,
      processor,
      generation,
      ram,
      storage,
      includeOldIssued: includeOldIssued === 'true',
    });
  }

  // Declared before ':assetId' so this literal path is never shadowed by it.
  @Get('stats')
  getStats() {
    return this.inventoryService.getStats();
  }

  @Get(':assetId')
  findOne(@Param('assetId') assetId: string) {
    return this.inventoryService.findOne(assetId);
  }

  @Patch(':assetId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    this.assertAdmin(req);
    return this.inventoryService.update(assetId, dto);
  }

  @Patch(':assetId/restore')
  restoreToOk(@Req() req: AuthenticatedRequest, @Param('assetId') assetId: string) {
    this.assertAdminOrWarehouse(req);
    return this.inventoryService.restoreToOk(assetId);
  }

  private assertAdmin(req: AuthenticatedRequest) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  private assertAdminOrWarehouse(req: AuthenticatedRequest) {
    if (!['ADMIN', 'STAFF_WAREHOUSE'].includes(req.user.role)) {
      throw new ForbiddenException('Admin or warehouse access required');
    }
  }
}
