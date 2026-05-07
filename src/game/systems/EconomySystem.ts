export class EconomySystem {
  gold: number;
  private passiveTimer: number = 0;
  private passiveGoldPerTen: number = 0;

  constructor(startingGold: number) {
    this.gold = startingGold;
  }

  setPassiveGold(perTen: number) {
    this.passiveGoldPerTen = perTen;
  }

  update(dt: number) {
    if (this.passiveGoldPerTen === 0) return;
    this.passiveTimer += dt;
    while (this.passiveTimer >= 10) {
      this.gold += this.passiveGoldPerTen;
      this.passiveTimer -= 10;
    }
  }

  earn(amount: number, mult = 1.0) {
    this.gold += Math.floor(amount * mult);
  }

  spend(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  canAfford(amount: number) {
    return this.gold >= amount;
  }
}
