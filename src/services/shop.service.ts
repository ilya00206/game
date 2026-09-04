import { GameEventType, ShopItemType, TransactionDirection, type ShopItem, type User } from '@prisma/client';
import { isUniqueViolation, prisma, runInTransaction } from '../db/prisma';
import { gameEvents } from '../events/event-bus';
import { childLogger } from '../utils/logger';
import { lockKey, withLock } from '../utils/mutex';
import { economyService, InsufficientFundsError } from './economy.service';

const log = childLogger('shop');

export type PurchaseFailure =
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'inactive' }
  | { ok: false; reason: 'out_of_stock' }
  | { ok: false; reason: 'limit_reached'; limit: number }
  | { ok: false; reason: 'insufficient_funds'; price: number; balance: number };

export type PurchaseSuccess = {
  ok: true;
  item: ShopItem;
  price: number;
  balance: number;
  purchaseId: string;
};

export type PurchaseResult = PurchaseSuccess | PurchaseFailure;

function readMetadataNumber(metadata: unknown, key: string, fallback: number): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return fallback;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : fallback;
}

export const shopService = {
  async listItems() {
    return prisma.shopItem.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
  },

  async getItem(itemId: string) {
    return prisma.shopItem.findUnique({ where: { id: itemId } });
  },

  /**
   * Buys a shop item.
   *
   * Safety layers, from outside in:
   *  1. per-user in-process lock (kills double taps);
   *  2. single serializable DB transaction;
   *  3. unique idempotency key on the Purchase row;
   *  4. balance check inside the ledger with `SELECT ... FOR UPDATE`.
   *
   * The price is always read from the database, never from callback data.
   */
  async purchase(user: User, itemId: string): Promise<PurchaseResult> {
    return withLock(lockKey('shop', user.id), async () => {
      const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
      if (!item) return { ok: false, reason: 'not_found' };
      if (!item.isActive) return { ok: false, reason: 'inactive' };

      if (item.perUserLimit !== null) {
        const owned = await prisma.purchase.count({ where: { userId: user.id, itemId: item.id } });
        if (owned >= item.perUserLimit) {
          return { ok: false, reason: 'limit_reached', limit: item.perUserLimit };
        }
      }

      if (item.stock !== null && item.stock <= 0) {
        return { ok: false, reason: 'out_of_stock' };
      }

      const idempotencyKey = `shop:${user.id}:${item.id}:${Date.now()}`;

      try {
        const result = await runInTransaction(async (tx) => {
          if (item.stock !== null) {
            const decremented = await tx.shopItem.updateMany({
              where: { id: item.id, stock: { gt: 0 } },
              data: { stock: { decrement: 1 } },
            });
            if (decremented.count === 0) {
              return { ok: false as const, reason: 'out_of_stock' as const };
            }
          }

          const ledger = await economyService.applyLedger(tx, {
            userId: user.id,
            amount: item.price,
            direction: TransactionDirection.DEBIT,
            reason: 'shop_purchase',
            metadata: { itemId: item.id, itemCode: item.code },
            idempotencyKey,
          });

          const purchase = await tx.purchase.create({
            data: {
              userId: user.id,
              itemId: item.id,
              price: item.price,
              idempotencyKey,
              transactionId: ledger.transactionId,
            },
            select: { id: true },
          });

          await shopService.applyItemEffect(tx, user.id, item);

          return { ok: true as const, purchaseId: purchase.id, balance: ledger.balance };
        });

        if (!result.ok) return result;

        log.info({ userId: user.id, itemCode: item.code, price: item.price }, 'shop purchase');
        await gameEvents.emit(GameEventType.SHOP_PURCHASE, {
          userId: user.id,
          itemCode: item.code,
          price: item.price,
        });

        return { ok: true, item, price: item.price, balance: result.balance, purchaseId: result.purchaseId };
      } catch (error) {
        if (error instanceof InsufficientFundsError) {
          return { ok: false, reason: 'insufficient_funds', price: item.price, balance: error.available };
        }
        if (isUniqueViolation(error)) {
          const balance = await economyService.getBalance(user.id);
          return { ok: false, reason: 'insufficient_funds', price: item.price, balance };
        }
        throw error;
      }
    });
  },

  /** Turns a purchased item into its in-game effect. */
  async applyItemEffect(
    tx: Parameters<typeof economyService.applyLedger>[0],
    userId: string,
    item: ShopItem,
  ): Promise<void> {
    switch (item.type) {
      case ShopItemType.STREAK_SHIELD: {
        const amount = readMetadataNumber(item.metadata, 'amount', 1);
        await tx.user.update({ where: { id: userId }, data: { streakShields: { increment: amount } } });
        break;
      }
      case ShopItemType.XP_BOOST:
      case ShopItemType.COSMETIC:
      case ShopItemType.SPECIAL_REWARD:
      case ShopItemType.PERSONAL_REWARD: {
        const quantity = readMetadataNumber(item.metadata, 'amount', 1);
        await tx.inventoryItem.upsert({
          where: { userId_code: { userId, code: item.code } },
          create: { userId, code: item.code, quantity, metadata: item.metadata ?? undefined },
          update: { quantity: { increment: quantity } },
        });
        break;
      }
      default:
        break;
    }
  },

  async getInventory(userId: string) {
    return prisma.inventoryItem.findMany({ where: { userId, quantity: { gt: 0 } }, orderBy: { code: 'asc' } });
  },
};
