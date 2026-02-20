import itemChainsRaw from '../data/json/itemChains.json';
import generatorsRaw from '../data/json/droptables.json';
import ordersRaw from '../data/json/orders.json';
import roomsRaw from '../data/json/rooms.json';
import lettersRaw from '../data/json/letters.json';
import episodesRaw from '../data/json/episodes.json';
import branchMomentsRaw from '../data/json/branchMoments.json';
import localizationRaw from '../data/json/localization.en.json';
import iapCatalogRaw from '../data/json/iapCatalog.json';
import type {
  BranchMomentDefinition,
  EpisodeDefinition,
  GeneratorData,
  IapSku,
  ItemChainData,
  LetterDefinition,
  OrderDefinition,
  RoomDefinition,
} from '../types/content';

const itemChains = itemChainsRaw as ItemChainData[];
const generators = generatorsRaw as GeneratorData[];
const orders = ordersRaw as OrderDefinition[];
const rooms = roomsRaw as RoomDefinition[];
const letters = lettersRaw as LetterDefinition[];
const episodes = episodesRaw as EpisodeDefinition[];
const branchMoments = branchMomentsRaw as BranchMomentDefinition[];
const localization = localizationRaw as Record<string, string>;
const iapCatalog = iapCatalogRaw as IapSku[];

export class ContentRepository {
  public readonly itemChains = itemChains;
  public readonly generators = generators;
  public readonly orders = orders;
  public readonly rooms = rooms;
  public readonly letters = letters;
  public readonly episodes = episodes;
  public readonly branchMoments = branchMoments;
  public readonly localization = localization;
  public readonly iapCatalog = iapCatalog;

  private readonly itemById = new Map<string, ItemChainData['tiers'][number]>();
  private readonly chainById = new Map<string, ItemChainData>();
  private readonly orderById = new Map<string, OrderDefinition>();
  private readonly roomById = new Map<string, RoomDefinition>();
  private readonly letterById = new Map<string, LetterDefinition>();
  private readonly branchById = new Map<string, BranchMomentDefinition>();

  constructor() {
    for (const chain of this.itemChains) {
      this.chainById.set(chain.id, chain);
      for (const tier of chain.tiers) {
        this.itemById.set(tier.id, tier);
      }
    }
    for (const order of this.orders) {
      this.orderById.set(order.id, order);
    }
    for (const room of this.rooms) {
      this.roomById.set(room.id, room);
    }
    for (const letter of this.letters) {
      this.letterById.set(letter.id, letter);
    }
    for (const branch of this.branchMoments) {
      this.branchById.set(branch.id, branch);
    }
  }

  public getItem(itemId: string) {
    const item = this.itemById.get(itemId);
    if (!item) {
      throw new Error(`Unknown item id: ${itemId}`);
    }
    return item;
  }

  public getChainByItem(itemId: string): ItemChainData {
    const item = this.getItem(itemId);
    const chain = this.itemChains.find((value) => value.tiers.some((tier) => tier.id === item.id));
    if (!chain) {
      throw new Error(`Chain not found for item ${itemId}`);
    }
    return chain;
  }

  public getChain(chainId: string): ItemChainData {
    const chain = this.chainById.get(chainId);
    if (!chain) {
      throw new Error(`Unknown chain: ${chainId}`);
    }
    return chain;
  }

  public getNextTierItem(itemId: string): string | null {
    const chain = this.getChainByItem(itemId);
    const current = this.getItem(itemId);
    const next = chain.tiers.find((tier) => tier.tier === current.tier + 1);
    return next?.id ?? null;
  }

  public getOrder(orderId: string): OrderDefinition {
    const order = this.orderById.get(orderId);
    if (!order) {
      throw new Error(`Unknown order: ${orderId}`);
    }
    return order;
  }

  public getRoom(roomId: string): RoomDefinition {
    const room = this.roomById.get(roomId);
    if (!room) {
      throw new Error(`Unknown room: ${roomId}`);
    }
    return room;
  }

  public getLetter(letterId: string): LetterDefinition {
    const letter = this.letterById.get(letterId);
    if (!letter) {
      throw new Error(`Unknown letter: ${letterId}`);
    }
    return letter;
  }

  public getBranchMoment(branchId: string): BranchMomentDefinition {
    const branch = this.branchById.get(branchId);
    if (!branch) {
      throw new Error(`Unknown branch moment: ${branchId}`);
    }
    return branch;
  }

  public getGenerator(generatorId: string): GeneratorData {
    const generator = this.generators.find((entry) => entry.id === generatorId);
    if (!generator) {
      throw new Error(`Unknown generator: ${generatorId}`);
    }
    return generator;
  }
}
