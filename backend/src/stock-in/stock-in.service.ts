import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetIdSource, ItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ManualStockInDto, ManualStockInItemDto } from './dto/manual-stock-in.dto.js';
import { CsvStockInDto } from './dto/csv-stock-in.dto.js';

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

export interface StockInResult {
  batchId: string;
  shipmentId: string;
  vendorId: string;
  itemsCreated: number;
  assetIds: string[]; // first 10 only for preview
  totalAssetIds: number;
  listNumbers: string[]; // unique list numbers in this session
  uploadType: string;
}

export interface InventoryFilters {
  category?: string;
  brand?: string;
  status?: string;
  listNumber?: string;
  search?: string;
}

const VALID_ITEM_STATUSES = Object.values(ItemStatus);

@Injectable()
export class StockInService {
  constructor(private readonly prisma: PrismaService) {}

  async getNextBatchSequence(
    shipmentStringId: string,
    vendorId: string,
    year: string,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<number> {
    const prefix = `${shipmentStringId}-${vendorId}-${year}-`;
    const count = await client.stockInBatch.count({
      where: { batchId: { startsWith: prefix } },
    });
    return count + 1;
  }

  async getNextAssetSequence(
    listNumber: string,
    year: string,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<number> {
    const prefix = `${listNumber}-${year}-`;
    const count = await client.inventoryItem.count({
      where: { assetId: { startsWith: prefix } },
    });
    return count + 1;
  }

  async generateBatchId(
    shipment: { shipmentId: string },
    vendor: { vendorId: string },
    client: PrismaClientOrTx = this.prisma,
  ): Promise<string> {
    const year = this.currentYearSuffix();
    const sequence = await this.getNextBatchSequence(
      shipment.shipmentId,
      vendor.vendorId,
      year,
      client,
    );
    return `${shipment.shipmentId}-${vendor.vendorId}-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  async generateAssetId(listNumber: string, client: PrismaClientOrTx = this.prisma): Promise<string> {
    const year = this.currentYearSuffix();
    const sequence = await this.getNextAssetSequence(listNumber, year, client);
    return `${listNumber}-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  async processManualStockIn(dto: ManualStockInDto, userId: number): Promise<StockInResult> {
    return this.processStockIn(dto.shipmentId, dto.items, userId, 'manual');
  }

  async processCsvStockIn(dto: CsvStockInDto, userId: number): Promise<StockInResult> {
    if (dto.uploadType === 'detailed') {
      const invalidRow = dto.rows.some((row) => row.quantity !== 1);
      if (invalidRow) {
        throw new BadRequestException('Detailed CSV uploads must have quantity 1 for every row');
      }
    }

    const uploadType = dto.uploadType === 'detailed' ? 'csv-detailed' : 'csv-summary';
    return this.processStockIn(dto.shipmentId, dto.rows, userId, uploadType);
  }

  async getBatches(shipmentId: number) {
    await this.assertShipmentExists(shipmentId);

    return this.prisma.stockInBatch.findMany({
      where: { shipmentId },
      include: {
        importedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInventoryByShipment(shipmentId: number, filters?: InventoryFilters) {
    await this.assertShipmentExists(shipmentId);

    const where: Prisma.InventoryItemWhereInput = { shipmentId };

    if (filters?.category) where.category = filters.category;
    if (filters?.brand) where.brand = filters.brand;
    if (filters?.listNumber) where.listNumber = filters.listNumber;

    if (filters?.status) {
      if (!VALID_ITEM_STATUSES.includes(filters.status as ItemStatus)) {
        throw new BadRequestException(
          `status must be one of: ${VALID_ITEM_STATUSES.join(', ')}`,
        );
      }
      where.status = filters.status as ItemStatus;
    }

    if (filters?.search) {
      where.OR = [
        { assetId: { contains: filters.search, mode: 'insensitive' } },
        { listNumber: { contains: filters.search, mode: 'insensitive' } },
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.inventoryItem.findMany({ where, orderBy: { importedAt: 'desc' } });
  }

  async getInventoryByBatch(batchId: string) {
    const batch = await this.prisma.stockInBatch.findUnique({ where: { batchId } });
    if (!batch) {
      throw new NotFoundException(`Batch "${batchId}" not found`);
    }

    return this.prisma.inventoryItem.findMany({
      where: { batchId: batch.id },
      orderBy: { importedAt: 'desc' },
    });
  }

  private async processStockIn(
    shipmentId: number,
    items: ManualStockInItemDto[],
    userId: number,
    uploadType: string,
  ): Promise<StockInResult> {
    this.validateItems(items);

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { vendor: true },
    });
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${shipmentId} not found`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const batchId = await this.generateBatchId(shipment, shipment.vendor, tx);
        const batch = await tx.stockInBatch.create({
          data: {
            batchId,
            shipmentId: shipment.id,
            importedById: userId,
            uploadType,
            itemsCreated: 0,
          },
        });

        const createdAssetIds: string[] = [];
        const listNumbers: string[] = [];

        for (const item of items) {
          if (!listNumbers.includes(item.listNumber)) {
            listNumbers.push(item.listNumber);
          }

          for (let unit = 0; unit < item.quantity; unit++) {
            const assetId =
              item.assetIdSource === 'provided'
                ? (item.providedAssetId as string)
                : await this.generateAssetId(item.listNumber, tx);

            const inventoryItem = await tx.inventoryItem.create({
              data: {
                assetId,
                assetIdSource:
                  item.assetIdSource === 'provided'
                    ? AssetIdSource.PROVIDED
                    : AssetIdSource.GENERATED,
                listNumber: item.listNumber,
                batchId: batch.id,
                shipmentId: shipment.id,
                category: item.category,
                condition: item.condition ?? '',
                brand: item.brand,
                model: item.model,
                processor: item.processor ?? '',
                generation: item.generation ?? '',
                ram: item.ram ?? '',
                storage: item.storage ?? '',
                speed: item.speed ?? '',
                screenType: item.screenType ?? '',
                notes: item.notes ?? '',
                status: ItemStatus.OK,
              },
            });

            // Every item is queued for a sticker regardless of asset ID source.
            await tx.stickerQueue.create({ data: { inventoryId: inventoryItem.id } });

            createdAssetIds.push(assetId);
          }
        }

        await tx.stockInBatch.update({
          where: { id: batch.id },
          data: { itemsCreated: createdAssetIds.length },
        });

        return {
          batchId,
          shipmentId: shipment.shipmentId,
          vendorId: shipment.vendor.vendorId,
          itemsCreated: createdAssetIds.length,
          assetIds: createdAssetIds.slice(0, 10),
          totalAssetIds: createdAssetIds.length,
          listNumbers,
          uploadType,
        };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          'One or more provided asset IDs already exist in the system',
        );
      }
      throw err;
    }
  }

  private validateItems(items: ManualStockInItemDto[]) {
    if (!items || items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(
          `quantity must be a positive integer for list number "${item.listNumber}"`,
        );
      }

      if (item.assetIdSource !== 'generated' && item.assetIdSource !== 'provided') {
        throw new BadRequestException(
          `assetIdSource must be "generated" or "provided" for list number "${item.listNumber}"`,
        );
      }

      if (item.assetIdSource === 'provided') {
        if (!item.providedAssetId || !item.providedAssetId.trim()) {
          throw new BadRequestException(
            `providedAssetId is required when assetIdSource is "provided" (list number "${item.listNumber}")`,
          );
        }
        if (item.quantity > 1) {
          throw new BadRequestException(
            `quantity must be 1 when assetIdSource is "provided" (list number "${item.listNumber}")`,
          );
        }
      }
    }
  }

  private currentYearSuffix(): string {
    return String(new Date().getFullYear()).slice(-2);
  }

  private async assertShipmentExists(shipmentId: number) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${shipmentId} not found`);
    }
  }
}
