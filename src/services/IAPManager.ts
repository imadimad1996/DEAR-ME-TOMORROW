import type { IapSku } from '../types/content';

export interface PurchaseResult {
  success: boolean;
  skuId: string;
  transactionId?: string;
  reason?: string;
}

export class IAPManager {
  constructor(private readonly skus: IapSku[]) {}

  public listSkus(): IapSku[] {
    return this.skus;
  }

  public async purchase(skuId: string): Promise<PurchaseResult> {
    const sku = this.skus.find((entry) => entry.id === skuId);
    if (!sku) {
      return {
        success: false,
        skuId,
        reason: 'unknown_sku',
      };
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500);
    });

    return {
      success: true,
      skuId,
      transactionId: `txn_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    };
  }
}
