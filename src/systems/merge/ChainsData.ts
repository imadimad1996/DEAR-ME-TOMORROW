export type ChainId = 'wood' | 'culinary' | 'ocean' | 'tech';

export interface ChainTier {
  tier: number;
  id: string;
  asset: string;
  color: number;
}

export interface ChainDefinition {
  id: ChainId;
  displayName: string;
  enabledMVP: boolean;
  tiers: ChainTier[];
}

const makeTier = (tier: number, id: string, asset: string, color: number): ChainTier => ({
  tier,
  id,
  asset,
  color,
});

export const CHAINS: ChainDefinition[] = [
  {
    id: 'wood',
    displayName: 'Woodworking',
    enabledMVP: true,
    tiers: [
      makeTier(1, 'wood_t1_scrap', '/assets/items/wood/wood_t1_scrap.png', 0xb58967),
      makeTier(2, 'wood_t2_plank', '/assets/items/wood/wood_t2_plank.png', 0xc69a72),
      makeTier(3, 'wood_t3_board', '/assets/items/wood/wood_t3_board.png', 0xd3a77c),
      makeTier(4, 'wood_t4_shelf', '/assets/items/wood/wood_t4_shelf.png', 0xdba66f),
      makeTier(5, 'wood_t5_cabinet_door', '/assets/items/wood/wood_t5_cabinet_door.png', 0x66d6ff),
      makeTier(6, 'wood_t6_cupboard', '/assets/items/wood/wood_t6_cupboard.png', 0x8ee6ff),
      makeTier(7, 'wood_t7_wardrobe', '/assets/items/wood/wood_t7_wardrobe.png', 0xffd56b),
      makeTier(8, 'wood_t8_armoire', '/assets/items/wood/wood_t8_armoire.png', 0xffe09a),
    ],
  },
  {
    id: 'culinary',
    displayName: 'Culinary',
    enabledMVP: true,
    tiers: [
      makeTier(1, 'culinary_t1_flour', '/assets/items/culinary/culinary_t1_flour.png', 0xedd8ba),
      makeTier(2, 'culinary_t2_dough', '/assets/items/culinary/culinary_t2_dough.png', 0xefc78b),
      makeTier(3, 'culinary_t3_bread', '/assets/items/culinary/culinary_t3_bread.png', 0xe3b178),
      makeTier(4, 'culinary_t4_sandwich', '/assets/items/culinary/culinary_t4_sandwich.png', 0xd89862),
      makeTier(5, 'culinary_t5_pastry', '/assets/items/culinary/culinary_t5_pastry.png', 0x66d6ff),
      makeTier(6, 'culinary_t6_cake', '/assets/items/culinary/culinary_t6_cake.png', 0x9ce8ff),
      makeTier(7, 'culinary_t7_wedding_cake', '/assets/items/culinary/culinary_t7_wedding_cake.png', 0xffd773),
      makeTier(8, 'culinary_t8_banquet', '/assets/items/culinary/culinary_t8_banquet.png', 0xffefb1),
    ],
  },
  {
    id: 'ocean',
    displayName: 'Oceanic Treasures',
    enabledMVP: false,
    tiers: [
      makeTier(1, 'ocean_t1_shell', '/assets/items/ocean/ocean_t1_shell.png', 0x8fc7dc),
      makeTier(2, 'ocean_t2_pearl', '/assets/items/ocean/ocean_t2_pearl.png', 0x7eb8e8),
      makeTier(3, 'ocean_t3_jewellery_box', '/assets/items/ocean/ocean_t3_jewellery_box.png', 0x63add5),
      makeTier(4, 'ocean_t4_necklace', '/assets/items/ocean/ocean_t4_necklace.png', 0x4e9fc6),
      makeTier(5, 'ocean_t5_crown', '/assets/items/ocean/ocean_t5_crown.png', 0x66d6ff),
      makeTier(6, 'ocean_t6_mermaid_statue', '/assets/items/ocean/ocean_t6_mermaid_statue.png', 0x9eeeff),
      makeTier(7, 'ocean_t7_fountain', '/assets/items/ocean/ocean_t7_fountain.png', 0xffd96f),
      makeTier(8, 'ocean_t8_monument', '/assets/items/ocean/ocean_t8_monument.png', 0xffecad),
    ],
  },
  {
    id: 'tech',
    displayName: 'Tech Through Time',
    enabledMVP: false,
    tiers: [
      makeTier(1, 'tech_t1_wires', '/assets/items/tech/tech_t1_wires.png', 0xbec9d4),
      makeTier(2, 'tech_t2_circuit_board', '/assets/items/tech/tech_t2_circuit_board.png', 0x97b2c9),
      makeTier(3, 'tech_t3_radio', '/assets/items/tech/tech_t3_radio.png', 0x7f9fb8),
      makeTier(4, 'tech_t4_television', '/assets/items/tech/tech_t4_television.png', 0x688aa8),
      makeTier(5, 'tech_t5_computer', '/assets/items/tech/tech_t5_computer.png', 0x66d6ff),
      makeTier(6, 'tech_t6_vr_headset', '/assets/items/tech/tech_t6_vr_headset.png', 0x9be9ff),
      makeTier(7, 'tech_t7_ai_assistant', '/assets/items/tech/tech_t7_ai_assistant.png', 0xffd968),
      makeTier(8, 'tech_t8_time_core', '/assets/items/tech/tech_t8_time_core.png', 0xfff2b8),
    ],
  },
];

export function getChain(id: ChainId): ChainDefinition {
  const found = CHAINS.find((chain) => chain.id === id);
  if (!found) {
    throw new Error(`Unknown chain: ${id}`);
  }
  return found;
}

export function getTierData(chainId: ChainId, tier: number): ChainTier {
  const chain = getChain(chainId);
  const result = chain.tiers.find((entry) => entry.tier === tier);
  if (!result) {
    throw new Error(`Unknown tier for ${chainId}: ${tier}`);
  }
  return result;
}

export function getMvpEnabledChains(): ChainDefinition[] {
  return CHAINS.filter((chain) => chain.enabledMVP);
}
