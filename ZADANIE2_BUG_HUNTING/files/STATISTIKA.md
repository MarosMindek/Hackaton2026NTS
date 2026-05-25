# Štatistika bugov — KnihaPlus v2.3.1

## Celkový prehľad

| Metrika | Hodnota |
|---|---|
| **Celkový počet bugov** | 48 |
| **Potvrdených** | 46 (95,8 %) |
| **False Positives** | 2 (4,2 %) |
| **Originálne (#1–#27)** | 27 |
| **Dodatočne objavené (#28–#48)** | 21 (+77 % navyše) |
| **Počet testov** | 94 |

---

## Rozdelenie podľa závažnosti

| Severity | Počet | % |
|---|---|---|
| **Critical** | 3 | 6,3 % |
| **High** | 16 | 33,3 % |
| **Medium** | 18 | 37,5 % |
| **Low** | 11 | 22,9 % |

> Kritické + High = **19 bugov = 39,6 %** priamo ohrozuje funkčnosť alebo bezpečnosť

---

## Rozdelenie podľa typu

| Typ | Počet |
|---|---|
| Logic | 13 |
| Input Validation | 9 |
| Security | 4 |
| Error Handling | 4 |
| Type Error | 2 |
| Null Pointer | 2 |
| Performance | 2 |
| Code Quality / Style / Maintainability | 3 |
| Concurrency | 1 |
| Python Antipattern | 1 |
| Data Integrity | 1 |

---

## Rozdelenie podľa súboru

| Súbor | Počet bugov |
|---|---|
| `app.py` | 38 |
| `models.py` (výlučne) | 5 |
| Oba súbory | 2 |

---

## Bezpečnostné bugy (Critical riziko)

| # | Popis | Severity |
|---|---|---|
| #13 | Hardcoded heslo + MD5 hash | Critical |
| #30 | Timing attack pri autentifikácii | High |
| #38 | Path traversal vo file exporti | High |
| #40 | CSV injection v exporte | Medium |

---

## Kľúčové zistenia

- **1 z 3 Critical bugov** je bezpečnostná zraniteľnosť (MD5 + hardcoded heslo)
- **Pokuta sa účtovala aj za včasné vrátenie** knihy (Bug #7 — Critical logická chyba)
- **21 bugov odhalených navyše** nad pôvodných 27 — systém bol výrazne podhodnotený
- Dominantné kategórie: **Logic (27 %) + Input Validation (19 %)** = takmer polovica všetkých chýb
- `app.py` obsahuje **79 % všetkých bugov**
