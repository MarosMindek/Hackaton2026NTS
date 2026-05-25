// All 48 bugs parsed from BUG_REPORT.md
window.BUGS = [
  {
    id: 1, file: "app.py", line: "30", severity: "High", type: "Python Antipattern", status: "confirmed",
    title: "Mutable default argument `db=[]`",
    desc: "Parameter `db=[]` je mutable default argument — Python vyhodnotí predvolenú hodnotu raz pri definícii funkcie, nie pri každom volaní. Volanie `add_book(...)` bez `db=` použije prázdny list `[]`, čo okamžite spadne s `TypeError` pretože kód pristupuje k `db[\"books\"]` (dict syntax na liste). Navyše ak by sa predvolená hodnota reálne používala, zdieľala by sa medzi všetkými volaniami.",
    repro: "add_book(\"Kniha\", \"Autor\", \"123\")  # chýba db= argument\n# TypeError: list indices must be integers or slices, not str",
    fix: "def add_book(title, author, isbn, copies=1, db=None):\n    if db is None:\n        raise ValueError(\"Argument db je povinný\")\n    for book in db[\"books\"]:\n        ..."
  },
  {
    id: 2, file: "app.py", line: "38", severity: "Medium", type: "Logic", status: "confirmed",
    title: "Neunique ID po zmazaní záznamu",
    desc: "ID sa generuje ako `len(db[\"books\"]) + 1`. Po zmazaní záznamu zo zoznamu sa počet položiek zníži, a nový záznam dostane rovnaké ID ako už existujúci. Výsledkom sú duplikátne primárne kľúče.",
    repro: "db = {\"books\": [], \"members\": [], \"loans\": []}\nadd_book(\"A\", \"Au\", \"111\", 1, db)  # id=1\nadd_book(\"B\", \"Bu\", \"222\", 1, db)  # id=2\ndb[\"books\"].pop(0)                  # zmazanie id=1\nadd_book(\"C\", \"Cu\", \"333\", 1, db)  # id=2 — DUPLIKÁT!",
    fix: "existing_ids = [b[\"id\"] for b in db[\"books\"]]\nnew_id = max(existing_ids, default=0) + 1"
  },
  {
    id: 3, file: "app.py", line: "56", severity: "Medium", type: "Logic", status: "confirmed",
    title: "Case-sensitive vyhľadávanie kníh",
    desc: "Operátor `in` robí porovnanie citlivé na veľkosť písmen. Hľadanie `\"hašek\"` nenájde knihu s autorom `\"Hašek\"`, čo je pre používateľov neintuitívne.",
    repro: "search_books(\"Hašek\", db)   # → [<kniha>]\nsearch_books(\"hašek\", db)   # → []  ← nesprávne\nsearch_books(\"HAŠEK\", db)   # → []  ← nesprávne",
    fix: "q = query.lower()\nif q in book[\"title\"].lower() or q in book[\"author\"].lower():\n    results.append(book)"
  },
  {
    id: 4, file: "app.py", line: "69", severity: "Critical", type: "Null Pointer", status: "confirmed",
    title: "Chýba None-check pre neexistujúceho člena",
    desc: "Ak člen s daným `member_id` neexistuje, premenná `member` zostane `None`. Nasledujúci prístup `member[\"active\"]` vyhodí `TypeError: 'NoneType' object is not subscriptable` a celá funkcia spadne neoštreným výnimkou. Knihy pre ostatných členov nemajú tento problem (tam existuje `if book is None:` na riadku 78).",
    repro: "result = borrow_book(9999, 1, db)\n# TypeError: 'NoneType' object is not subscriptable",
    fix: "member = next((m for m in db[\"members\"] if m[\"id\"] == member_id), None)\nif member is None:\n    return {\"success\": False, \"error\": \"Člen nenájdený\"}\nif not member[\"active\"]:\n    return {\"success\": False, \"error\": \"Člen nie je aktívny\"}"
  },
  {
    id: 5, file: "app.py", line: "82–85", severity: "Medium", type: "Concurrency", status: "confirmed",
    title: "Race condition pri požičiavaní kníh",
    desc: "Kontrola `if book[\"available\"] <= 0` a následný `book[\"available\"] -= 1` nie sú atomické. Pri súčasných požiadavkách (napr. viacero HTTP requestov) môžu obe vlákna prejsť kontrolou pred tým, než niektoré z nich zníži počet — výsledkom je požičanie tej istej knihy dvakrát napriek jednej dostupnej kópii.",
    repro: "Simulovateľné dvoma vláknami volajúcimi borrow_book súčasne pre knihu s available=1.",
    fix: "import threading\n_lock = threading.Lock()\n\ndef borrow_book(member_id, book_id, db):\n    with _lock:\n        # ... celá logika kontroly a dekrmentácie"
  },
  {
    id: 6, file: "app.py", line: "89", severity: "Low", type: "Code Style", status: "false-positive",
    title: "`timedelta(MAX_BORROW_DAYS)` — nesprávny komentár",
    desc: "Komentár v kóde označuje toto ako bug, avšak **kód je funkčný**. Prvý pozičný argument `datetime.timedelta` je `days`, preto `timedelta(14) == timedelta(days=14)`. Napriek tomu je explicitné pomenovanie argumentu odporúčanou praxou pre čitateľnosť.",
    repro: "datetime.timedelta(14) == datetime.timedelta(days=14)  # → True",
    fix: "due_date = today + datetime.timedelta(days=MAX_BORROW_DAYS)"
  },
  {
    id: 7, file: "app.py", line: "116", severity: "Critical", type: "Logic", status: "confirmed",
    title: "Pokuta sa účtuje aj pri vrátení knihy pred termínom",
    desc: "Výpočet `days_late = (return_date - due_date).days` vracia záporné číslo ak je kniha vrátená skôr. Funkcia `abs()` prekonvertuje záporné dni na kladné — výsledok je pokuta napr. `1.00€` za vrátenie 10 dní pred termínom. Správanie je opačné ako má byť.",
    repro: "# Výpožička s termínom za 10 dní\nresult = return_book(loan_id, db)\n# result[\"fine\"] == 1.00  ← pokuta za včasné vrátenie!\n# result[\"days_late\"] == -10",
    fix: "days_late = (return_date - due_date).days\nfine = max(0, days_late) * FINE_PER_DAY  # pokuta iba ak kladné\nreturn {\"success\": True, \"fine\": fine, \"days_late\": days_late}"
  },
  {
    id: 8, file: "app.py", line: "136", severity: "Low", type: "Logic", status: "confirmed",
    title: "História výpožičiek nie je zoradená",
    desc: "`get_member_history()` vracia výpožičky v poradí, v akom boli vložené do databázy — nie chronologicky. Výsledok je nepredvídateľný a nepoužiteľný pre zobrazenie histórie používateľovi.",
    repro: "history = get_member_history(member_id, db)\n# borrow_date: ['2024-03-10', '2024-01-05', '2024-06-20']  ← nezoradené",
    fix: "return sorted(history, key=lambda x: x[\"borrow_date\"])"
  },
  {
    id: 9, file: "app.py", line: "145", severity: "High", type: "Error Handling", status: "confirmed",
    title: "Delenie nulou v `calculate_statistics`",
    desc: "`avg_loans = len(db[\"loans\"]) / total_members` vyhodí `ZeroDivisionError` ak v databáze nie sú žiadni členovia. Táto situácia nastane pri čerstvo inicializovanej databáze alebo po zmazaní všetkých členov.",
    repro: "db = {\"books\": [{\"id\":1,...}], \"members\": [], \"loans\": []}\ncalculate_statistics(db)\n# ZeroDivisionError: division by zero",
    fix: "avg_loans = len(db[\"loans\"]) / total_members if total_members > 0 else 0"
  },
  {
    id: 10, file: "app.py", line: "156", severity: "Medium", type: "Logic", status: "false-positive",
    title: "`sorted(dict)` vracia kľúče, nie tuples",
    desc: "`sorted(most_borrowed, ...)` iteruje po kľúčoch slovníka a vracia zoradený list `book_id` (integers). Komentár v kóde nesprávne popisuje výsledok ako \"list tuples\". Reálny problém: `top_books` obsahuje iba číselné ID kníh, nie ich názvy ani detaily — výsledok štatistík je pre používateľa nepoužiteľný bez ďalšieho lookup-u.",
    repro: "stats = calculate_statistics(db)\nstats[\"top_books\"]  # → [3, 1, 7, ...]  ← len ID, nie názvy kníh",
    fix: "top_ids = sorted(most_borrowed, key=lambda x: most_borrowed[x], reverse=True)[:5]\ntop_books = [\n    {\"book_id\": bid, \"title\": next((b[\"title\"] for b in db[\"books\"] if b[\"id\"] == bid), \"?\"),\n     \"loan_count\": most_borrowed[bid]}\n    for bid in top_ids\n]"
  },
  {
    id: 11, file: "app.py", line: "169", severity: "Medium", type: "Input Validation", status: "confirmed",
    title: "Chýba validácia formátu emailu",
    desc: "`register_member()` akceptuje ľubovoľný reťazec ako email bez akejkoľvek validácie formátu. Systém tak prijme `\"nie_je_email\"`, `\"\"` alebo `\"@\"` ako platné emailové adresy.",
    repro: "register_member(\"Ján\", \"toto_nie_je_email\", db)  # → úspech, id=1\nregister_member(\"Eva\", \"\", db)                    # → úspech, id=2",
    fix: "import re\nEMAIL_RE = re.compile(r\"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$\")\nif not EMAIL_RE.match(email):\n    return {\"success\": False, \"error\": \"Neplatný formát emailu\"}"
  },
  {
    id: 12, file: "app.py", line: "171–173", severity: "High", type: "Logic", status: "confirmed",
    title: "Duplikátne emaily sú povolené",
    desc: "Kontrola duplicitného emailu je implementovaná, ale namiesto vrátenia chyby obsahuje `pass` — kontrola prebehne, nič sa nestane a nový člen sa zaregistruje s rovnakým emailom. Výsledok sú dvaja členovia s identickým emailom, čo znemožňuje jednoznačnú identifikáciu.",
    repro: "register_member(\"User A\", \"rovnaky@email.com\", db)  # → id=1\nregister_member(\"User B\", \"rovnaky@email.com\", db)  # → id=2  ← malo by byť chyba",
    fix: "for m in db[\"members\"]:\n    if m[\"email\"] == email:\n        return {\"success\": False, \"error\": \"Email je už registrovaný\"}"
  },
  {
    id: 13, file: "app.py", line: "15, 190", severity: "Critical", type: "Security", status: "confirmed",
    title: "Slabé MD5 hashovanie a hardcoded heslo",
    desc: "Dvojitý bezpečnostný problém: (1) Heslo `\"admin123\"` je napísané priamo v zdrojovom kóde — každý s prístupom k repozitáru pozná heslo. (2) MD5 je kryptograficky prelomený algoritmus — existujú rainbow tables pre milióny bežných hesiel vrátane `admin123`. Hash `0192023a7bbd73250516f069df18b500` je okamžite crack-ovateľný online.",
    repro: "authenticate_admin(\"admin123\")  # → True\n# MD5 hash: 0192023a7bbd73250516f069df18b500\n# → nájditeľný na https://crackstation.net za <1 sekundu",
    fix: "import os\nimport bcrypt\n\n# Pri nastavení (uložiť do env / config):\n# ADMIN_PASSWORD_HASH = bcrypt.hashpw(b\"silne_heslo\", bcrypt.gensalt())\n\ndef authenticate_admin(password):\n    stored_hash = os.environ.get(\"ADMIN_PASSWORD_HASH\", \"\").encode()\n    return bcrypt.checkpw(password.encode(), stored_hash)"
  },
  {
    id: 14, file: "app.py", line: "204–208", severity: "Medium", type: "Performance", status: "confirmed",
    title: "O(n²) výkon v `export_overdue_loans`",
    desc: "Pre každú omeškanú výpožičku prechádza funkcia celý zoznam členov lineárnym vyhľadávaním. Celková zložitosť je O(n×m) kde n=počet výpožičiek, m=počet členov. Pri 10 000 členoch a 5 000 výpožičkách to znamená 50 miliónov porovnaní.",
    repro: "Merateľné pri len(db[\"loans\"]) > 1000 — výrazný nárast času spracovania.",
    fix: "# Pred cyklom — O(n) príprava\nmember_map = {m[\"id\"]: m[\"name\"] for m in db[\"members\"]}\n\nfor loan in db[\"loans\"]:\n    if not loan[\"returned\"]:\n        ...\n        member_name = member_map.get(loan[\"member_id\"], \"Neznámy\")  # O(1)"
  },
  {
    id: 15, file: "app.py", line: "218–221", severity: "Medium", type: "Error Handling", status: "confirmed",
    title: "Súbor otvorený bez context managera",
    desc: "`f = open(output_file, \"w\")` otvára súbor bez `with` bloku. Ak nastane výnimka medzi `open()` a `f.close()` (napr. pri formátovaní riadku), súbor zostane otvorený — file descriptor unikne, dáta nemusia byť zapísané a súbor môže ostať zamknutý.",
    repro: "# Ak item[\"fine\"] vyhodí výnimku → f.close() sa nikdy nezavolá\nf = open(\"overdue.txt\", \"w\")\nfor item in overdue:\n    f.write(...)  # výnimka tu → súbor zostane otvorený\nf.close()         # nikdy sa nedosiahne",
    fix: "with open(output_file, \"w\", encoding=\"utf-8\") as f:\n    for item in overdue:\n        f.write(f\"{item['loan_id']},{item['member']},{item['fine']:.2f}\\n\")"
  },
  {
    id: 16, file: "app.py", line: "228", severity: "High", type: "Null Pointer", status: "confirmed",
    title: "`IndexError` v `get_book_by_id` pre neexistujúcu knihu",
    desc: "`[b for b in db[\"books\"] if b[\"id\"] == book_id][0]` vyhodí `IndexError: list index out of range` keď kniha s daným ID neexistuje — list comprehension vráti `[]` a `[0]` na prázdnom liste spadne. Funkcia nemá žiadne ošetrenie chýb ani návratovú hodnotu pre prípad nenájdenia.",
    repro: "get_book_by_id(9999, db)\n# IndexError: list index out of range",
    fix: "def get_book_by_id(book_id, db):\n    return next((b for b in db[\"books\"] if b[\"id\"] == book_id), None)"
  },
  {
    id: 17, file: "app.py", line: "235", severity: "Medium", type: "Logic", status: "confirmed",
    title: "Off-by-one chyba v stránkovaní",
    desc: "`start = page * page_size` predpokladá 0-indexované stránky, ale funkcia sa volá s 1-indexovanými (strana 1, 2, 3...). Strana 1 tak vracia `items[10:20]` namiesto `items[0:10]`. Strana 0 vracia prvých 10 položiek, čo nie je intuitívne.",
    repro: "items = list(range(1, 31))\npaginate(items, page=1, page_size=10)\n# → [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]  ← chyba, má byť [1..10]\npaginate(items, page=0, page_size=10)\n# → [1, 2, ..., 10]  ← strana 0? neintuitívne",
    fix: "def paginate(items, page, page_size=10):\n    if page < 1:\n        raise ValueError(f\"Číslo stránky musí byť >= 1, dostalo: {page}\")\n    start = (page - 1) * page_size\n    return items[start:start + page_size]"
  },
  {
    id: 18, file: "app.py", line: "244", severity: "High", type: "Logic", status: "confirmed",
    title: "`update_book_copies` neaktualizuje `available`",
    desc: "Pri úprave počtu výtlačkov sa aktualizuje iba `copies`, ale `available` zostáva nezmenené. Knižnica tak môže mať `copies=10` ale `available=2` — rozdiel neodráža skutočný stav. Nové výtlačky nie sú dostupné na požičanie.",
    repro: "add_book(\"B\", \"A\", \"X\", copies=2, db=db)   # copies=2, available=2\nupdate_book_copies(book_id, delta=3, db=db) # copies=5, available=2  ← chyba",
    fix: "def update_book_copies(book_id, delta, db):\n    for book in db[\"books\"]:\n        if book[\"id\"] == book_id:\n            book[\"copies\"] += delta\n            book[\"available\"] = max(0, book[\"available\"] + delta)\n            return True\n    return False"
  },
  {
    id: 19, file: "models.py", line: "12", severity: "Low", type: "Logic", status: "confirmed",
    title: "`Book.available` nie je validované voči `copies`",
    desc: "Pri vytváraní `Book` objektu sa `available = copies`, ale neskôr môže ktokoľvek nastaviť `book.available = 999` bez akejkoľvek kontroly. Objekt tak môže byť v nekonzistentnom stave kde `available > copies`.",
    repro: "book = Book(1, \"T\", \"A\", \"X\", copies=2)\nbook.available = 100  # žiadna chyba, aj keď copies=2\nbook.available > book.copies  # → True",
    fix: "@property\ndef available(self):\n    return self._available\n\n@available.setter\ndef available(self, value):\n    if value < 0 or value > self.copies:\n        raise ValueError(f\"available musí byť 0–{self.copies}\")\n    self._available = value"
  },
  {
    id: 20, file: "models.py", line: "24–26", severity: "Low", type: "Code Quality", status: "confirmed",
    title: "Chýba metóda `__repr__`",
    desc: "Trieda `Book` má `__str__` ale nemá `__repr__`. Pri debugovaní v interaktívnom prostredí (REPL, logy) sa zobrazí `<models.Book object at 0x...>` namiesto čitateľného výstupu, čo sťažuje diagnostiku.",
    repro: "book = Book(1, \"Švejk\", \"Hašek\", \"978-1\", 3)\nrepr(book)   # → '<models.Book object at 0x7f...>'\nstr(book)    # → 'Švejk by Hašek'",
    fix: "def __repr__(self):\n    return f\"Book(id={self.id!r}, title={self.title!r}, isbn={self.isbn!r})\""
  },
  {
    id: 21, file: "models.py / app.py", line: "29 / 82", severity: "Medium", type: "Logic", status: "confirmed",
    title: "`Book.is_available()` sa nikdy nevolá",
    desc: "Metóda `is_available()` existuje na `Book` objekte, ale `borrow_book()` v `app.py` kontroluje dostupnosť priamo cez `book[\"available\"] <= 0` (dict prístup). Metóda je mŕtvy kód. Ak by sa logika dostupnosti zmenila (napr. rezervácie), zmena v `is_available()` by sa neprejavila v `borrow_book()`.",
    repro: "# Metóda existuje, ale nikde sa nevolá:\nimport inspect\n\"is_available\" in inspect.getsource(borrow_book)  # → False",
    fix: "# V borrow_book() nahradiť:\nif book[\"available\"] <= 0:\n# Za:\nbook_obj = Book(**book)\nif not book_obj.is_available():\n    return {\"success\": False, \"error\": \"Žiadny dostupný výtlačok\"}"
  },
  {
    id: 22, file: "models.py", line: "36", severity: "Medium", type: "Input Validation", status: "confirmed",
    title: "Žiadna validácia emailu v `Member.__init__`",
    desc: "Konštruktor `Member` akceptuje ľubovoľný reťazec ako email. Rovnaký problém ako Bug #11 — validácia by mala byť na úrovni modelu, nie len na úrovni API funkcie.",
    repro: "m = Member(1, \"Ján\", \"nespravny-email\")  # žiadna chyba\nm.email  # → \"nespravny-email\"",
    fix: "import re\nEMAIL_RE = re.compile(r\"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$\")\n\ndef __init__(self, id, name, email):\n    if not EMAIL_RE.match(email):\n        raise ValueError(f\"Neplatný email: {email!r}\")\n    self.email = email\n    ..."
  },
  {
    id: 23, file: "models.py", line: "42", severity: "Low", type: "Maintainability", status: "confirmed",
    title: "Hardcoded limit 5 výpožičiek na člena",
    desc: "Limit maximálneho počtu súčasných výpožičiek je napísaný ako magic number `5` priamo v kóde. Zmena limitu vyžaduje editáciu zdrojového kódu. Okrem toho `borrow_book()` v `app.py` volá `can_borrow()` aj tak nikdy (pozri Bug #27), takže limit sa fakticky nevynucuje.",
    repro: "active_loans = [l for l in self.loans if not l.get(\"returned\", False)]\nreturn len(active_loans) < 5  # ← magic number",
    fix: "MAX_LOANS_PER_MEMBER = 5  # v konfiguračnom súbore alebo konštante\n\ndef can_borrow(self):\n    active_loans = [l for l in self.loans if not l.get(\"returned\", False)]\n    return len(active_loans) < MAX_LOANS_PER_MEMBER"
  },
  {
    id: 24, file: "models.py", line: "49", severity: "High", type: "Logic", status: "confirmed",
    title: "`get_fine_total()` sčítava aj zaplatené pokuty",
    desc: "Metóda sčítava všetky pokuty bez ohľadu na to, či boli zaplatené. Člen, ktorý zaplatil pokutu, ju naďalej vidí v celkovom dlhu. Systém nemá mechanizmus na odlíšenie zaplatených a nezaplatených pokút.",
    repro: "m = Member(1, \"Test\", \"t@t.com\")\nm.loans = [\n    {\"fine\": 2.50, \"paid\": True},   # zaplatená\n    {\"fine\": 1.00, \"paid\": False},  # nezaplatená\n]\nm.get_fine_total()  # → 3.50  ← má byť 1.00",
    fix: "def get_fine_total(self):\n    return sum(\n        loan[\"fine\"]\n        for loan in self.loans\n        if \"fine\" in loan and not loan.get(\"paid\", False)\n    )"
  },
  {
    id: 25, file: "models.py / app.py", line: "62 / 110–124", severity: "Medium", type: "Logic", status: "confirmed",
    title: "`Loan.return_date` sa nikdy nenastavuje pri vrátení",
    desc: "`Loan` objekt má atribút `return_date = None`, ale `return_book()` v `app.py` pracuje s dict reprezentáciou výpožičky a nikdy `return_date` do dictu nezapisuje. História výpožičiek tak neobsahuje dátum vrátenia — nie je možné zistiť kedy bola kniha vrátená.",
    repro: "result = return_book(loan_id, db)\nloan = next(l for l in db[\"loans\"] if l[\"id\"] == loan_id)\n\"return_date\" in loan   # → False  ← chýba\nloan.get(\"return_date\") # → None",
    fix: "# V return_book(), po loan[\"returned\"] = True:\nloan[\"return_date\"] = str(datetime.date.today())"
  },
  {
    id: 26, file: "models.py", line: "67", severity: "High", type: "Type Error", status: "confirmed",
    title: "`Loan.is_overdue()` porovnáva `date` so `string`",
    desc: "`app.py` ukladá `due_date` ako reťazec (`str(due_date)`). Keď sa vytvorí `Loan` objekt s týmto reťazcom a zavolá sa `is_overdue()`, Python vyhodí `TypeError: '>' not supported between instances of 'datetime.date' and 'str'` pretože `datetime.date.today()` je `date` objekt, ale `self.due_date` je `str`.",
    repro: "loan = Loan(1, 1, 1, datetime.date.today(), \"2020-01-01\")\nloan.is_overdue()\n# TypeError: '>' not supported between instances of 'datetime.date' and 'str'",
    fix: "def is_overdue(self):\n    import datetime\n    today = datetime.date.today()\n    due = (self.due_date if isinstance(self.due_date, datetime.date)\n           else datetime.date.fromisoformat(self.due_date))\n    return today > due and not self.returned"
  },
  {
    id: 27, file: "app.py", line: "61–100", severity: "High", type: "Logic", status: "confirmed",
    title: "`borrow_book` nekontroluje limit výpožičiek člena",
    desc: "Metóda `Member.can_borrow()` existuje a kontroluje limit 5 aktívnych výpožičiek, ale `borrow_book()` ju nikdy nevolá. Člen si tak môže požičať neobmedzený počet kníh. Zároveň `borrow_book()` pracuje s dict reprezentáciou, nie s `Member` objektom — čo metódu `can_borrow()` robí mŕtvym kódom.",
    repro: "for i in range(10):\n    add_book(f\"Kniha {i}\", \"Autor\", f\"isbn-{i:03}\", 10, db)\nfor i in range(10):\n    result = borrow_book(member_id, i+1, db)\n    print(result[\"success\"])  # → True všetkých 10 krát",
    fix: "# V borrow_book(), pred book lookup:\nactive_loans = [l for l in db[\"loans\"]\n                if l[\"member_id\"] == member_id and not l[\"returned\"]]\nif len(active_loans) >= 5:\n    return {\"success\": False, \"error\": \"Člen dosiahol limit výpožičiek (5)\"}"
  },
  {
    id: 28, file: "app.py", line: "181, 85–99", severity: "Medium", type: "Logic", status: "confirmed",
    title: "`loans_count` sa nikdy neaktualizuje po výpožičke",
    desc: "Pole `loans_count` sa zapíše pri registrácii člena s hodnotou `0` a nikdy sa neinkrmentuje. `borrow_book()` pridáva záznamy do `db[\"loans\"]` ale ignoruje `member[\"loans_count\"]`. Pole je tak trvale `0` a nedá sa naň spoľahnúť ako na počítadlo výpožičiek.",
    repro: "mid = register_member(\"Ján\", \"jan@test.com\", db)\nborrow_book(mid, book_id, db)\nborrow_book(mid, book_id2, db)\nmember = next(m for m in db[\"members\"] if m[\"id\"] == mid)\nmember[\"loans_count\"]  # → 0  ← má byť 2",
    fix: "# V borrow_book(), po db[\"loans\"].append(loan):\nfor m in db[\"members\"]:\n    if m[\"id\"] == member_id:\n        m[\"loans_count\"] = m.get(\"loans_count\", 0) + 1\n        break"
  },
  {
    id: 29, file: "app.py", line: "19–21", severity: "High", type: "Error Handling", status: "confirmed",
    title: "`load_database` nemá ošetrenie poškodeného JSON",
    desc: "`json.load(f)` vyhodí `JSONDecodeError` ak je databázový súbor poškodený (napr. prerušený zápis, ručná editácia). Výnimka nie je zachytená — aplikácia okamžite spadne pri štarte. Neexistuje žiadny fallback ani zálohovací mechanizmus.",
    repro: "# Zapísať neplatný JSON do DB_FILE\nwith open(\"library_db.json\", \"w\") as f:\n    f.write(\"{ poškodený súbor !!!\")\nload_database()\n# json.decoder.JSONDecodeError: Expecting property name...",
    fix: "def load_database():\n    if os.path.exists(DB_FILE):\n        try:\n            with open(DB_FILE, \"r\", encoding=\"utf-8\") as f:\n                return json.load(f)\n        except json.JSONDecodeError as e:\n            print(f\"VAROVANIE: Databáza je poškodená ({e}), spúšťam prázdnu.\")\n    return {\"books\": [], \"members\": [], \"loans\": []}"
  },
  {
    id: 30, file: "app.py", line: "191", severity: "High", type: "Security", status: "confirmed",
    title: "Timing attack v `authenticate_admin`",
    desc: "Porovnanie hashov cez `==` nie je konštantné v čase — Python preruší porovnanie pri prvom nezhode znaku. Útočník môže meraním doby odpovede (timing attack) postupne zistiť správny hash znak po znaku. Toto je dobre zdokumentovaný útok na autentifikačné systémy. Správna oprava je `hmac.compare_digest()`, ktoré vždy porovná celý reťazec.",
    repro: "import time\n# Heslo začínajúce správnymi znakmi trvá dlhšie ako úplne zlé heslo\nt1 = time.perf_counter(); authenticate_admin(\"a\"); t2 = time.perf_counter()\nt3 = time.perf_counter(); authenticate_admin(\"0192023a\"); t4 = time.perf_counter()\n# (t4-t3) > (t2-t1)  ← merateľný rozdiel pri opakovanom meraní",
    fix: "import hmac\n\ndef authenticate_admin(password):\n    hashed = hashlib.md5(password.encode()).hexdigest()\n    return hmac.compare_digest(hashed, ADMIN_PASSWORD)"
  },
  {
    id: 31, file: "app.py", line: "232–236", severity: "Low", type: "Input Validation", status: "confirmed",
    title: "`paginate` akceptuje záporné čísla stránky",
    desc: "`paginate(items, page=-1)` vypočíta `start = -10`, `end = 0` a vracia `items[-10:0]` čo je vždy prázdny list. Namiesto chybovej hlášky dostane volajúci tiché prázdne výsledky, čo môže maskovať chyby v logike volajúceho kódu.",
    repro: "paginate(list(range(100)), page=-1, page_size=10)\n# → []  ← prázdny list bez chyby, items[-10:0] == []\npaginate(list(range(100)), page=-2, page_size=10)\n# → []  ← rovnako ticho zlyhá",
    fix: "def paginate(items, page, page_size=10):\n    if page < 1:\n        raise ValueError(f\"Číslo stránky musí byť >= 1, dostalo: {page}\")\n    start = (page - 1) * page_size\n    return items[start:start + page_size]"
  },
  {
    id: 32, file: "app.py", line: "63–67", severity: "Low", type: "Performance", status: "confirmed",
    title: "Chýba `break` po nájdení člena v `borrow_book`",
    desc: "Cyklus hľadajúci člena nemá `break` po nájdení — prechádza celý zvyšok zoznamu zbytočne. Pre knihy ten istý vzor `break` obsahuje (riadok 76). Ide o nekonzistenciu a zbytočnú réžiu, ktorá rastie lineárne s počtom členov.",
    repro: "# S 10 000 členmi a hľadaným member_id=1:\n# → cyklus prejde všetkých 10 000 záznamov namiesto zastavenia po prvom",
    fix: "for m in db[\"members\"]:\n    if m[\"id\"] == member_id:\n        member = m\n        break  # ← pridať break"
  },
  {
    id: 33, file: "app.py", line: "239–245", severity: "High", type: "Input Validation", status: "confirmed",
    title: "`update_book_copies` umožňuje záporné `copies`",
    desc: "`update_book_copies(book_id, delta=-10, db)` na knihe s `copies=2` nastaví `copies=-8`. Záporný počet výtlačkov je nezmyselný stav. Navyše kvôli Bug #18 `available` zostane na `2`, čo umožňuje požičiavanie kníh s `copies=-8` (potvrdené COMBO-1 testom).",
    repro: "bid = add_book(\"B\", \"A\", \"X\", 2, db)\nupdate_book_copies(bid, -10, db)\ndb[\"books\"][0]  # → {\"copies\": -8, \"available\": 2}  ← nezmyselný stav\nborrow_book(mid, bid, db)  # → success=True napriek copies=-8 !",
    fix: "def update_book_copies(book_id, delta, db):\n    for book in db[\"books\"]:\n        if book[\"id\"] == book_id:\n            new_copies = book[\"copies\"] + delta\n            if new_copies < 0:\n                raise ValueError(f\"Copies nemôže byť záporné: {new_copies}\")\n            book[\"copies\"] = new_copies\n            book[\"available\"] = max(0, book[\"available\"] + delta)\n            return True\n    return False"
  },
  {
    id: 34, file: "app.py", line: "30–48", severity: "Low", type: "Input Validation", status: "confirmed",
    title: "`add_book` akceptuje `copies=0`",
    desc: "`add_book` s `copies=0` úspešne pridá knihu do databázy s `available=0`. Systém nevyhodí žiadnu chybu ani varovanie. Kniha existuje ale nikdy sa nedá požičať.",
    repro: "bid = add_book(\"Kniha\", \"Autor\", \"X\", 0, db)  # žiadna chyba\ndb[\"books\"][0]  # → {\"copies\": 0, \"available\": 0}\nborrow_book(mid, bid, db)  # → {\"success\": False, \"error\": \"Žiadny dostupný výtlačok\"}",
    fix: "if copies < 1:\n    raise ValueError(f\"Počet výtlačkov musí byť aspoň 1, dostalo: {copies}\")"
  },
  {
    id: 35, file: "app.py", line: "54–58", severity: "Medium", type: "Input Validation", status: "confirmed",
    title: "`search_books(\"\")` vracia všetky knihy",
    desc: "Prázdny reťazec `\"\"` je podreťazcom každého reťazca v Pythone (`\"\" in \"čokoľvek\"` → `True`). Volanie `search_books(\"\", db)` preto vráti celý katalóg. Chýba kontrola prázdneho vstupu.",
    repro: "search_books(\"\", db)   # → všetky knihy v databáze\nsearch_books(\"  \", db) # → všetky knihy (medzery tiež prejdú)",
    fix: "def search_books(query, db):\n    if not query or not query.strip():\n        return []\n    q = query.lower()\n    return [b for b in db[\"books\"]\n            if q in b[\"title\"].lower() or q in b[\"author\"].lower()]"
  },
  {
    id: 36, file: "app.py", line: "167–184", severity: "Medium", type: "Input Validation", status: "confirmed",
    title: "`register_member` akceptuje prázdne meno a email",
    desc: "`register_member(\"\", \"\", db)` úspešne zaregistruje člena s prázdnym menom aj emailom. Žiadna validácia vstupu neexistuje — systém tak obsahuje \"neviditeľných\" členov bez identifikácie.",
    repro: "mid = register_member(\"\", \"\", db)  # → id=1, žiadna chyba\ndb[\"members\"][0]  # → {\"name\": \"\", \"email\": \"\", \"active\": True, ...}",
    fix: "if not name or not name.strip():\n    return {\"success\": False, \"error\": \"Meno nesmie byť prázdne\"}\nif not email or not email.strip():\n    return {\"success\": False, \"error\": \"Email nesmie byť prázdny\"}"
  },
  {
    id: 37, file: "app.py", line: "25–27", severity: "High", type: "Error Handling", status: "confirmed",
    title: "`save_database` nemá ošetrenie chýb zápisu",
    desc: "`save_database()` nemá žiadny `try/except`. Pri zápise do read-only súboru, plnom disku alebo chybe oprávnení vyhodí `PermissionError`/`OSError` bez ošetrenia. Dáta sú ticho stratené — volajúci kód nedostane žiadnu informáciu o zlyhaní.",
    repro: "# Súbor s read-only oprávneniami:\nsave_database(db)\n# PermissionError: [Errno 13] Permission denied — nekontrolovaná výnimka",
    fix: "def save_database(db):\n    try:\n        with open(DB_FILE, \"w\", encoding=\"utf-8\") as f:\n            json.dump(db, f, ensure_ascii=False, indent=2)\n    except OSError as e:\n        raise RuntimeError(f\"Nepodarilo sa uložiť databázu: {e}\") from e"
  },
  {
    id: 38, file: "app.py", line: "194", severity: "High", type: "Security", status: "confirmed",
    title: "Path traversal v `export_overdue_loans`",
    desc: "Parameter `output_file` nie je nijak sanitizovaný. Útočník môže zadať cestu ako `\"../../etc/passwd\"` alebo absolútnu cestu mimo pracovného adresára. Test potvrdil že súbor bol skutočne zapísaný do `C:\\Users\\...\\AppData\\Local\\traversal_test.txt`.",
    repro: "export_overdue_loans(db, \"../../sensitive_file.txt\")\n# → súbor zapísaný mimo pracovného adresára bez akejkoľvek kontroly",
    fix: "import pathlib\ndef export_overdue_loans(db, output_file=\"overdue.txt\"):\n    safe_path = pathlib.Path(output_file).resolve()\n    allowed_dir = pathlib.Path(\".\").resolve()\n    if not str(safe_path).startswith(str(allowed_dir)):\n        raise ValueError(f\"Výstupná cesta musí byť v pracovnom adresári: {safe_path}\")\n    ..."
  },
  {
    id: 39, file: "app.py", line: "167, 30", severity: "Medium", type: "Input Validation", status: "confirmed",
    title: "Žiadny limit dĺžky vstupných reťazcov",
    desc: "Funkcie `register_member` a `add_book` akceptujú reťazce ľubovoľnej dĺžky. Meno s 10 000 znakmi je uložené bez akéhokoľvek upozornenia. Pri ukladaní do JSON to spôsobuje zbytočne veľké súbory a potenciálne DoS pri generovaní reportov.",
    repro: "register_member(\"A\" * 10_000, \"a@a.com\", db)  # → úspech\nadd_book(\"T\" * 50_000, \"A\", \"X\", 1, db)        # → úspech",
    fix: "MAX_NAME_LEN   = 200\nMAX_TITLE_LEN  = 500\n\nif len(name) > MAX_NAME_LEN:\n    raise ValueError(f\"Meno je príliš dlhé (max {MAX_NAME_LEN} znakov)\")"
  },
  {
    id: 40, file: "app.py", line: "219", severity: "Medium", type: "Security", status: "confirmed",
    title: "CSV injection v `export_overdue_loans`",
    desc: "Meno člena obsahujúce čiarku (napr. `\"Novák, Ján\"`) rozbije štruktúru CSV exportu — riadok bude mať 4 stĺpce namiesto 3. Test vrátil `'1,Novák, Ján,0.30'`. Importovanie takého súboru do Excelu alebo iného nástroja skončí nesprávnym parsovaním.",
    repro: "register_member(\"Novák, Ján\", \"n@n.com\", db)\nexport_overdue_loans(db, \"overdue.txt\")\n# obsah: \"1,Novák, Ján,0.30\"  ← 4 polia namiesto 3",
    fix: "import csv, io\noutput = io.StringIO()\nwriter = csv.writer(output)\nwriter.writerow([item[\"loan_id\"], item[\"member\"], f\"{item['fine']:.2f}\"])\nf.write(output.getvalue())"
  },
  {
    id: 41, file: "app.py", line: "30, 61, 227", severity: "High", type: "Type Error", status: "confirmed",
    title: "Typová nekonzistencia — string ID crashuje funkcie",
    desc: "Všetky funkcie predpokladajú že `book_id` a `member_id` sú `int`, ale žiadna to neoveruje. Testovaním potvrdené 3 crashe: `borrow_book(\"1\", 1, db)` → TypeError; `get_book_by_id(\"1\", db)` → IndexError; `search_books(None, db)` → TypeError.",
    repro: "borrow_book(\"1\", 1, db)    # → crash\nget_book_by_id(\"1\", db)    # → crash\nsearch_books(None, db)     # → crash\nadd_book(None, None, None, 1, db)  # → kniha s None hodnotami uložená",
    fix: "def borrow_book(member_id, book_id, db):\n    if not isinstance(member_id, int) or not isinstance(book_id, int):\n        return {\"success\": False, \"error\": \"ID musí byť celé číslo\"}\n    ..."
  },
  {
    id: 42, file: "app.py", line: "231–236", severity: "Low", type: "Input Validation", status: "confirmed",
    title: "`paginate` akceptuje `page_size=0` bez chyby",
    desc: "`paginate(items, page=1, page_size=0)` vráti ticho prázdny list `[]` namiesto vyhodenia `ValueError`. Volajúci kód nedostane žiadnu indikáciu chyby a môže sa nesprávne správať (nekonečná stránkovacia slučka).",
    repro: "paginate(list(range(20)), 1, 0)\n# → []  ← ticho, žiadna chyba, items[0:0] == []",
    fix: "def paginate(items, page, page_size=10):\n    if page < 1:\n        raise ValueError(f\"page musí byť >= 1, dostalo: {page}\")\n    if page_size < 1:\n        raise ValueError(f\"page_size musí byť >= 1, dostalo: {page_size}\")\n    start = (page - 1) * page_size\n    return items[start:start + page_size]"
  },
  {
    id: 43, file: "app.py", line: "219", severity: "Low", type: "Logic", status: "confirmed",
    title: "`export_overdue_loans` obsahuje `book_id` namiesto názvu knihy",
    desc: "Exportovaný súbor obsahuje `book_id` (číslo) namiesto názvu knihy. Správca knižnice musí manuálne dohľadávať každú knihu podľa ID. Test potvrdil formát `\"1,Reader,0.2\"` kde `1` je ID, nie názov.",
    repro: "export_overdue_loans(db, \"overdue.txt\")\n# obsah: \"1,Reader,0.20\"  ← 1 je book_id, nie \"Tajomná Kniha\"",
    fix: "book_title = next((b[\"title\"] for b in db[\"books\"]\n                   if b[\"id\"] == loan[\"book_id\"]), f\"ID:{loan['book_id']}\")\noverdue.append({..., \"book\": book_title, ...})"
  },
  {
    id: 44, file: "app.py", line: "18–22", severity: "High", type: "Error Handling", status: "confirmed",
    title: "`load_database` nevaliduje štruktúru načítaného JSON",
    desc: "`load_database()` zachytí `JSONDecodeError` (navrhnutý fix Bug #29), ale nepokrýva prípad kde JSON je syntakticky platný, no chýbajú povinné kľúče (`\"books\"`, `\"members\"`, `\"loans\"`). Ak databázový súbor obsahuje napr. `{\"books\": [], \"members\": []}`, funkcia vráti neúplný dict. Prvý prístup k `db[\"loans\"]` potom vyhodí `KeyError` kdekoľvek v aplikácii.",
    repro: "# Súbor obsahuje platný JSON bez kľúča \"loans\"\nwith open(\"library_db.json\", \"w\") as f:\n    json.dump({\"books\": [], \"members\": []}, f)\ndb = load_database()\ndb[\"loans\"]   # → KeyError: 'loans'",
    fix: "def load_database():\n    default = {\"books\": [], \"members\": [], \"loans\": []}\n    if os.path.exists(DB_FILE):\n        try:\n            with open(DB_FILE, \"r\", encoding=\"utf-8\") as f:\n                data = json.load(f)\n            for key in default:\n                if key not in data:\n                    data[key] = []\n            return data\n        except json.JSONDecodeError as e:\n            print(f\"VAROVANIE: Databáza je poškodená ({e})\")\n    return default"
  },
  {
    id: 45, file: "app.py", line: "231–236", severity: "Medium", type: "Input Validation", status: "confirmed",
    title: "`paginate` s `page_size=None` → nekontrolovaný `TypeError`",
    desc: "`paginate(items, page=1, page_size=None)` vyhodí `TypeError: unsupported operand type(s) for *: 'int' and 'NoneType'` pri výpočte `start = 1 * None`. Bug #42 rieši `page_size=0` cez `if page_size < 1`, ale `None < 1` samo vyhodí `TypeError` — oprava Bug #42 teda None neošetrí. Potrebná je explicitná typová kontrola.",
    repro: "paginate(list(range(20)), page=1, page_size=None)\n# TypeError: unsupported operand type(s) for *: 'int' and 'NoneType'",
    fix: "def paginate(items, page, page_size=10):\n    if not isinstance(page_size, int) or page_size < 1:\n        raise ValueError(f\"page_size musí byť kladné celé číslo, dostalo: {page_size!r}\")\n    if not isinstance(page, int) or page < 1:\n        raise ValueError(f\"page musí byť >= 1, dostalo: {page!r}\")\n    start = (page - 1) * page_size\n    return items[start:start + page_size]"
  },
  {
    id: 46, file: "app.py", line: "187–191", severity: "High", type: "Input Validation", status: "confirmed",
    title: "`authenticate_admin(None)` → `AttributeError` crash",
    desc: "`authenticate_admin()` volá `password.encode()` bez kontroly typu. Ak volajúci kód odovzdá `None` (napr. chýbajúce pole z formulára), funkcia vyhodí `AttributeError: 'NoneType' object has no attribute 'encode'` namiesto vráteného `False`. Bug #41 pokrýva typové chyby pri ID parametroch, ale `authenticate_admin` zostal bez ochrany.",
    repro: "authenticate_admin(None)\n# AttributeError: 'NoneType' object has no attribute 'encode'",
    fix: "def authenticate_admin(password):\n    if not isinstance(password, str):\n        return False\n    hashed = hashlib.md5(password.encode()).hexdigest()\n    return hmac.compare_digest(hashed, ADMIN_PASSWORD)"
  },
  {
    id: 47, file: "app.py", line: "115–116", severity: "Low", type: "Logic", status: "confirmed",
    title: "Floating point nepresnosť pri výpočte pokút",
    desc: "`fine = abs(days_late) * FINE_PER_DAY` používa binárnu aritmetiku s pohyblivou rádovou čiarkou. Výsledok nie je vždy presný: `3 * 0.10 = 0.30000000000000004`. Pri zobrazení bez formátovania alebo pri porovnaní `fine == 0.30` nastáva chyba. Pre finančné výpočty je štandardom použitie modulu `decimal`.",
    repro: "days_late = 3\nfine = days_late * 0.10\nfine == 0.30   # → False\nrepr(fine)     # → '0.30000000000000004'",
    fix: "from decimal import Decimal\n\nFINE_PER_DAY = Decimal(\"0.10\")\n\ndays_late = (return_date - due_date).days\nfine = max(Decimal(0), Decimal(days_late)) * FINE_PER_DAY\nreturn {\"success\": True, \"fine\": float(fine), \"days_late\": days_late}"
  },
  {
    id: 48, file: "app.py", line: "194–223", severity: "Medium", type: "Data Integrity", status: "confirmed",
    title: "Chýba kontrola referenčnej integrity medzi `loans` a `members`",
    desc: "`export_overdue_loans()` pri nenájdení člena ticho použije náhradnú hodnotu `\"Neznámy\"` namiesto vyvolania chyby. Rovnaký problém platí pre `borrow_book()` — loan môže odkazovať na `book_id` alebo `member_id` ktoré v databáze neexistujú. Systém neoveruje referenčnú integritu pri zápise ani čítaní, čo vedie k nekonzistentným dátam bez varovania.",
    repro: "db[\"loans\"].append({\n    \"id\": 99, \"member_id\": 9999, \"book_id\": 1,\n    \"borrow_date\": \"2024-01-01\", \"due_date\": \"2024-01-15\", \"returned\": False\n})\nexport_overdue_loans(db, \"out.txt\")\n# → zapíše \"99,Neznámy,X.XX\" bez akéhokoľvek varovania",
    fix: "member = next((m for m in db[\"members\"] if m[\"id\"] == loan[\"member_id\"]), None)\nif member is None:\n    print(f\"VAROVANIE: loan {loan['id']} odkazuje na neexistujúceho člena {loan['member_id']}\")\n    member_name = f\"[DELETED:{loan['member_id']}]\"\nelse:\n    member_name = member[\"name\"]"
  }
];
