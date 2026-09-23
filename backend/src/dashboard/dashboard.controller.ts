import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DashboardService } from './dashboard.service.js';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('lists')
  getLists(@Query('status') status?: string) {
    return this.dashboardService.getLists(status);
  }

  @Get('inventory')
  getAvailableInventory(
    @Query('status') status?: string,
    @Query('listNumber') listNumber?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('processor') processor?: string,
    @Query('generation') generation?: string,
    @Query('ram') ram?: string,
    @Query('storage') storage?: string,
  ) {
    return this.dashboardService.getAvailableInventory({
      status,
      listNumber,
      search,
      category,
      brand,
      processor,
      generation,
      ram,
      storage,
    });
  }
}
