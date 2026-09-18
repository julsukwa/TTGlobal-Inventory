import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AdjustmentsModule } from './adjustments/adjustments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { DropdownsModule } from './dropdowns/dropdowns.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import { StaffModule } from './staff/staff.module.js';
import { StickerQueueModule } from './sticker-queue/sticker-queue.module.js';
import { StockInModule } from './stock-in/stock-in.module.js';
import { StockOutModule } from './stock-out/stock-out.module.js';
import { VendorsModule } from './vendors/vendors.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    PrismaModule,
    AuthModule,
    DropdownsModule,
    VendorsModule,
    CustomersModule,
    ShipmentsModule,
    InventoryModule,
    AdjustmentsModule,
    StaffModule,
    StockInModule,
    StockOutModule,
    StickerQueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
