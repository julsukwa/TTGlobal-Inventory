import { BadRequestException, Injectable } from '@nestjs/common';
import { ItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DashboardInventoryFilters {
  status?: string;
  listNumber?: string;
  search?: string;
  category?: string;
  brand?: string;
  processor?: string;
  generation?: string;
  ram?: string;
  storage?: string;
}

type ListStatus = 'closed' | 'open' | 'sold';

const VALID_AVAILABLE_STATUSES: ItemStatus[] = [ItemStatus.OK, ItemStatus.FAULTY];
const VALID_LIST_STATUSES: ListStatus[] = ['closed', 'open', 'sold'];

const dashboardInventoryInclude = {
  batch: { select: { batchId: true } },
  shipment: {
    select: {
      shipmentId: true,
      shipmentName: true,
      vendor: { select: { vendorId: true, name: true } },
    },
  },
} satisfies Prisma.InventoryItemInclude;

interface ListBreakdown {
  listNumber: string;
  totalItems: number;
  okCount: number;
  faultyCount: number;
  issuedCount: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [totalAvailable, okCount, faultyCount, breakdown] = await Promise.all([
      this.prisma.inventoryItem.count({
        where: { status: { in: VALID_AVAILABLE_STATUSES } },
      }),
      this.prisma.inventoryItem.count({ where: { status: ItemStatus.OK } }),
      this.prisma.inventoryItem.count({ where: { status: ItemStatus.FAULTY } }),
      this.getListBreakdown(),
    ]);

    const totalLists = breakdown.length;
    const openLists = breakdown.filter(
      (list) => list.issuedCount > 0 && (list.okCount > 0 || list.faultyCount > 0),
    ).length;

    const { isEndOfMonth, daysUntilMonthEnd } = this.getMonthEndInfo();

    return {
      totalAvailable,
      okCount,
      faultyCount,
      totalLists,
      openLists,
      isEndOfMonth,
      daysUntilMonthEnd,
    };
  }

  async getLists(statusFilter?: string) {
    if (statusFilter && !VALID_LIST_STATUSES.includes(statusFilter as ListStatus)) {
      throw new BadRequestException(
        `status must be one of: ${VALID_LIST_STATUSES.join(', ')}`,
      );
    }

    const breakdown = await this.getListBreakdown();

    const lists = breakdown
      .map((list) => ({
        ...list,
        status: this.resolveListStatus(list),
      }))
      .filter((list) => !statusFilter || list.status === statusFilter)
      .sort((a, b) => a.listNumber.localeCompare(b.listNumber));

    return lists;
  }

  async getAvailableInventory(filters?: DashboardInventoryFilters) {
    const where: Prisma.InventoryItemWhereInput = {
      status: { in: VALID_AVAILABLE_STATUSES },
    };

    if (filters?.status) {
      if (!VALID_AVAILABLE_STATUSES.includes(filters.status as ItemStatus)) {
        throw new BadRequestException(
          `status must be one of: ${VALID_AVAILABLE_STATUSES.join(', ')}`,
        );
      }
      where.status = filters.status as ItemStatus;
    }

    if (filters?.listNumber) where.listNumber = filters.listNumber;
    if (filters?.category) where.category = filters.category;
    if (filters?.brand) where.brand = filters.brand;
    if (filters?.processor) where.processor = filters.processor;
    if (filters?.generation) where.generation = filters.generation;
    if (filters?.ram) where.ram = filters.ram;
    if (filters?.storage) where.storage = filters.storage;

    if (filters?.search) {
      where.OR = [
        { assetId: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
        { listNumber: { contains: filters.search, mode: 'insensitive' } },
        { batch: { batchId: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.inventoryItem.findMany({
      where,
      include: dashboardInventoryInclude,
      orderBy: { importedAt: 'desc' },
    });
  }

  private async getListBreakdown(): Promise<ListBreakdown[]> {
    // Items with no list number (see stock-in's ShipmentID-YY-NNNN asset IDs)
    // aren't part of any list and never appear on the Lists page.
    const groups = await this.prisma.inventoryItem.groupBy({
      by: ['listNumber', 'status'],
      where: { listNumber: { not: '' } },
      _count: { _all: true },
    });

    const listMap = new Map<string, ListBreakdown>();

    for (const group of groups) {
      const existing = listMap.get(group.listNumber) ?? {
        listNumber: group.listNumber,
        totalItems: 0,
        okCount: 0,
        faultyCount: 0,
        issuedCount: 0,
      };

      const count = group._count._all;
      existing.totalItems += count;
      if (group.status === ItemStatus.OK) existing.okCount += count;
      if (group.status === ItemStatus.FAULTY) existing.faultyCount += count;
      if (group.status === ItemStatus.ISSUED) existing.issuedCount += count;

      listMap.set(group.listNumber, existing);
    }

    return [...listMap.values()];
  }

  private resolveListStatus(list: ListBreakdown): ListStatus {
    if (list.issuedCount === 0) return 'closed';
    if (list.okCount === 0 && list.faultyCount === 0) return 'sold';
    return 'open';
  }

  private getMonthEndInfo() {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysUntilMonthEnd = lastDayOfMonth - now.getDate();
    const isEndOfMonth = daysUntilMonthEnd <= 6;

    return { isEndOfMonth, daysUntilMonthEnd };
  }
}
