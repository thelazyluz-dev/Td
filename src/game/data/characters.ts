export interface CharacterDef {
  id: string;
  name: string;
  baseHP: number;
  startingGold: number;
  perkDescription: string;
  lockedTowers: string[];
  spCost: number;
}

export const CHARACTER_DEFS: CharacterDef[] = [
  {
    id: 'veteran',
    name: 'The Veteran',
    baseHP: 20,
    startingGold: 200,
    perkDescription: '+10% damage to all towers',
    lockedTowers: [],
    spCost: 0,
  },
  {
    id: 'engineer',
    name: 'The Engineer',
    baseHP: 25,
    startingGold: 250,
    perkDescription: 'All towers -20% cost, -15% damage',
    lockedTowers: [],
    spCost: 200,
  },
  {
    id: 'doctor',
    name: 'The Doctor',
    baseHP: 30,
    startingGold: 150,
    perkDescription: 'Regen +1 HP every 20 seconds',
    lockedTowers: ['Mortar'],
    spCost: 300,
  },
  {
    id: 'hunter',
    name: 'The Hunter',
    baseHP: 18,
    startingGold: 200,
    perkDescription: 'Snipers +60% dmg/+30% range. Crawlers auto-revealed.',
    lockedTowers: ['MachineGun'],
    spCost: 500,
  },
  {
    id: 'survivor',
    name: 'The Survivor',
    baseHP: 15,
    startingGold: 50,
    perkDescription: '2.5x gold from enemies. High risk.',
    lockedTowers: [],
    spCost: 1000,
  },
];
