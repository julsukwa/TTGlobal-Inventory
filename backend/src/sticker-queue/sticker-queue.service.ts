import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StickerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const stickerQueueInclude = {
  inventory: {
    include: { batch: true },
  },
} satisfies Prisma.StickerQueueInclude;

type StickerQueueWithRelations = Prisma.StickerQueueGetPayload<{
  include: typeof stickerQueueInclude;
}>;

@Injectable()
export class StickerQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async findByShipment(shipmentId: number, status?: StickerStatus) {
    const entries = await this.prisma.stickerQueue.findMany({
      where: {
        inventory: { shipmentId },
        ...(status ? { status } : {}),
      },
      include: stickerQueueInclude,
      orderBy: { createdAt: 'asc' },
    });

    return entries.map((entry) => this.toShape(entry));
  }

  async findByBatch(batchId: string) {
    const entries = await this.prisma.stickerQueue.findMany({
      where: { inventory: { batch: { batchId } } },
      include: stickerQueueInclude,
      orderBy: { createdAt: 'asc' },
    });

    return entries.map((entry) => this.toShape(entry));
  }

  async markPrinted(ids: number[]) {
    if (!ids?.length) {
      throw new BadRequestException('At least one id must be provided');
    }

    const result = await this.prisma.stickerQueue.updateMany({
      where: { id: { in: ids } },
      data: { status: StickerStatus.PRINTED, printedAt: new Date() },
    });

    return { count: result.count };
  }

  async markAllPrintedForShipment(shipmentId: number) {
    const result = await this.prisma.stickerQueue.updateMany({
      where: { inventory: { shipmentId }, status: StickerStatus.PENDING },
      data: { status: StickerStatus.PRINTED, printedAt: new Date() },
    });

    return { count: result.count };
  }

  async getCountByShipment(shipmentId: number) {
    const count = await this.prisma.stickerQueue.count({
      where: { inventory: { shipmentId }, status: StickerStatus.PENDING },
    });

    return { count };
  }

  private toShape(entry: StickerQueueWithRelations) {
    const item = entry.inventory;
    return {
      id: entry.id,
      assetId: item.assetId,
      listNumber: item.listNumber,
      batchId: item.batch.batchId,
      category: item.category,
      brand: item.brand,
      model: item.model,
      status: entry.status,
      createdAt: entry.createdAt,
      printedAt: entry.printedAt,
    };
  }
}
