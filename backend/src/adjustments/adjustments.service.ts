import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdjustmentItemDto, CreateAdjustmentDto } from './dto/create-adjustment.dto.js';

export interface AdjustmentFilters {
  search?: string;
  faultType?: string;
  dateFrom?: string;
  dateTo?: string;
}

const adjustmentInclude = {
  inventory: true,
  adjustedBy: { select: { username: true } },
} satisfies Prisma.AdjustmentInclude;

type AdjustmentWithRelations = Prisma.AdjustmentGetPayload<{ include: typeof adjustmentInclude }>;

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function parseDateFilter(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} must be a valid date`);
  }
  return date;
}

@Injectable()
export class AdjustmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: AdjustmentFilters) {
    const where: Prisma.AdjustmentWhereInput = {};

    if (filters?.faultType) {
      where.faultTypes = { has: filters.faultType };
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: parseDateFilter(filters.dateFrom, 'dateFrom') } : {}),
        ...(filters.dateTo ? { lte: parseDateFilter(filters.dateTo, 'dateTo') } : {}),
      };
    }

    if (filters?.search) {
      where.inventory = {
        OR: [
          { assetId: { contains: filters.search, mode: 'insensitive' } },
          { brand: { contains: filters.search, mode: 'insensitive' } },
          { model: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    const adjustments = await this.prisma.adjustment.findMany({
      where,
      include: adjustmentInclude,
      orderBy: { createdAt: 'desc' },
    });

    return adjustments.map((adjustment) => this.toAdjustmentShape(adjustment));
  }

  async create(dto: CreateAdjustmentDto, userId: number) {
    if (!dto.items?.length) {
      throw new BadRequestException('At least one item must be provided');
    }

    for (const item of dto.items) {
      if (!item.assetId?.trim()) {
        throw new BadRequestException('assetId must not be empty');
      }
      if (!item.faultTypes?.length) {
        throw new BadRequestException(
          `At least one fault type is required for asset ${item.assetId}`,
        );
      }
    }

    // De-duplicate by assetId, keeping the first occurrence's fault types/notes.
    const itemsByAssetId = new Map<string, AdjustmentItemDto>();
    for (const item of dto.items) {
      if (!itemsByAssetId.has(item.assetId)) {
        itemsByAssetId.set(item.assetId, item);
      }
    }
    const uniqueItems = [...itemsByAssetId.values()];
    const assetIds = uniqueItems.map((item) => item.assetId);

    const requestedFaultTypes = [...new Set(uniqueItems.flatMap((item) => item.faultTypes))];
    const validFaultTypes = await this.prisma.dropdownValue.findMany({
      where: { category: 'Fault', value: { in: requestedFaultTypes }, isActive: true },
    });
    const validFaultTypeSet = new Set(validFaultTypes.map((f) => f.value));
    const invalidFaultTypes = requestedFaultTypes.filter((f) => !validFaultTypeSet.has(f));
    if (invalidFaultTypes.length > 0) {
      throw new BadRequestException(`Invalid fault type(s): ${invalidFaultTypes.join(', ')}`);
    }

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: { assetId: { in: assetIds } },
    });

    const foundByAssetId = new Map(inventoryItems.map((item) => [item.assetId, item]));
    const missingAssetIds = assetIds.filter((assetId) => !foundByAssetId.has(assetId));
    if (missingAssetIds.length > 0) {
      throw new NotFoundException(`Asset ID(s) not found: ${missingAssetIds.join(', ')}`);
    }

    const alreadyFaulty = inventoryItems.filter((item) => item.status === ItemStatus.FAULTY);
    if (alreadyFaulty.length > 0) {
      throw new ConflictException(
        `Asset ID(s) already faulty: ${alreadyFaulty.map((item) => item.assetId).join(', ')}`,
      );
    }

    const alreadyIssued = inventoryItems.filter((item) => item.status === ItemStatus.ISSUED);
    if (alreadyIssued.length > 0) {
      throw new ConflictException(
        `Asset ID(s) already issued: ${alreadyIssued.map((item) => item.assetId).join(', ')}`,
      );
    }

    const inventoryIds = inventoryItems.map((item) => item.id);

    await this.prisma.$transaction(async (tx) => {
      // Re-check freshly inside the transaction: two concurrent requests could
      // both pass the checks above for the same asset, so the actual guard
      // against a double-adjustment lives in the guarded updateMany below.
      const freshItems = await tx.inventoryItem.findMany({ where: { id: { in: inventoryIds } } });

      const stillNotOk = freshItems.filter((item) => item.status !== ItemStatus.OK);
      if (stillNotOk.length > 0) {
        throw new ConflictException(
          `Asset ID(s) no longer eligible: ${stillNotOk.map((item) => item.assetId).join(', ')}`,
        );
      }

      await tx.adjustment.createMany({
        data: freshItems.map((item) => ({
          inventoryId: item.id,
          adjustedById: userId,
          faultTypes: itemsByAssetId.get(item.assetId)!.faultTypes,
          fromStatus: ItemStatus.OK,
          toStatus: ItemStatus.FAULTY,
          notes: itemsByAssetId.get(item.assetId)!.notes ?? '',
        })),
      });

      const updateResult = await tx.inventoryItem.updateMany({
        where: { id: { in: inventoryIds }, status: ItemStatus.OK },
        data: { status: ItemStatus.FAULTY },
      });

      if (updateResult.count !== freshItems.length) {
        // Something changed status concurrently between the check above and
        // this update — abort so nothing partially commits (Prisma rolls
        // back the whole transaction when the callback throws).
        throw new ConflictException(
          'One or more items changed status concurrently. Please retry.',
        );
      }
    });

    return {
      totalProcessed: uniqueItems.length,
      successful: uniqueItems.length,
      failed: 0,
      results: uniqueItems.map((item) => ({ assetId: item.assetId, success: true })),
    };
  }

  async exportCsv() {
    const adjustments = await this.prisma.adjustment.findMany({
      include: adjustmentInclude,
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'Date',
      'Asset ID',
      'Item Name',
      'Fault Types',
      'From Status',
      'To Status',
      'Adjusted By',
    ];
    const rows = adjustments.map((adjustment) => [
      formatDateTime(adjustment.createdAt),
      adjustment.inventory.assetId,
      `${adjustment.inventory.brand} ${adjustment.inventory.model}`.trim(),
      adjustment.faultTypes.join(' | '),
      adjustment.fromStatus,
      adjustment.toStatus,
      adjustment.adjustedBy.username,
    ]);

    return [header, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\n');
  }

  private toAdjustmentShape(adjustment: AdjustmentWithRelations) {
    const item = adjustment.inventory;
    return {
      id: adjustment.id,
      assetId: item.assetId,
      itemName: `${item.brand} ${item.model}`.trim(),
      category: item.category,
      brand: item.brand,
      model: item.model,
      specs: [item.processor, item.generation, item.ram, item.storage, item.speed]
        .filter(Boolean)
        .join(' • '),
      faultTypes: adjustment.faultTypes,
      fromStatus: adjustment.fromStatus,
      toStatus: adjustment.toStatus,
      notes: adjustment.notes,
      date: formatDateTime(adjustment.createdAt),
      adjustedBy: adjustment.adjustedBy.username,
    };
  }
}
