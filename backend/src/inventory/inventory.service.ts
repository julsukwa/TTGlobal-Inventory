import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetIdSource, ItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';

export interface InventoryFilters {
  category?: string;
  brand?: string;
  status?: string;
  vendor?: string;
  shipmentId?: string;
  listNumber?: string;
  assetIdSource?: string;
  search?: string;
  processor?: string;
  generation?: string;
  ram?: string;
  storage?: string;
  includeOldIssued?: boolean;
}

const ISSUED_DISPLAY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

const VALID_ITEM_STATUSES = Object.values(ItemStatus);
const VALID_ASSET_ID_SOURCES = Object.values(AssetIdSource);

const PROTECTED_FIELDS = [
  'assetId',
  'assetIdSource',
  'listNumber',
  'batchId',
  'shipmentId',
  'status',
  'importedAt',
];

const inventoryInclude = {
  batch: { select: { batchId: true } },
  shipment: {
    select: {
      shipmentId: true,
      shipmentName: true,
      vendor: { select: { vendorId: true, name: true } },
    },
  },
} satisfies Prisma.InventoryItemInclude;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: InventoryFilters) {
    const where: Prisma.InventoryItemWhereInput = {};

    if (filters?.category) where.category = filters.category;
    if (filters?.brand) where.brand = filters.brand;
    if (filters?.listNumber) where.listNumber = filters.listNumber;
    if (filters?.processor) where.processor = filters.processor;
    if (filters?.generation) where.generation = filters.generation;
    if (filters?.ram) where.ram = filters.ram;
    if (filters?.storage) where.storage = filters.storage;

    if (filters?.status) {
      if (!VALID_ITEM_STATUSES.includes(filters.status as ItemStatus)) {
        throw new BadRequestException(
          `status must be one of: ${VALID_ITEM_STATUSES.join(', ')}`,
        );
      }
      where.status = filters.status as ItemStatus;
    }

    if (filters?.assetIdSource) {
      if (!VALID_ASSET_ID_SOURCES.includes(filters.assetIdSource as AssetIdSource)) {
        throw new BadRequestException(
          `assetIdSource must be one of: ${VALID_ASSET_ID_SOURCES.join(', ')}`,
        );
      }
      where.assetIdSource = filters.assetIdSource as AssetIdSource;
    }

    if (filters?.shipmentId || filters?.vendor) {
      where.shipment = {
        ...(filters.shipmentId ? { shipmentId: filters.shipmentId } : {}),
        ...(filters.vendor ? { vendor: { vendorId: filters.vendor } } : {}),
      };
    }

    // where.OR is reserved below for the always-on ISSUED age filter, so
    // search's OR-based condition is folded into where.AND instead —
    // otherwise the two would clobber each other rather than combine.
    const andConditions: Prisma.InventoryItemWhereInput[] = [];

    if (filters?.search) {
      andConditions.push({
        OR: [
          { assetId: { contains: filters.search, mode: 'insensitive' } },
          { model: { contains: filters.search, mode: 'insensitive' } },
          { listNumber: { contains: filters.search, mode: 'insensitive' } },
          { batch: { batchId: { contains: filters.search, mode: 'insensitive' } } },
        ],
      });
    }

    // Display filter only — ISSUED items older than 90 days are hidden from
    // the default view but never deleted. Always applied unless the caller
    // explicitly opts into seeing everything (e.g. for an audit).
    if (!filters?.includeOldIssued) {
      andConditions.push({
        OR: [
          { status: { not: ItemStatus.ISSUED } },
          {
            status: ItemStatus.ISSUED,
            updatedAt: { gte: new Date(Date.now() - ISSUED_DISPLAY_WINDOW_MS) },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const items = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        ...inventoryInclude,
        adjustments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { importedAt: 'desc' },
    });

    return items.map(({ adjustments, ...item }) => this.attachFaultTypes(item, adjustments));
  }

  async findOne(assetId: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { assetId },
      include: {
        ...inventoryInclude,
        adjustments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item with asset ID "${assetId}" not found`);
    }

    const { adjustments, ...rest } = item;
    return { ...this.attachFaultTypes(rest, adjustments), adjustments };
  }

  async update(assetId: string, dto: UpdateInventoryDto) {
    const attemptedProtected = PROTECTED_FIELDS.filter(
      (field) => field in (dto as Record<string, unknown>),
    );
    if (attemptedProtected.length > 0) {
      throw new BadRequestException(
        `Cannot update protected field(s): ${attemptedProtected.join(', ')}`,
      );
    }

    await this.findRawOrThrow(assetId);

    const item = await this.prisma.inventoryItem.update({
      where: { assetId },
      data: {
        ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
        ...(dto.model !== undefined ? { model: dto.model } : {}),
        ...(dto.processor !== undefined ? { processor: dto.processor } : {}),
        ...(dto.generation !== undefined ? { generation: dto.generation } : {}),
        ...(dto.ram !== undefined ? { ram: dto.ram } : {}),
        ...(dto.storage !== undefined ? { storage: dto.storage } : {}),
        ...(dto.speed !== undefined ? { speed: dto.speed } : {}),
        ...(dto.screenType !== undefined ? { screenType: dto.screenType } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: {
        ...inventoryInclude,
        adjustments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const { adjustments, ...rest } = item;
    return this.attachFaultTypes(rest, adjustments);
  }

  async restoreToOk(assetId: string) {
    const item = await this.findRawOrThrow(assetId);

    if (item.status !== ItemStatus.FAULTY) {
      throw new BadRequestException('Only items with status FAULTY can be restored to OK');
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { assetId },
      data: { status: ItemStatus.OK },
      include: inventoryInclude,
    });

    return { ...updated, faultTypes: [] as string[] };
  }

  async getStats() {
    const [totalInventory, okCount, faultyCount, issuedCount, categoryGroups] = await Promise.all([
      this.prisma.inventoryItem.count(),
      this.prisma.inventoryItem.count({ where: { status: ItemStatus.OK } }),
      this.prisma.inventoryItem.count({ where: { status: ItemStatus.FAULTY } }),
      this.prisma.inventoryItem.count({ where: { status: ItemStatus.ISSUED } }),
      this.prisma.inventoryItem.groupBy({ by: ['category'], _count: { _all: true } }),
    ]);

    return {
      totalInventory,
      okCount,
      faultyCount,
      issuedCount,
      categoryCounts: categoryGroups.map((group) => ({
        category: group.category,
        count: group._count._all,
      })),
    };
  }

  private attachFaultTypes<T extends { status: ItemStatus }>(
    item: T,
    adjustments: { faultTypes: string[] }[],
  ): T & { faultTypes: string[] } {
    return {
      ...item,
      faultTypes: item.status === ItemStatus.FAULTY ? (adjustments[0]?.faultTypes ?? []) : [],
    };
  }

  private async findRawOrThrow(assetId: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { assetId } });
    if (!item) {
      throw new NotFoundException(`Inventory item with asset ID "${assetId}" not found`);
    }
    return item;
  }
}
