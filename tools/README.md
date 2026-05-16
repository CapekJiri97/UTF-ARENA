# Balance Analysis Tools

Sada nástrojů pro analýzu a vyvažování hrdinek v UTF ARENA.

## Soubory

### `balance_analysis.js`
Generuje kompletní balance report se všemi metrikami jednotlivých hrdinů.

**Klíčové výpočty:**

#### Base Stats
- **HP**: `base.hp + 15 * (level - 1)`
- **AD/AP**: `base.baseAD/AP + 1 * (level - 1)`
- **Armor/MR**: `base.armor/mr + item bonuses`

#### Attack Damage (AA)
- **Formula**: `baseAtk + aaScale * (totalAD pro physical, totalAP pro magical)`
- `baseAtk` - Pevná hodnota z třídy (např. 35)
- `aaScale` - Koeficient z třídy (0.3 - 0.75)
- `totalAD/AP` - Včetně level bonusů a itemů

**Příklad (Vanguard - physical):**
- baseAtk = 35
- baseAD = 45
- aaScale = 0.55
- Na levelu 1: AA damage = 35 + 0.55 * 45 = 35 + 24.75 ≈ 60
- Na levelu 5: AA damage = 35 + 0.55 * (45 + 4) = 35 + 26.95 ≈ 62

#### Spell Damage
- **Formula**: `baseDamage + (spellLevel × scaleLevel) + (totalAD × scaleAD) + (totalAP × scaleAP)`

**Příklad (Vanguard Q):**
- baseDamage = 75
- scaleLevel = 8 (default) - _výjimky mají svou vlastní hodnotu_
- scaleAD = 0.20
- scaleAP = 0
- Na levelu 1, spell level 1: dmg = 75 + (1 × 8) + (AD × 0.20) + 0 = 83 + (AD × 0.20)

#### Item Effects
Itemy jsou distribuovány následovně (na počet `itemCount`):
- **40%** Power items: +15 AD/AP
- **30%** HP items: +14% max HP
- **15%** Defense items: +25% armor/mr
- **15%** Utility items: +0.15 attack speed

Toto odpovídá nému systému ze `items.js` kde:
- Basic Power: +20% baseAD/AP (na úrovni ~+15)
- Basic HP: +14% max HP
- Basic Armor/MR: +25%
- Basic Attack Speed: +15%

### `summarize_report.js`
Vytváří přehledný souhrn balance reportu s tier listy podle různých metrik.

Výstupy:
- **Top Heroes** podle Burst DMG, DPS, HPS, Utility/CC, Phase Score, Control Score
- **Weak Heroes** podle phase power
- **Averages** - průměrné hodnoty napříč všemi scenáriema

## Spuštění

```bash
# Vygeneruj balance_report.json
node balance_analysis.js

# Vytiskni souhrn
node summarize_report.js
```

## Metriky

### Phase Score
Vážená kombinace DPS, Burst, HPS, Utility a Survivability podle herní fáze.
- **Early** (level ≤2, items ≤1): DPS 0.55, Burst 0.22, HPS 0.65, Util 1.90, Surv 0.012
- **Mid** (level ≤6 nebo items ≤3): DPS 0.48, Burst 0.16, HPS 0.75, Util 1.75, Surv 0.014
- **Late** (ostatní): DPS 0.42, Burst 0.12, HPS 0.85, Util 1.60, Surv 0.016

### Control Score
Měří schopnost ovládat boj (CC, healing, survivability):
- `(utilityScore × 1.4) + (totalHPS × 1.1) + (survivability × 0.008)`

### Utility Score
Boduje:
- Stun: `stunDuration × 150`
- Silence: `silenceDuration × 100`
- Slow: `slowDuration × 40`
- Knockback/Dash: fixní body
- Shields: `shieldAmount + scalings`
- Zvláštní efekty (invulnerability, atd.)

### Time To Kill (TTK)
Čas k zabití různých archetype cílů (squishy, skirmisher, frontline, support).

## Poznámky

- Spell level se počítá: 1 na L1, 3 na L5, 5 na L10
- Summon DPS jsou odhadovány jako % spell damage s CD
- Level scaling je automaticky aplikován pro všechny spelly
- Item scaling je simulován lineárně bez učení o kombinacích
