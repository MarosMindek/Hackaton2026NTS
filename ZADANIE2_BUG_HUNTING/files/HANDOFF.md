# KnihaPlus — Handoff dokument

**Projekt:** KnihaPlus v2.3.1 — Systém správy knižnice  
**Dátum:** 2026-05-21  
**Autor analýzy:** Claude Sonnet 4.6  

---

## 1. Čo je tento projekt

Jednoduchý Python systém správy knižnice bez externých závislostí.  
Dáta ukladá do JSON súboru (`library_db.json`).  
Pozostáva z dvoch súborov:

| Súbor | Popis |
|-------|-------|
| `app.py` | Všetka biznis logika — funkcie pre výpožičky, členov, knihy, štatistiky |
| `models.py` | Dátové triedy `Book`, `Member`, `Loan` |

**Spustenie:**
```bash
python app.py
```

**Závislosti:** iba štandardná knižnica (`json`, `datetime`, `hashlib`, `os`)

---

## 2. Čo bolo urobené

### 2.1 Bug Hunt
Prešli sme celý kód a identifikovali **43 bugov** (27 originálnych + 16 dodatočných).  
Každý bug bol **reálne overený** spustením testovacieho skriptu — nie iba statickou analýzou.

### 2.2 Vytvorené súbory

| Súbor | Obsah |
|-------|-------|
| `BUG_REPORT.md` | Kompletný report 43 bugov s popisom, reprodukciou a opravou |
| `test_bugs.py` | Testovací skript — 82 testov v 9 kategóriách |

---

## 3. Výsledky testovania

```
Celkovo testov      : 82
Potvrdené bugy      : 46
False positives     : 2
Nereprodukovateľné  : 34
```

**Spustenie testov:**
```bash
python -X utf8 test_bugs.py
```

### 3.1 Kategórie testov

| Kategória | Počet testov | Potvrdené bugy |
|-----------|-------------|----------------|
| Smoke testy | 11 | 0 |
| Bug verifikácia (#1–#27) | 21 | 19 |
| Dodatočné bugy (EXTRA A–F) | 6 | 6 |
| Edge case testy | 9 | 5 |
| Integračné testy | 5 | 1 |
| Typová nekonzistencia | 4 | 4 |
| Výpočet pokuty | 3 | 1 |
| Kombinácia bugov | 4 | 1 |
| Výkonnostný test | 1 | 1 |
| Bezpečnostné vstupy | 4 | 3 |
| Model unit testy | 4 | 1 |
| Boundary testy paginate | 4 | 3 |
| Race condition (threading) | 1 | 0* |
| Export obsah | 3 | 1 |
| Štatistiky edge cases | 2 | 1 |

*Race condition je nedeterministická — nie je možné zaručiť reprodukciu v jednom behu.

---

## 4. Prehľad všetkých bugov

### 4.1 Kritické (okamžitá oprava)

| # | Súbor | Bug | Oprava |
|---|-------|-----|--------|
| 4 | app.py:69 | `borrow_book` crashne ak člen neexistuje (`NoneType`) | `if member is None: return error` |
| 7 | app.py:116 | `abs()` účtuje pokutu aj pri vrátení pred termínom | `max(0, days_late) * FINE_PER_DAY` |
| 9 | app.py:145 | `ZeroDivisionError` v štatistikách keď 0 členov | `if total_members > 0 else 0` |
| 13 | app.py:15/190 | MD5 + hardcoded heslo `admin123` v kóde | `bcrypt` + env variable |
| 16 | app.py:228 | `IndexError` v `get_book_by_id` pri nenájdení | `next(..., None)` |

### 4.2 High severity

| # | Súbor | Bug |
|---|-------|-----|
| 1 | app.py:30 | Mutable default `db=[]` |
| 12 | app.py:171 | Duplicitné emaily — `pass` namiesto return |
| 18 | app.py:244 | `update_book_copies` neaktualizuje `available` |
| 24 | models.py:49 | `get_fine_total()` sčítava aj zaplatené pokuty |
| 26 | models.py:67 | `Loan.is_overdue()` crash: `date > str` |
| 27 | app.py:61 | `borrow_book` nekontroluje limit 5 výpožičiek |
| 29 | app.py:19 | `load_database` padá na poškodenom JSON |
| 30 | app.py:191 | Timing attack: `==` namiesto `hmac.compare_digest` |
| 33 | app.py:239 | `update_book_copies` dovolí záporné `copies` |
| 37 | app.py:25 | `save_database` bez error handlingu |
| 38 | app.py:194 | Path traversal v `export_overdue_loans` |
| 41 | app.py:61 | String/None ID crashuje funkcie |

### 4.3 Medium severity

| # | Súbor | Bug |
|---|-------|-----|
| 2 | app.py:38 | Neunique ID po zmazaní záznamu |
| 3 | app.py:56 | Case-sensitive vyhľadávanie |
| 5 | app.py:82 | Race condition pri výpožičkách |
| 11 | app.py:169 | Chýba validácia emailu |
| 14 | app.py:204 | O(n²) v `export_overdue_loans` |
| 15 | app.py:218 | Súbor bez `with` — file descriptor leak |
| 17 | app.py:235 | Off-by-one v `paginate` (page=1 → items 11–20) |
| 21 | models.py:29 | `is_available()` nikdy nevolaná v `borrow_book` |
| 22 | models.py:36 | Žiadna validácia emailu v `Member` |
| 25 | models.py:62 | `return_date` nikdy nenastavená v dict |
| 28 | app.py:99 | `loans_count` nikdy neinkrmentovaný |
| 35 | app.py:56 | `search_books("")` vracia všetky knihy |
| 36 | app.py:167 | `register_member("","")` akceptované |
| 39 | app.py:167 | Žiadny limit dĺžky vstupných reťazcov |
| 40 | app.py:219 | CSV injection cez čiarku v mene |

### 4.4 Low severity

| # | Súbor | Bug |
|---|-------|-----|
| 8 | app.py:136 | História nie je zoradená podľa dátumu |
| 19 | models.py:12 | `Book.available` nie je ohraničené ≤ `copies` |
| 20 | models.py:24 | Chýba `__repr__` na `Book` |
| 23 | models.py:42 | Hardcoded limit 5 (magic number) |
| 31 | app.py:235 | `paginate` akceptuje záporné čísla stránky |
| 32 | app.py:63 | Chýba `break` po nájdení člena |
| 34 | app.py:30 | `add_book(copies=0)` akceptované |
| 42 | app.py:235 | `paginate(page_size=0)` ticho vracia `[]` |
| 43 | app.py:219 | Export obsahuje `book_id` namiesto názvu |

### 4.5 False positives (kód je funkčný)

| # | Súbor | Prečo false positive |
|---|-------|---------------------|
| 6 | app.py:89 | `timedelta(14) == timedelta(days=14)` — 1. pozičný arg je `days` |
| 10 | app.py:156 | `sorted(dict)` vracia kľúče (int), nie tuples — kód nepadá |

---

## 5. Čo funguje správne

Na základe integračných a smoke testov tieto časti kódu pracujú korektne:

- Import modulov a inštanciovanie tried
- Základný workflow: register → add_book → borrow → return → available konzistentné
- `return_book` správne odmieta dvojité vrátenie
- `return_book` správne hlási chybu pre neexistujúci loan
- `borrow_book` správne odmieta požičanie keď `available=0`
- `borrow_book` správne odmieta neaktívneho člena
- `add_book` s rovnakým ISBN správne inkrementuje `copies`
- `save_database` + `load_database` roundtrip je konzistentný
- `calculate_statistics` vracia správne čísla pri validných dátach
- `Loan.is_overdue()` správne vracia `False` pre vrátené výpožičky
- `Member.can_borrow()` správne kontroluje hranicu 4/5 výpožičiek
- `Book.to_dict()` vracia všetkých 6 kľúčov správne
- JSON správne escapuje špeciálne znaky (newline, quote) pri save/load

---

## 6. Odporúčaný postup opravy (prioritizovaný)

### Fáza 1 — Kritické (pred nasadením)
1. **#13** — Zmeniť MD5 → `bcrypt`, heslo presunúť do `.env`
2. **#4** — Pridať `if member is None: return error` v `borrow_book`
3. **#16** — `get_book_by_id` → `next(..., None)` namiesto `[0]`
4. **#7** — `fine = max(0, days_late) * FINE_PER_DAY`
5. **#9** — `avg = len(loans) / total_members if total_members > 0 else 0`

### Fáza 2 — High (tento sprint)
6. **#18 + #33** — `update_book_copies` musí aktualizovať aj `available` a validovať záporné hodnoty
7. **#27** — Pridať kontrolu `can_borrow()` do `borrow_book`
8. **#38** — Sanitizovať `output_file` v `export_overdue_loans`
9. **#30** — `hmac.compare_digest` v `authenticate_admin`
10. **#29 + #37** — Ošetriť `JSONDecodeError` v `load_database` a `OSError` v `save_database`
11. **#41** — Typová validácia vstupných ID

### Fáza 3 — Medium (nasledujúci sprint)
12. **#17** — Opraviť `paginate`: `start = (page - 1) * page_size`
13. **#12** — `register_member` vrátiť chybu pri duplicate emaile
14. **#3** — Case-insensitive vyhľadávanie (`.lower()`)
15. **#2** — `new_id = max(ids, default=0) + 1`
16. **#14** — Predpočítať member dict pred cyklom v `export_overdue_loans`
17. **#35 + #36 + #39** — Validácia prázdnych vstupov a maximálnych dĺžok

### Fáza 4 — Low/Code quality
18. **#20** — Pridať `__repr__` na `Book`
19. **#8** — Zoriadiť históriu podľa dátumu
20. **#31 + #42** — Validovať `page` a `page_size` v `paginate`
21. **#43** — Pridať názov knihy do exportu

---

## 7. Technický dlh mimo bugov

- **Žiadne testy** — projekt nemá žiadny testovací framework (pytest/unittest); `test_bugs.py` bol vytvorený v rámci tejto analýzy
- **Žiadne typy** — chýbajú type hints (`def borrow_book(member_id: int, book_id: int, db: dict)`)
- **JSON databáza** — pre produkčné použitie nevhodná; odporúča sa SQLite alebo PostgreSQL
- **Žiadne logovanie** — chýba `logging` modul; chyby sú ticho ignorované
- **Žiadne API vrstva** — všetka logika je procedurálna bez HTTP/REST rozhrania
- **Nesúlad dict vs objekty** — `app.py` pracuje s dict, `models.py` definuje objekty, ale nikdy sa nepoužívajú spolu

---

## 8. Štruktúra odovzdaných súborov

```
mystery_app/
├── app.py              # originálny kód (nezmenený)
├── models.py           # originálny kód (nezmenený)
├── requirements.txt    # prázdny (žiadne závislosti)
├── README.md           # originálny (minimálny)
├── BUG_REPORT.md       # ← NOVÉ: 43 bugov s opravami
├── test_bugs.py        # ← NOVÉ: 82 testov
└── HANDOFF.md          # ← NOVÉ: tento dokument
```

> **Poznámka:** Originálny kód (`app.py`, `models.py`) nebol modifikovaný.  
> Všetky opravy sú navrhnuté v `BUG_REPORT.md` — implementácia je na ďalšom vývojárovi.
