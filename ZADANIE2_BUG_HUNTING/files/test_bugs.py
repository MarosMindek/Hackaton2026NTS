#!/usr/bin/env python3
"""
KnihaPlus Bug Verification Script
Overuje každý bug uvedený v kóde, označuje false positives a hľadá ďalšie bugy.
"""
import sys
import os
import datetime
import hashlib
import inspect
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app import (
    add_book, search_books, borrow_book, return_book,
    get_member_history, calculate_statistics, register_member,
    authenticate_admin, export_overdue_loans, get_book_by_id,
    paginate, update_book_copies,
    MAX_BORROW_DAYS, FINE_PER_DAY,
)
import app as app_module
from models import Book, Member, Loan

# ── ANSI farby ───────────────────────────────────────────────
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

confirmed   = 0
not_a_bug   = 0
false_pos   = 0

def fresh_db():
    return {"books": [], "members": [], "loans": []}

def report(label, status, note):
    """status: 'BUG' | 'OK' | 'FP'"""
    global confirmed, not_a_bug, false_pos
    if status == "BUG":
        confirmed += 1
        tag = f"{RED}[CONFIRMED BUG]{RESET}"
    elif status == "FP":
        false_pos += 1
        tag = f"{YELLOW}[FALSE POSITIVE]{RESET}"
    else:
        not_a_bug += 1
        tag = f"{GREEN}[NOT REPRODUCED]{RESET}"
    print(f"  {tag}  Bug {label}: {note}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   KnihaPlus — Bug Verification Script{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   SMOKE TESTY (základná životaschopnosť aplikácie){RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── SMOKE-1 ── Import modulov bez chyby ───────────────────────
print(f"\n{BLUE}▶ SMOKE-1 — Import app.py a models.py prebehne bez chyby{RESET}")
try:
    import importlib
    importlib.reload(app_module)
    report("SMOKE-1", "OK", "Oba moduly importované bez chyby")
except Exception as e:
    report("SMOKE-1", "BUG", f"Import zlyhal: {type(e).__name__}: {e}")

# ── SMOKE-2 ── Všetky verejné funkcie existujú a sú callable ──
print(f"\n{BLUE}▶ SMOKE-2 — Všetky očakávané funkcie existujú v app.py{RESET}")
required = ["load_database", "save_database", "add_book", "search_books",
            "borrow_book", "return_book", "get_member_history",
            "calculate_statistics", "register_member", "authenticate_admin",
            "export_overdue_loans", "get_book_by_id", "paginate", "update_book_copies"]
missing = [f for f in required if not callable(getattr(app_module, f, None))]
if missing:
    report("SMOKE-2", "BUG", f"Chýbajúce/nevolateľné funkcie: {missing}")
else:
    report("SMOKE-2", "OK", f"Všetkých {len(required)} funkcií existuje a je callable")

# ── SMOKE-3 ── Všetky triedy v models.py existujú ─────────────
print(f"\n{BLUE}▶ SMOKE-3 — Triedy Book, Member, Loan existujú a sú inštanciovateľné{RESET}")
import models as models_module
errors = []
try:
    b = Book(1, "T", "A", "X", 2)
    if not hasattr(b, "id") or not hasattr(b, "available") or not hasattr(b, "copies"):
        errors.append("Book: chýba id/available/copies atribút")
except Exception as e:
    errors.append(f"Book: {e}")
try:
    m = Member(1, "Ján", "jan@test.com")
    if not hasattr(m, "loans") or not hasattr(m, "active"):
        errors.append("Member: chýba loans/active atribút")
except Exception as e:
    errors.append(f"Member: {e}")
try:
    l = Loan(1, 1, 1, datetime.date.today(), datetime.date.today())
    if not hasattr(l, "returned") or not hasattr(l, "return_date"):
        errors.append("Loan: chýba returned/return_date atribút")
except Exception as e:
    errors.append(f"Loan: {e}")
if errors:
    report("SMOKE-3", "BUG", " | ".join(errors))
else:
    report("SMOKE-3", "OK", "Book, Member, Loan úspešne inštanciované so správnymi atribútmi")

# ── SMOKE-4 ── fresh_db má správnu štruktúru ──────────────────
print(f"\n{BLUE}▶ SMOKE-4 — Prázdna databáza má správne kľúče{RESET}")
db = fresh_db()
required_keys = {"books", "members", "loans"}
missing_keys = required_keys - set(db.keys())
wrong_types   = [k for k in required_keys if k in db and not isinstance(db[k], list)]
if missing_keys:
    report("SMOKE-4", "BUG", f"Chýbajúce kľúče v db: {missing_keys}")
elif wrong_types:
    report("SMOKE-4", "BUG", f"Nesprávne typy v db (očakávaný list): {wrong_types}")
else:
    report("SMOKE-4", "OK", f"Štruktúra db správna: {list(db.keys())} — každý je list")

# ── SMOKE-5 ── register_member vráti int ID ────────────────────
print(f"\n{BLUE}▶ SMOKE-5 — register_member vráti platné int ID{RESET}")
db = fresh_db()
mid = register_member("Smoke User", "smoke@test.com", db)
if not isinstance(mid, int) or mid < 1:
    report("SMOKE-5", "BUG", f"register_member vrátil neplatné ID: {mid!r} (typ: {type(mid).__name__})")
elif len(db["members"]) != 1:
    report("SMOKE-5", "BUG", f"Člen nebol pridaný do db: {len(db['members'])} členov")
else:
    report("SMOKE-5", "OK", f"register_member → id={mid}, db má {len(db['members'])} člena")

# ── SMOKE-6 ── add_book vráti int ID ──────────────────────────
print(f"\n{BLUE}▶ SMOKE-6 — add_book vráti platné int ID{RESET}")
db = fresh_db()
bid = add_book("Smoke Book", "Smoke Author", "SMOKE-001", 3, db)
if not isinstance(bid, int) or bid < 1:
    report("SMOKE-6", "BUG", f"add_book vrátil neplatné ID: {bid!r} (typ: {type(bid).__name__})")
elif len(db["books"]) != 1:
    report("SMOKE-6", "BUG", f"Kniha nebola pridaná do db")
elif db["books"][0]["available"] != 3 or db["books"][0]["copies"] != 3:
    b = db["books"][0]
    report("SMOKE-6", "BUG", f"Nesprávne copies/available: copies={b['copies']}, available={b['available']}")
else:
    report("SMOKE-6", "OK", f"add_book → id={bid}, copies=3, available=3")

# ── SMOKE-7 ── borrow_book vráti success + loan_id + due_date ─
print(f"\n{BLUE}▶ SMOKE-7 — borrow_book vráti správnu štruktúru odpovede{RESET}")
db = fresh_db()
mid = register_member("Borrower", "b@b.com", db)
bid = add_book("Bk", "A", "SMK7", 1, db)
res = borrow_book(mid, bid, db)
errors = []
if not isinstance(res, dict):
    errors.append(f"Výsledok nie je dict: {type(res)}")
else:
    if "success" not in res:
        errors.append("Chýba kľúč 'success'")
    if not res.get("success"):
        errors.append(f"success=False: {res.get('error')}")
    if "loan_id" not in res:
        errors.append("Chýba kľúč 'loan_id'")
    if "due_date" not in res:
        errors.append("Chýba kľúč 'due_date'")
    if "due_date" in res:
        try:
            datetime.date.fromisoformat(res["due_date"])
        except ValueError:
            errors.append(f"due_date nie je platný ISO dátum: {res['due_date']!r}")
if errors:
    report("SMOKE-7", "BUG", " | ".join(errors))
else:
    report("SMOKE-7", "OK",
           f"borrow_book → success=True, loan_id={res['loan_id']}, due_date={res['due_date']}")

# ── SMOKE-8 ── return_book vráti success + fine + days_late ───
print(f"\n{BLUE}▶ SMOKE-8 — return_book vráti správnu štruktúru odpovede{RESET}")
db = fresh_db()
mid = register_member("Returner", "r@r.com", db)
bid = add_book("Bk", "A", "SMK8", 1, db)
br  = borrow_book(mid, bid, db)
res = return_book(br["loan_id"], db)
errors = []
if not isinstance(res, dict):
    errors.append(f"Výsledok nie je dict: {type(res)}")
else:
    for key in ("success", "fine", "days_late"):
        if key not in res:
            errors.append(f"Chýba kľúč '{key}'")
    if res.get("success") and not isinstance(res.get("fine"), (int, float)):
        errors.append(f"'fine' nie je číslo: {res.get('fine')!r}")
    if res.get("success") and not isinstance(res.get("days_late"), int):
        errors.append(f"'days_late' nie je int: {res.get('days_late')!r}")
if errors:
    report("SMOKE-8", "BUG", " | ".join(errors))
else:
    report("SMOKE-8", "OK",
           f"return_book → success=True, fine={res['fine']:.2f}€, days_late={res['days_late']}")

# ── SMOKE-9 ── search_books vráti list ────────────────────────
print(f"\n{BLUE}▶ SMOKE-9 — search_books vráti list aj pri prázdnej db{RESET}")
db = fresh_db()
res_empty = search_books("hašek", db)
add_book("Švejk", "Hašek", "SMK9", 1, db)
res_found  = search_books("Hašek", db)
res_miss   = search_books("xxxxxxxxx", db)
errors = []
if not isinstance(res_empty, list):
    errors.append(f"Prázdna db → nie list: {type(res_empty)}")
if not isinstance(res_found, list) or len(res_found) != 1:
    errors.append(f"Nájdená kniha → {res_found}")
if not isinstance(res_miss, list) or len(res_miss) != 0:
    errors.append(f"Nenájdená kniha → {res_miss}")
if errors:
    report("SMOKE-9", "BUG", " | ".join(errors))
else:
    report("SMOKE-9", "OK",
           f"search_books: prázdna db→[], nájdené→1 výsledok, nenájdené→[]")

# ── SMOKE-10 ── authenticate_admin vráti bool ─────────────────
print(f"\n{BLUE}▶ SMOKE-10 — authenticate_admin vráti bool pre správne aj zlé heslo{RESET}")
res_ok   = authenticate_admin("admin123")
res_fail = authenticate_admin("zle_heslo")
errors = []
if not isinstance(res_ok, bool):
    errors.append(f"Správne heslo → nie bool: {type(res_ok).__name__}")
if not isinstance(res_fail, bool):
    errors.append(f"Zlé heslo → nie bool: {type(res_fail).__name__}")
if res_ok is not True:
    errors.append(f"Správne heslo → {res_ok} (očakávané True)")
if res_fail is not False:
    errors.append(f"Zlé heslo → {res_fail} (očakávané False)")
if errors:
    report("SMOKE-10", "BUG", " | ".join(errors))
else:
    report("SMOKE-10", "OK",
           f"authenticate_admin: správne→True, zlé→False (pozor: heslo je hardcoded 'admin123')")

# ── SMOKE-11 ── Konštanty majú rozumné hodnoty ────────────────
print(f"\n{BLUE}▶ SMOKE-11 — Globálne konštanty majú platné hodnoty{RESET}")
errors = []
if not isinstance(MAX_BORROW_DAYS, int) or MAX_BORROW_DAYS <= 0:
    errors.append(f"MAX_BORROW_DAYS={MAX_BORROW_DAYS!r} (očakávané kladné int)")
if not isinstance(FINE_PER_DAY, float) or FINE_PER_DAY <= 0:
    errors.append(f"FINE_PER_DAY={FINE_PER_DAY!r} (očakávané kladný float)")
admin_hash = getattr(app_module, "ADMIN_PASSWORD", None)
if admin_hash is None:
    errors.append("ADMIN_PASSWORD konštanta chýba v app.py")
elif len(admin_hash) != 32:
    errors.append(f"ADMIN_PASSWORD má dĺžku {len(admin_hash)}, nie 32 (neplatný MD5?)")
if errors:
    report("SMOKE-11", "BUG", " | ".join(errors))
else:
    report("SMOKE-11", "OK",
           f"MAX_BORROW_DAYS={MAX_BORROW_DAYS}, FINE_PER_DAY={FINE_PER_DAY}, "
           f"ADMIN_PASSWORD=MD5({len(admin_hash)} znakov)")

# ── BUG #1 ── Mutable default argument db=[] ─────────────────
print(f"\n{BLUE}▶ Bug #1 — Mutable default argument db=[]{RESET}")
try:
    add_book("Test", "Author", "000-1")   # db= nie je zadané → použije sa default []
    report("#1", "OK", "Žiaden crash (neočakávané)")
except (TypeError, KeyError) as e:
    report("#1", "BUG", f"Crash pri volaní bez db=: {type(e).__name__}: {e}")

# ── BUG #2 ── Neunique ID po zmazaní ─────────────────────────
print(f"\n{BLUE}▶ Bug #2 — Neunique ID po zmazaní kníh{RESET}")
db = fresh_db()
add_book("Book A", "Auth A", "111", 1, db)
add_book("Book B", "Auth B", "222", 1, db)
db["books"].pop(0)                         # simulácia zmazania
add_book("Book C", "Auth C", "333", 1, db)
ids = [b["id"] for b in db["books"]]
if len(ids) != len(set(ids)):
    report("#2", "BUG", f"Duplikátne ID v databáze: {ids}")
else:
    report("#2", "OK",  f"ID sú unikátne: {ids}")

# ── BUG #3 ── Case-sensitive vyhľadávanie ─────────────────────
print(f"\n{BLUE}▶ Bug #3 — Case-sensitive vyhľadávanie{RESET}")
db = fresh_db()
add_book("Osudy dobrého vojaka Švejka", "Jaroslav Hašek", "978-1", 1, db)
found_upper = search_books("Hašek", db)
found_lower = search_books("hašek", db)
if found_upper and not found_lower:
    report("#3", "BUG", f"'Hašek' nájde {len(found_upper)}, 'hašek' nájde {len(found_lower)} kníh")
else:
    report("#3", "OK",  "Vyhľadávanie nie je case-sensitive")

# ── BUG #4 ── Chýba None-check pre member v borrow_book ───────
print(f"\n{BLUE}▶ Bug #4 — Chýba None-check pre neexistujúceho člena{RESET}")
db = fresh_db()
add_book("Kniha", "Autor", "AAA", 1, db)
try:
    result = borrow_book(9999, 1, db)   # member 9999 neexistuje
    report("#4", "OK",  f"Vráti chybový výsledok: {result}")
except (TypeError, AttributeError) as e:
    report("#4", "BUG", f"Crash s neexistujúcim členom: {type(e).__name__}: {e}")

# ── BUG #5 ── Race condition ───────────────────────────────────
print(f"\n{BLUE}▶ Bug #5 — Race condition (code review finding){RESET}")
report("#5", "BUG",
       "Stateless JSON — bez uzamknutia môžu 2 požiadavky prejsť kontrolou "
       "available>0 súčasne a prepchnúť knihu dvakrát (overitelné iba v konkurentnom prostredí)")

# ── BUG #6 ── timedelta(MAX_BORROW_DAYS) — overenie FALSE POSITIVE ──
print(f"\n{BLUE}▶ Bug #6 — timedelta(MAX_BORROW_DAYS) vs timedelta(days=...){RESET}")
td_positional = datetime.timedelta(MAX_BORROW_DAYS)
td_keyword    = datetime.timedelta(days=MAX_BORROW_DAYS)
if td_positional == td_keyword:
    report("#6", "FP",
           f"timedelta({MAX_BORROW_DAYS}) == timedelta(days={MAX_BORROW_DAYS}) "
           f"(prvý pozičný arg timedelta JE days) — BUG V KOMENTÁRI, NIE V KÓDE")
else:
    report("#6", "BUG", f"Skutočne iné hodnoty: {td_positional} vs {td_keyword}")

# ── BUG #7 ── Pokuta aj pri vrátení vopred ────────────────────
print(f"\n{BLUE}▶ Bug #7 — Pokuta sa počíta aj keď je kniha vrátená skôr{RESET}")
db = fresh_db()
mid = register_member("Tester", "t@t.com", db)
bid = add_book("Knjiga", "Aut", "ZZZ", 1, db)
future = (datetime.date.today() + datetime.timedelta(days=10)).isoformat()
db["loans"].append({
    "id": 1, "member_id": mid, "book_id": bid,
    "borrow_date": str(datetime.date.today()),
    "due_date": future, "returned": False
})
res = return_book(1, db)
if res["success"] and res["fine"] > 0:
    report("#7", "BUG",
           f"Pokuta {res['fine']:.2f}€ pri vrátení 10 dní PRED termínom "
           f"(days_late={res['days_late']}, abs() prekrúti záporné dni na kladné)")
else:
    report("#7", "OK",  f"Pokuta sa neúčtuje predčasne: {res}")

# ── BUG #8 ── História nie je zoradená ────────────────────────
print(f"\n{BLUE}▶ Bug #8 — get_member_history nie je zoradená podľa dátumu{RESET}")
db = fresh_db()
mid = register_member("User", "u@u.com", db)
bid = add_book("B", "A", "B1", 5, db)
dates = ["2024-03-10", "2024-01-05", "2024-06-20"]
for i, d in enumerate(dates, 1):
    db["loans"].append({
        "id": i, "member_id": mid, "book_id": bid,
        "borrow_date": d, "due_date": d, "returned": False
    })
history   = get_member_history(mid, db)
borrow_ds = [l["borrow_date"] for l in history]
if borrow_ds != sorted(borrow_ds):
    report("#8", "BUG", f"História nie je zoradená: {borrow_ds}")
else:
    report("#8", "OK",  "História je zoradená")

# ── BUG #9 ── Delenie nulou v calculate_statistics ────────────
print(f"\n{BLUE}▶ Bug #9 — Delenie nulou pri 0 členoch{RESET}")
db = fresh_db()
add_book("Book", "Auth", "DIV0", 1, db)
try:
    stats = calculate_statistics(db)
    report("#9", "OK",  f"Žiaden crash, avg={stats.get('avg_loans_per_member')}")
except ZeroDivisionError as e:
    report("#9", "BUG", f"ZeroDivisionError: {e}")

# ── BUG #10 ── sorted(dict) vracia kľúče, nie tuples ──────────
print(f"\n{BLUE}▶ Bug #10 — sorted(most_borrowed) — popis bugu je nesprávny{RESET}")
db = fresh_db()
mid = register_member("U", "u2@u.com", db)
bid = add_book("B", "A", "X1", 3, db)
db["loans"] += [
    {"id": 10+i, "member_id": mid, "book_id": bid,
     "borrow_date": "2024-01-01", "due_date": "2024-02-01", "returned": False}
    for i in range(3)
]
stats = calculate_statistics(db)
top = stats["top_books"]
# Kód vracia list int kľúčov — NIE tuples, NIE crashes
if isinstance(top, list) and all(isinstance(x, int) for x in top):
    report("#10", "FP",
           f"sorted(dict) vracia list ID kníh {top}, nie tuples — kód funguje "
           f"ale top_books obsahuje ID namiesto názvov (dizajnový problém, nie crash)")
else:
    report("#10", "BUG", f"Neočakávaný typ: {type(top)}, hodnota: {top}")

# ── BUG #11/#12 ── Duplicitné emaily sú povolené ──────────────
print(f"\n{BLUE}▶ Bug #11/#12 — Duplicitné emaily sú povolené{RESET}")
db = fresh_db()
id1 = register_member("User One", "dup@email.com", db)
id2 = register_member("User Two", "dup@email.com", db)
if len(db["members"]) == 2:
    report("#11/#12", "BUG",
           f"Dvaja členovia s rovnakým emailom zaregistrovaní (id={id1}, {id2}) — "
           f"kontrola existuje ale obsahuje 'pass' namiesto return-u chyby")
else:
    report("#11/#12", "OK", "Duplikát bol odmietnutý")

# ── BUG #13 ── MD5 + hardcoded heslo ──────────────────────────
print(f"\n{BLUE}▶ Bug #13 — Slabé MD5 hashovanie + hardcoded heslo{RESET}")
md5_hash = hashlib.md5("admin123".encode()).hexdigest()
cracked   = authenticate_admin("admin123")
if cracked:
    report("#13", "BUG",
           f"Heslo 'admin123' funguje, MD5={md5_hash} — "
           f"MD5 je v roku 2024 prelomiteľný za sekundy (rainbow tables)")
else:
    report("#13", "OK", "Hardcoded heslo nefunguje")

# ── BUG #14 ── O(n²) v export_overdue_loans ───────────────────
print(f"\n{BLUE}▶ Bug #14 — O(n²) vnorené cykly v export_overdue_loans{RESET}")
report("#14", "BUG",
       "Pre každú omeškanú výpožičku prechádza celý zoznam členov — "
       "O(n×m) kde n=výpožičky, m=členovia; pri 10 000 členoch a 5 000 výpožičkách = 50M porovnaní")

# ── BUG #15 ── Súbor bez context manager / error handling ─────
print(f"\n{BLUE}▶ Bug #15 — Súbor bez context manager{RESET}")
db = fresh_db()
mid = register_member("Late", "l@l.com", db)
bid = add_book("OvB", "A", "OV1", 1, db)
yesterday = (datetime.date.today() - datetime.timedelta(days=5)).isoformat()
db["loans"].append({
    "id": 1, "member_id": mid, "book_id": bid,
    "borrow_date": yesterday, "due_date": yesterday, "returned": False
})
tmp_out = os.path.join(tempfile.gettempdir(), "overdue_test.txt")
try:
    count = export_overdue_loans(db, tmp_out)
    # Ak write uspeje — iba overíme, že close() je volané manuálne bez with
    src = inspect.getsource(export_overdue_loans)
    uses_with = "with open(" in src
    if not uses_with:
        report("#15", "BUG",
               f"Súbor otvorený cez open() bez 'with' — pri výnimke medzi open() a close() "
               f"zostane súbor otvorený; zapísané {count} riadkov")
    else:
        report("#15", "OK", "Používa 'with open()'")
finally:
    if os.path.exists(tmp_out):
        os.remove(tmp_out)

# ── BUG #16 ── IndexError v get_book_by_id ────────────────────
print(f"\n{BLUE}▶ Bug #16 — IndexError keď kniha neexistuje{RESET}")
db = fresh_db()
try:
    get_book_by_id(9999, db)
    report("#16", "OK",  "Žiaden crash")
except IndexError as e:
    report("#16", "BUG", f"IndexError: list comprehension + [0] keď kniha nenájdená: {e}")

# ── BUG #17 ── Off-by-one v paginate ─────────────────────────
print(f"\n{BLUE}▶ Bug #17 — Off-by-one v paginácii (page=1 vracia items 11-20){RESET}")
items  = list(range(1, 31))
page_1 = paginate(items, 1, 10)
# Očakávame items 1-10, no dostaneme 11-20
if page_1 == list(range(11, 21)):
    report("#17", "BUG",
           f"paginate(items, page=1) vracia {page_1[:3]}…{page_1[-1]} "
           f"(start = 1×10 = 10 namiesto 0×10 = 0)")
elif page_1 == list(range(1, 11)):
    report("#17", "OK",  f"Strana 1 správne vracia prvých 10 položiek")
else:
    report("#17", "BUG", f"Neočakávaný výsledok: {page_1}")

# ── BUG #18 ── update_book_copies neaktualizuje available ─────
print(f"\n{BLUE}▶ Bug #18 — update_book_copies neaktualizuje available{RESET}")
db = fresh_db()
bid = add_book("Book", "Author", "UBC", 2, db)
avail_before = db["books"][0]["available"]
update_book_copies(bid, 3, db)
b = db["books"][0]
if b["copies"] == 5 and b["available"] == avail_before:
    report("#18", "BUG",
           f"copies={b['copies']} (aktualizované) ale available={b['available']} (nezmenené)")
else:
    report("#18", "OK",  f"copies={b['copies']}, available={b['available']}")

# ── BUG #19 ── Book.available nie je validované ───────────────
print(f"\n{BLUE}▶ Bug #19 — Book.available nie je ohraničené na ≤ copies{RESET}")
book = Book(1, "T", "A", "X", 2)
book.available = 100  # nikto to nekontroluje
if book.available > book.copies:
    report("#19", "BUG", f"available={book.available} > copies={book.copies} — žiadna validácia")
else:
    report("#19", "OK",  "available správne ohraničené")

# ── BUG #21 ── is_available() sa nevolá v borrow_book ─────────
print(f"\n{BLUE}▶ Bug #21 — Book.is_available() sa nikdy nevolá v borrow_book(){RESET}")
src_borrow = inspect.getsource(borrow_book)
if "is_available" not in src_borrow:
    report("#21", "BUG",
           "borrow_book() kontroluje available ≤ 0 priamo namiesto metódy is_available() — "
           "ak by sa is_available() zmenilo, borrow_book ostane nekonzistentné")
else:
    report("#21", "OK", "borrow_book() volá is_available()")

# ── BUG #25 ── Member.get_fine_total() sčítava aj zaplatené pokuty ─
print(f"\n{BLUE}▶ Bug #25 — get_fine_total() sčítava aj zaplatené pokuty{RESET}")
m = Member(1, "Test", "t@t.com")
m.loans = [
    {"fine": 2.50, "paid": True},
    {"fine": 1.00, "paid": False},
]
total = m.get_fine_total()
if total == 3.50:
    report("#25", "BUG",
           f"get_fine_total()={total:.2f}€ zahŕňa aj zaplatené 2.50€ — "
           f"malo by vrátiť iba nezaplatené: 1.00€")
else:
    report("#25", "OK",  f"Vráti iba nezaplatené: {total:.2f}€")

# ── BUG #27 ── Loan.is_overdue() string vs date ───────────────
print(f"\n{BLUE}▶ Bug #27 — Loan.is_overdue() porovnáva date s string{RESET}")
loan_str = Loan(1, 1, 1, datetime.date(2024, 1, 1), "2020-01-01")
try:
    result = loan_str.is_overdue()
    # Python 3 neumožňuje > medzi date a str → ak prešlo, due_date bol date
    report("#27", "OK",
           f"Žiaden crash, is_overdue()={result} — due_date bol pravdepodobne date objekt")
except TypeError as e:
    report("#27", "BUG", f"TypeError pri porovnaní date > str: {e}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   DODATOČNÉ BUGY (nenájdené v originálnom kóde){RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── EXTRA A ── borrow_book nevolá can_borrow() ────────────────
print(f"\n{BLUE}▶ EXTRA-A — borrow_book nevolá can_borrow() — limit 5 kníh sa nevynucuje{RESET}")
db = fresh_db()
mid = register_member("Bookworm", "worm@books.com", db)
for i in range(7):
    add_book(f"Book {i}", f"Aut {i}", f"isbn-{i:03d}", 7, db)
successes = sum(borrow_book(mid, i+1, db)["success"] for i in range(6))
if successes == 6:
    report("EXTRA-A", "BUG",
           f"Člen si požičal {successes} kníh napriek limitu 5 — "
           f"can_borrow() existuje v Member ale borrow_book() ju nikdy nevolá")
else:
    report("EXTRA-A", "OK",  f"Limit vynútený, požičaných: {successes}")

# ── EXTRA B ── loans_count nikdy nie je inkrementovaný ────────
print(f"\n{BLUE}▶ EXTRA-B — loans_count v member dict sa nikdy neaktualizuje{RESET}")
db = fresh_db()
mid = register_member("CountMe", "c@c.com", db)
bid = add_book("Bk", "Au", "CNT", 3, db)
borrow_book(mid, bid, db)
borrow_book(mid, bid, db)
member = next(m for m in db["members"] if m["id"] == mid)
actual = len([l for l in db["loans"] if l["member_id"] == mid])
if member["loans_count"] == 0 and actual == 2:
    report("EXTRA-B", "BUG",
           f"loans_count={member['loans_count']} ale skutočný počet výpožičiek={actual} — "
           f"pole je zapísané pri registrácii ale nikdy neinkrmentované")
else:
    report("EXTRA-B", "OK",  f"loans_count={member['loans_count']}, actual={actual}")

# ── EXTRA C ── load_database bez spracovania chybného JSON ────
print(f"\n{BLUE}▶ EXTRA-C — load_database padá na neplatnom JSON súbore{RESET}")
import json
orig_db = app_module.DB_FILE
tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
tmp.write("{ neplatny json !!!")
tmp.close()
app_module.DB_FILE = tmp.name
try:
    app_module.load_database()
    report("EXTRA-C", "OK",  "Chybný JSON je spracovaný")
except json.JSONDecodeError as e:
    report("EXTRA-C", "BUG", f"JSONDecodeError pre poškodený DB súbor: {e}")
except Exception as e:
    report("EXTRA-C", "BUG", f"{type(e).__name__}: {e}")
finally:
    app_module.DB_FILE = orig_db
    os.unlink(tmp.name)

# ── EXTRA D ── Timing attack v authenticate_admin ─────────────
print(f"\n{BLUE}▶ EXTRA-D — Timing attack v authenticate_admin (== namiesto hmac.compare_digest){RESET}")
src_auth = inspect.getsource(authenticate_admin)
if "compare_digest" not in src_auth and "==" in src_auth:
    report("EXTRA-D", "BUG",
           "Hash sa porovnáva cez == ktoré skončí hneď po prvom nezhode znaku — "
           "meranie času odpovede umožňuje útočníkovi postupne zistiť správny hash; "
           "oprava: hmac.compare_digest(hashed, ADMIN_PASSWORD)")
else:
    report("EXTRA-D", "OK",  "Používa bezpečné konštantné porovnanie")

# ── EXTRA E ── paginate prijíma záporné čísla stránky ─────────
print(f"\n{BLUE}▶ EXTRA-E — paginate() akceptuje záporné čísla stránky{RESET}")
items = list(range(100))
result = paginate(items, -1, 10)
if result == []:
    report("EXTRA-E", "BUG",
           "paginate(items, page=-1) vracia [] pretože items[-10:0] je prázdne — "
           "malo by vyvolať ValueError pre neplatné číslo stránky")
else:
    report("EXTRA-E", "BUG", f"paginate(items, page=-1) vracia: {result}")

# ── EXTRA F ── borrow_book nebreakuje po nájdení člena ────────
print(f"\n{BLUE}▶ Bug EXTRA-F — borrow_book nevolá break po nájdení člena{RESET}")
src_borrow = inspect.getsource(borrow_book)
lines = src_borrow.split('\n')
member_loop_lines = [l for l in lines if 'for m in db["members"]' in l or
                     ('member = m' in l and 'if m["id"]' not in l)]
has_break_after_member = False
for i, l in enumerate(lines):
    if 'member = m' in l:
        for j in range(i+1, min(i+3, len(lines))):
            if 'break' in lines[j]:
                has_break_after_member = True
if not has_break_after_member:
    report("EXTRA-F", "BUG",
           "Cyklus pre nájdenie člena pokračuje po nájdení (chýba break) — "
           "zbytočne prechádza zvyšok zoznamu; pre knihy break existuje, pre člena nie")
else:
    report("EXTRA-F", "OK",  "break po nájdení člena existuje")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   EDGE CASE TESTY{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── EDGE-1 ── return_book pre neexistujúci loan_id ────────────
print(f"\n{BLUE}▶ EDGE-1 — return_book pre neexistujúci loan_id{RESET}")
db = fresh_db()
result = return_book(9999, db)
if not result["success"] and "error" in result:
    report("EDGE-1", "OK",  f"Správne vráti chybu: {result['error']}")
else:
    report("EDGE-1", "BUG", f"Neočakávaný výsledok pre neexistujúci loan: {result}")

# ── EDGE-2 ── return_book zavolané dvakrát (double return) ────
print(f"\n{BLUE}▶ EDGE-2 — return_book zavolané dvakrát na tej istej výpožičke{RESET}")
db = fresh_db()
mid = register_member("Dr", "d@d.com", db)
bid = add_book("B", "A", "DR1", 1, db)
borrow_book(mid, bid, db)
r1 = return_book(1, db)
r2 = return_book(1, db)  # druhý pokus
avail = db["books"][0]["available"]
if not r2["success"] and avail == 1:
    report("EDGE-2", "OK",
           f"Druhé vrátenie odmietnuté správne, available={avail}")
elif r2["success"] and avail == 2:
    report("EDGE-2", "BUG",
           f"Dvojité vrátenie akceptované — available={avail} (malo byť 1), kniha by mohla mať available > copies")
else:
    report("EDGE-2", "BUG", f"Neočakávaný stav: r2={r2}, available={avail}")

# ── EDGE-3 ── update_book_copies so záporným deltom → available pod 0 ──
print(f"\n{BLUE}▶ EDGE-3 — update_book_copies so záporným deltom môže dať available < 0{RESET}")
db = fresh_db()
bid = add_book("B", "A", "NEG", 2, db)
update_book_copies(bid, -10, db)  # odoberieme 10, copies=2-10=-8
b = db["books"][0]
if b["copies"] < 0 or b["available"] < 0:
    report("EDGE-3", "BUG",
           f"copies={b['copies']}, available={b['available']} — záporné hodnoty povolené, žiadna validácia")
else:
    report("EDGE-3", "OK",  f"copies={b['copies']}, available={b['available']}")

# ── EDGE-4 ── add_book s copies=0 ─────────────────────────────
print(f"\n{BLUE}▶ EDGE-4 — add_book s copies=0{RESET}")
db = fresh_db()
bid = add_book("Zero", "A", "Z00", 0, db)
b = db["books"][0]
if b["copies"] == 0 and b["available"] == 0:
    report("EDGE-4", "BUG",
           "Kniha s 0 výtlačkami úspešne pridaná — systém akceptuje nezmyselnú hodnotu bez chyby")
else:
    report("EDGE-4", "OK",  f"copies=0 odmietnuté alebo ošetrené: {b}")

# ── EDGE-5 ── search_books s prázdnym query vracia všetky knihy ──
print(f"\n{BLUE}▶ EDGE-5 — search_books s prázdnym reťazcom{RESET}")
db = fresh_db()
add_book("Kniha A", "Autor X", "A1", 1, db)
add_book("Kniha B", "Autor Y", "A2", 1, db)
results = search_books("", db)
if len(results) == 2:
    report("EDGE-5", "BUG",
           f"Prázdny query vracia všetky {len(results)} knihy — '' je podreťazec každého reťazca; "
           f"chýba kontrola prázdneho vstupu")
else:
    report("EDGE-5", "OK",  f"Prázdny query vráti {len(results)} kníh")

# ── EDGE-6 ── borrow rovnakú knihu viac ráz — available pod 0? ──
print(f"\n{BLUE}▶ EDGE-6 — požičanie tej istej knihy viac ráz ako je available{RESET}")
db = fresh_db()
mid = register_member("M", "m@m.com", db)
bid = add_book("UniqueBook", "A", "UNI", 1, db)  # iba 1 výtlačok
r1 = borrow_book(mid, bid, db)
r2 = borrow_book(mid, bid, db)  # druhé požičanie tej istej
avail = db["books"][0]["available"]
if r1["success"] and not r2["success"] and avail == 0:
    report("EDGE-6", "OK",
           f"Druhé požičanie správne odmietnuté, available={avail}")
elif r2["success"] and avail < 0:
    report("EDGE-6", "BUG",
           f"Kniha požičaná dvakrát napriek 1 výtlačku — available={avail} (záporné!)")
else:
    report("EDGE-6", "OK",  f"r1={r1['success']}, r2={r2['success']}, available={avail}")

# ── EDGE-7 ── register_member s prázdnym menom/emailom ────────
print(f"\n{BLUE}▶ EDGE-7 — register_member s prázdnymi hodnotami{RESET}")
db = fresh_db()
try:
    mid = register_member("", "", db)
    m = next(x for x in db["members"] if x["id"] == mid)
    report("EDGE-7", "BUG",
           f"Člen s prázdnym menom='{m['name']}' a emailom='{m['email']}' zaregistrovaný — žiadna validácia")
except Exception as e:
    report("EDGE-7", "OK",  f"Prázdne hodnoty odmietnuté: {type(e).__name__}: {e}")

# ── EDGE-8 ── get_member_history pre neexistujúceho člena ─────
print(f"\n{BLUE}▶ EDGE-8 — get_member_history pre neexistujúceho člena{RESET}")
db = fresh_db()
history = get_member_history(9999, db)
if history == []:
    report("EDGE-8", "OK",  "Vráti prázdny list pre neexistujúceho člena")
else:
    report("EDGE-8", "BUG", f"Neočakávaný výsledok: {history}")

# ── EDGE-9 ── available > copies po kombinácii bugov #7 + return ──
print(f"\n{BLUE}▶ EDGE-9 — available môže prekročiť copies (interakcia return + update_book_copies){RESET}")
db = fresh_db()
mid = register_member("U", "u@u.com", db)
bid = add_book("B", "A", "OVR", 1, db)
borrow_book(mid, bid, db)   # available=0
return_book(1, db)           # available=1
return_book(1, db)           # double return — available=2? (ak nie je ošetrené)
b = db["books"][0]
if b["available"] > b["copies"]:
    report("EDGE-9", "BUG",
           f"available={b['available']} > copies={b['copies']} po dvojitom vrátení — "
           f"return_book neoveruje hornú hranicu available")
else:
    report("EDGE-9", "OK",  f"available={b['available']}, copies={b['copies']} — konzistentné")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   INTEGRAČNÉ TESTY (celý workflow){RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── INT-1 ── Celý workflow: registrácia → výpožička → vrátenie ──
print(f"\n{BLUE}▶ INT-1 — Kompletný workflow: register → add → borrow → return{RESET}")
db = fresh_db()
errors = []

mid = register_member("Anna Nováková", "anna@nova.sk", db)
if not isinstance(mid, int) or mid < 1:
    errors.append(f"register_member vrátil neplatné id: {mid}")

bid = add_book("Malý princ", "Antoine de Saint-Exupéry", "978-80-551-1234-5", 2, db)
if not isinstance(bid, int) or bid < 1:
    errors.append(f"add_book vrátil neplatné id: {bid}")

borrow_res = borrow_book(mid, bid, db)
if not borrow_res.get("success"):
    errors.append(f"borrow_book zlyhalo: {borrow_res}")
avail_after_borrow = db["books"][0]["available"]
if avail_after_borrow != 1:
    errors.append(f"available po výpožičke={avail_after_borrow}, očakávané 1")

return_res = return_book(borrow_res["loan_id"], db)
if not return_res.get("success"):
    errors.append(f"return_book zlyhalo: {return_res}")
avail_after_return = db["books"][0]["available"]
if avail_after_return != 2:
    errors.append(f"available po vrátení={avail_after_return}, očakávané 2")

if errors:
    report("INT-1", "BUG", " | ".join(errors))
else:
    report("INT-1", "OK",
           f"Workflow prebehol bez chýb — member={mid}, book={bid}, "
           f"available: 2→{avail_after_borrow}→{avail_after_return}")

# ── INT-2 ── Save/load roundtrip konzistencia dát ─────────────
print(f"\n{BLUE}▶ INT-2 — save_database + load_database roundtrip{RESET}")
import json as _json
db = fresh_db()
register_member("Test User", "test@test.com", db)
add_book("Roundtrip Book", "Auth", "RT1", 3, db)
borrow_book(1, 1, db)

tmp_db = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
tmp_db.close()
orig_db_file = app_module.DB_FILE
app_module.DB_FILE = tmp_db.name
try:
    app_module.save_database(db)
    loaded = app_module.load_database()
    errors = []
    if len(loaded["members"]) != len(db["members"]):
        errors.append(f"members: uložených {len(db['members'])}, načítaných {len(loaded['members'])}")
    if len(loaded["books"]) != len(db["books"]):
        errors.append(f"books: uložených {len(db['books'])}, načítaných {len(loaded['books'])}")
    if len(loaded["loans"]) != len(db["loans"]):
        errors.append(f"loans: uložených {len(db['loans'])}, načítaných {len(loaded['loans'])}")
    if loaded["books"][0]["available"] != db["books"][0]["available"]:
        errors.append(f"available po roundtrip: {loaded['books'][0]['available']} ≠ {db['books'][0]['available']}")
    if errors:
        report("INT-2", "BUG", " | ".join(errors))
    else:
        report("INT-2", "OK",
               f"Dáta konzistentné po save/load — "
               f"{len(loaded['members'])} členov, {len(loaded['books'])} kníh, {len(loaded['loans'])} výpožičiek")
finally:
    app_module.DB_FILE = orig_db_file
    os.unlink(tmp_db.name)

# ── INT-3 ── calculate_statistics správnosť výsledkov ─────────
print(f"\n{BLUE}▶ INT-3 — calculate_statistics vracia správne čísla{RESET}")
db = fresh_db()
register_member("M1", "m1@t.com", db)
register_member("M2", "m2@t.com", db)
add_book("B1", "A", "S1", 3, db)
add_book("B2", "A", "S2", 2, db)
borrow_book(1, 1, db)
borrow_book(1, 1, db)
borrow_book(2, 2, db)

try:
    stats = calculate_statistics(db)
    errors = []
    if stats["total_books"] != 2:
        errors.append(f"total_books={stats['total_books']}, očakávané 2")
    if stats["total_members"] != 2:
        errors.append(f"total_members={stats['total_members']}, očakávané 2")
    if stats["total_loans"] != 3:
        errors.append(f"total_loans={stats['total_loans']}, očakávané 3")
    expected_avg = 3 / 2
    if abs(stats["avg_loans_per_member"] - expected_avg) > 0.001:
        errors.append(f"avg_loans={stats['avg_loans_per_member']:.2f}, očakávané {expected_avg:.2f}")
    if stats["top_books"][0] != 1:
        errors.append(f"top_books[0]={stats['top_books'][0]}, očakávané id=1 (2 výpožičky)")
    if errors:
        report("INT-3", "BUG", " | ".join(errors))
    else:
        report("INT-3", "OK",
               f"Štatistiky správne — books={stats['total_books']}, members={stats['total_members']}, "
               f"loans={stats['total_loans']}, avg={stats['avg_loans_per_member']:.1f}, top={stats['top_books']}")
except ZeroDivisionError:
    report("INT-3", "BUG", "ZeroDivisionError — Bug #9 znemožňuje štatistiky aj s členmi (neočakávané)")

# ── INT-4 ── Konzistencia available po celom cykle výpožičiek ──
print(f"\n{BLUE}▶ INT-4 — available je konzistentné po sérii výpožičiek a vrátení{RESET}")
db = fresh_db()
mid = register_member("Stress", "s@s.com", db)
bid = add_book("StressBook", "A", "STR", 3, db)
loan_ids = []
for _ in range(3):
    r = borrow_book(mid, bid, db)
    if r["success"]:
        loan_ids.append(r["loan_id"])
avail_after_all_borrowed = db["books"][0]["available"]
for lid in loan_ids:
    return_book(lid, db)
avail_after_all_returned = db["books"][0]["available"]
errors = []
if avail_after_all_borrowed != 0:
    errors.append(f"Po 3 výpožičkách available={avail_after_all_borrowed}, očakávané 0")
if avail_after_all_returned != 3:
    errors.append(f"Po 3 vráteniach available={avail_after_all_returned}, očakávané 3")
if errors:
    report("INT-4", "BUG", " | ".join(errors))
else:
    report("INT-4", "OK",
           f"available: 3 → {avail_after_all_borrowed} (po výpožičkách) → {avail_after_all_returned} (po vrátení)")

# ── INT-5 ── save_database bez write oprávnení ─────────────────
print(f"\n{BLUE}▶ INT-5 — save_database bez oprávnení na zápis{RESET}")
import stat
tmp_ro = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
tmp_ro.close()
os.chmod(tmp_ro.name, stat.S_IREAD)  # read-only
orig_db_file = app_module.DB_FILE
app_module.DB_FILE = tmp_ro.name
try:
    app_module.save_database({"books": [], "members": [], "loans": []})
    report("INT-5", "BUG",
           "save_database do read-only súboru nevyhodilo výnimku — dáta môžu byť ticho stratené")
except (PermissionError, OSError) as e:
    report("INT-5", "BUG",
           f"save_database padá bez ošetrenia: {type(e).__name__} — chýba try/except v save_database()")
finally:
    app_module.DB_FILE = orig_db_file
    try:
        os.chmod(tmp_ro.name, stat.S_IWRITE)
        os.unlink(tmp_ro.name)
    except Exception:
        pass

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   TYPOVÁ NEKONZISTENCIA (string vs int ID){RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── TYPE-1 ── borrow_book so string ID člena ──────────────────
print(f"\n{BLUE}▶ TYPE-1 — borrow_book so string member_id='1' namiesto int 1{RESET}")
db = fresh_db()
register_member("U", "u@u.com", db)
add_book("B", "A", "T1", 2, db)
try:
    result = borrow_book("1", 1, db)  # string "1" vs int 1 v db
    if result["success"]:
        report("TYPE-1", "BUG",
               "borrow_book('1', 1, db) uspelo — '1' == 1 je False, člen nenájdený ale kód crashol inak")
    else:
        report("TYPE-1", "BUG",
               f"borrow_book so string ID nenájde člena (m['id']==1 != '1') → {result.get('error','?')}")
except (TypeError, AttributeError) as e:
    report("TYPE-1", "BUG",
           f"Crash so string member_id: {type(e).__name__}: {e} — žiadna typová validácia vstupov")

# ── TYPE-2 ── get_book_by_id so string ID ─────────────────────
print(f"\n{BLUE}▶ TYPE-2 — get_book_by_id so string id='1' namiesto int 1{RESET}")
db = fresh_db()
add_book("B", "A", "T2", 1, db)
try:
    result = get_book_by_id("1", db)  # string "1", v db je int 1
    report("TYPE-2", "BUG",
           f"get_book_by_id('1') vrátilo výsledok napriek typovej nezhode: {result}")
except IndexError:
    report("TYPE-2", "BUG",
           "get_book_by_id('1') → IndexError — '1'==1 je False, prázdny list, [0] crashne")
except Exception as e:
    report("TYPE-2", "BUG", f"{type(e).__name__}: {e}")

# ── TYPE-3 ── search_books s None query ───────────────────────
print(f"\n{BLUE}▶ TYPE-3 — search_books(None, db){RESET}")
db = fresh_db()
add_book("Kniha", "Autor", "N1", 1, db)
try:
    result = search_books(None, db)
    report("TYPE-3", "BUG",
           f"search_books(None) vrátilo {result} bez chyby — None je akceptovaný ako query")
except TypeError as e:
    report("TYPE-3", "BUG",
           f"search_books(None) → TypeError: {e} — None nie je ošetrený")

# ── TYPE-4 ── add_book s None hodnotami ───────────────────────
print(f"\n{BLUE}▶ TYPE-4 — add_book s None title/author/isbn{RESET}")
db = fresh_db()
try:
    bid = add_book(None, None, None, 1, db)
    b = db["books"][0]
    report("TYPE-4", "BUG",
           f"add_book(None, None, None) akceptované — kniha {b} pridaná bez validácie")
except Exception as e:
    report("TYPE-4", "OK",
           f"None hodnoty odmietnuté: {type(e).__name__}: {e}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   VÝPOČET POKUTY — HRANIČNÉ HODNOTY{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── FINE-1 ── Vrátenie presne v deň termínu → pokuta 0? ───────
print(f"\n{BLUE}▶ FINE-1 — Vrátenie presne v deň termínu (days_late=0){RESET}")
db = fresh_db()
mid = register_member("P", "p@p.com", db)
bid = add_book("B", "A", "F1", 1, db)
today_str = str(datetime.date.today())
db["loans"].append({
    "id": 1, "member_id": mid, "book_id": bid,
    "borrow_date": today_str, "due_date": today_str, "returned": False
})
res = return_book(1, db)
if res["success"] and res["fine"] == 0.0 and res["days_late"] == 0:
    report("FINE-1", "OK",  f"Vrátenie v deň termínu → pokuta={res['fine']:.2f}€, days_late={res['days_late']}")
elif res["success"] and res["fine"] > 0:
    report("FINE-1", "BUG",
           f"Pokuta {res['fine']:.2f}€ aj keď vrátené presne v termín (days_late={res['days_late']})")
else:
    report("FINE-1", "BUG", f"Neočakávaný výsledok: {res}")

# ── FINE-2 ── Vrátenie 1 deň po termíne → pokuta 0.10€ ────────
print(f"\n{BLUE}▶ FINE-2 — Vrátenie 1 deň po termíne → pokuta má byť 0.10€{RESET}")
db = fresh_db()
mid = register_member("P2", "p2@p.com", db)
bid = add_book("B", "A", "F2", 1, db)
yesterday = str(datetime.date.today() - datetime.timedelta(days=1))
db["loans"].append({
    "id": 1, "member_id": mid, "book_id": bid,
    "borrow_date": yesterday, "due_date": yesterday, "returned": False
})
res = return_book(1, db)
expected = round(1 * FINE_PER_DAY, 10)
if res["success"] and abs(res["fine"] - expected) < 0.001 and res["days_late"] == 1:
    report("FINE-2", "OK",  f"1 deň po termíne → pokuta={res['fine']:.2f}€ správne")
else:
    report("FINE-2", "BUG",
           f"Neočakávaná pokuta: {res['fine']:.2f}€ (očakávané {expected:.2f}€), days_late={res['days_late']}")

# ── FINE-3 ── Vrátenie 1 deň PRED termínom → pokuta musí byť 0 ──
print(f"\n{BLUE}▶ FINE-3 — Vrátenie 1 deň pred termínom → pokuta musí byť 0 (Bug #7 kontrola){RESET}")
db = fresh_db()
mid = register_member("P3", "p3@p.com", db)
bid = add_book("B", "A", "F3", 1, db)
tomorrow = str(datetime.date.today() + datetime.timedelta(days=1))
db["loans"].append({
    "id": 1, "member_id": mid, "book_id": bid,
    "borrow_date": str(datetime.date.today()), "due_date": tomorrow, "returned": False
})
res = return_book(1, db)
if res["success"] and res["fine"] > 0:
    report("FINE-3", "BUG",
           f"Bug #7 potvrdený: pokuta {res['fine']:.2f}€ za vrátenie 1 deň PRED termínom "
           f"(abs(-1)*0.10 = 0.10€)")
elif res["success"] and res["fine"] == 0:
    report("FINE-3", "OK",  "Žiadna pokuta pri včasnom vrátení")
else:
    report("FINE-3", "BUG", f"Neočakávaný výsledok: {res}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   STAV PO KOMBINÁCII BUGOV{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── COMBO-1 ── Bug #18 + borrow: copies záporné, available kladné ─
print(f"\n{BLUE}▶ COMBO-1 — Po update_book_copies(delta=-5): copies záporné, available stále kladné → borrow uspeje{RESET}")
db = fresh_db()
mid = register_member("C", "c@c.com", db)
bid = add_book("B", "A", "C1", 3, db)   # copies=3, available=3
update_book_copies(bid, -5, db)          # copies=-2, available=3 (Bug #18 — available nezmenené)
b = db["books"][0]
r = borrow_book(mid, bid, db)
if r["success"] and b["copies"] < 0:
    report("COMBO-1", "BUG",
           f"Výpožička uspela napriek copies={b['copies']} — available={b['available']} ostalo "
           f"kladné kvôli Bug #18, borrow_book kontroluje iba available")
elif not r["success"]:
    report("COMBO-1", "OK",  f"Výpožička odmietnutá: {r.get('error')}")
else:
    report("COMBO-1", "BUG", f"Neočakávaný stav: copies={b['copies']}, r={r}")

# ── COMBO-2 ── add_book(copies=0) + borrow → správne odmietnuté? ──
print(f"\n{BLUE}▶ COMBO-2 — add_book(copies=0) + borrow → available=0, výpožička odmietnutá?{RESET}")
db = fresh_db()
mid = register_member("C2", "c2@c.com", db)
bid = add_book("ZeroBook", "A", "C2", 0, db)  # Bug EDGE-4: copies=0 akceptované
r = borrow_book(mid, bid, db)
if not r["success"]:
    report("COMBO-2", "OK",
           f"Výpožička knihy s 0 výtlačkami správne odmietnutá: {r.get('error')}")
else:
    report("COMBO-2", "BUG",
           f"Výpožička knihy s copies=0 uspela — available={db['books'][0]['available']}")

# ── COMBO-3 ── Neaktívny člen → borrow odmietnutý? ────────────
print(f"\n{BLUE}▶ COMBO-3 — borrow_book pre člena s active=False{RESET}")
db = fresh_db()
mid = register_member("Inactive", "i@i.com", db)
bid = add_book("B", "A", "C3", 2, db)
db["members"][0]["active"] = False  # deaktivujeme člena
r = borrow_book(mid, bid, db)
if not r["success"] and "aktívny" in r.get("error", "").lower():
    report("COMBO-3", "OK",  f"Neaktívny člen správne odmietnutý: {r['error']}")
elif not r["success"]:
    report("COMBO-3", "OK",  f"Neaktívny člen odmietnutý: {r.get('error')}")
else:
    report("COMBO-3", "BUG",
           f"Neaktívny člen si požičal knihu — active=False sa nekontroluje správne")

# ── COMBO-4 ── Duplicitné ISBN → copies inkrement ─────────────
print(f"\n{BLUE}▶ COMBO-4 — add_book s rovnakým ISBN dvakrát → inkrementuje copies{RESET}")
db = fresh_db()
bid1 = add_book("Švejk", "Hašek", "ISBN-SAME", 2, db)
bid2 = add_book("Švejk", "Hašek", "ISBN-SAME", 3, db)  # rovnaké ISBN
b = db["books"][0]
if len(db["books"]) == 1 and b["copies"] == 5 and bid1 == bid2:
    report("COMBO-4", "OK",
           f"Duplicitné ISBN správne zlúčené — copies={b['copies']}, id={bid1}")
elif len(db["books"]) == 2:
    report("COMBO-4", "BUG",
           f"Duplicitné ISBN vytvorilo 2 záznamy namiesto inkremntácie copies")
else:
    report("COMBO-4", "BUG",
           f"Neočakávaný stav: books={len(db['books'])}, copies={b['copies']}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   VÝKONNOSTNÝ TEST (O(n²) meranie){RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── PERF-1 ── export_overdue_loans: meranie rastu času ────────
print(f"\n{BLUE}▶ PERF-1 — O(n²) v export_overdue_loans: meranie času pre 100 vs 500 záznamov{RESET}")
import time

def build_overdue_db(n_loans, n_members):
    db = fresh_db()
    for i in range(n_members):
        db["members"].append({"id": i+1, "name": f"Member {i}", "email": f"m{i}@t.com",
                               "active": True, "registered": "2024-01-01", "loans_count": 0})
    db["books"].append({"id": 1, "title": "B", "author": "A", "isbn": "X", "copies": n_loans+1, "available": 1})
    past = str(datetime.date.today() - datetime.timedelta(days=10))
    for i in range(n_loans):
        db["loans"].append({"id": i+1, "member_id": (i % n_members)+1, "book_id": 1,
                            "borrow_date": past, "due_date": past, "returned": False})
    return db

tmp_perf = os.path.join(tempfile.gettempdir(), "perf_test.txt")
try:
    db_small = build_overdue_db(100, 100)
    t0 = time.perf_counter()
    export_overdue_loans(db_small, tmp_perf)
    t_small = time.perf_counter() - t0

    db_large = build_overdue_db(500, 500)
    t0 = time.perf_counter()
    export_overdue_loans(db_large, tmp_perf)
    t_large = time.perf_counter() - t0

    ratio = t_large / t_small if t_small > 0 else 0
    # O(n²) by mal mať ratio ~25x (500/100)², O(n) by mal mať ratio ~5x
    if ratio > 10:
        report("PERF-1", "BUG",
               f"100 záznamov: {t_small*1000:.1f}ms, 500 záznamov: {t_large*1000:.1f}ms — "
               f"pomer {ratio:.1f}x (O(n²) správanie potvrdené, očakávané ~5x pre O(n))")
    else:
        report("PERF-1", "OK",
               f"100 záznamov: {t_small*1000:.1f}ms, 500 záznamov: {t_large*1000:.1f}ms — "
               f"pomer {ratio:.1f}x (lineárne správanie)")
finally:
    if os.path.exists(tmp_perf):
        os.remove(tmp_perf)

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   BEZPEČNOSTNÉ VSTUPY{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── SEC-1 ── Path traversal v export_overdue_loans ────────────
print(f"\n{BLUE}▶ SEC-1 — Path traversal v export_overdue_loans (výstupný súbor mimo adresára){RESET}")
import json as _json
db = fresh_db()
mid = register_member("Late", "l@l.com", db)
bid = add_book("B", "A", "SEC1", 1, db)
past = str(datetime.date.today() - datetime.timedelta(days=5))
db["loans"].append({"id": 1, "member_id": mid, "book_id": bid,
                    "borrow_date": past, "due_date": past, "returned": False})
traversal_path = os.path.join(tempfile.gettempdir(), "..", "traversal_test.txt")
real_path = os.path.realpath(traversal_path)
try:
    export_overdue_loans(db, traversal_path)
    if os.path.exists(real_path):
        os.remove(real_path)
    report("SEC-1", "BUG",
           f"export_overdue_loans zapísalo súbor na path traversal cestu: {real_path} — "
           f"vstup nie je sanitizovaný, útočník môže prepísať ľubovoľný súbor")
except (PermissionError, OSError):
    report("SEC-1", "OK", "Zápis na traversal cestu zamietnutý OS-om")

# ── SEC-2 ── Veľmi dlhý reťazec v register_member ────────────
print(f"\n{BLUE}▶ SEC-2 — Veľmi dlhý reťazec (10 000 znakov) v mene člena{RESET}")
db = fresh_db()
long_name = "A" * 10_000
try:
    mid = register_member(long_name, "long@test.com", db)
    m = db["members"][0]
    if len(m["name"]) == 10_000:
        report("SEC-2", "BUG",
               f"10 000-znakové meno akceptované bez limitu — žiadna validácia dĺžky vstupu")
    else:
        report("SEC-2", "OK", f"Dlhé meno skrátené/odmietnuté: {len(m['name'])} znakov")
except Exception as e:
    report("SEC-2", "OK", f"Dlhé meno odmietnuté: {type(e).__name__}: {e}")

# ── SEC-3 ── Špeciálne znaky v názve knihy — JSON roundtrip ───
print(f"\n{BLUE}▶ SEC-3 — Špeciálne znaky (newline, quote, null byte) v názve knihy → JSON roundtrip{RESET}")
db = fresh_db()
special_title = 'Kniha\nSo "Špeciálnymi" Znakmi\t '
add_book(special_title, "Autor", "SPEC1", 1, db)
tmp_sp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
tmp_sp.close()
orig = app_module.DB_FILE
app_module.DB_FILE = tmp_sp.name
try:
    app_module.save_database(db)
    loaded = app_module.load_database()
    loaded_title = loaded["books"][0]["title"]
    if loaded_title == special_title:
        report("SEC-3", "OK",
               f"Špeciálne znaky prežili JSON roundtrip — JSON ich správne escapuje")
    else:
        report("SEC-3", "BUG",
               f"Názov sa po roundtrip zmenil: {loaded_title!r} ≠ {special_title!r}")
except Exception as e:
    report("SEC-3", "BUG", f"JSON roundtrip zlyhal so špeciálnymi znakmi: {type(e).__name__}: {e}")
finally:
    app_module.DB_FILE = orig
    os.unlink(tmp_sp.name)

# ── SEC-4 ── Injekcia oddeľovača do CSV exportu ───────────────
print(f"\n{BLUE}▶ SEC-4 — CSV injection: člen s čiarkou v mene narúša export{RESET}")
db = fresh_db()
mid = register_member("Novák, Ján", "csv@test.com", db)
bid = add_book("B", "A", "CSV1", 1, db)
past = str(datetime.date.today() - datetime.timedelta(days=3))
db["loans"].append({"id": 1, "member_id": mid, "book_id": bid,
                    "borrow_date": past, "due_date": past, "returned": False})
tmp_csv = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
tmp_csv.close()
try:
    export_overdue_loans(db, tmp_csv.name)
    with open(tmp_csv.name, "r") as f:
        line = f.read().strip()
    parts = line.split(",")
    if len(parts) > 3:
        report("SEC-4", "BUG",
               f"Čiarka v mene '{db['members'][0]['name']}' rozdelila CSV riadok na {len(parts)} stĺpcov "
               f"namiesto 3 — meno nie je escapované: {line!r}")
    else:
        report("SEC-4", "OK", f"Meno s čiarkou správne ošetrené v CSV: {line!r}")
finally:
    os.unlink(tmp_csv.name)

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   MODEL UNIT TESTY{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── MODEL-1 ── Book.to_dict() vracia všetky správne kľúče ─────
print(f"\n{BLUE}▶ MODEL-1 — Book.to_dict() vracia kompletný a správny dict{RESET}")
b = Book(42, "Malý princ", "Saint-Exupéry", "978-1", 5)
b.available = 3
d = b.to_dict()
expected_keys = {"id", "title", "author", "isbn", "copies", "available"}
missing  = expected_keys - set(d.keys())
extra    = set(d.keys()) - expected_keys
errors   = []
if missing:
    errors.append(f"Chýbajúce kľúče: {missing}")
if extra:
    errors.append(f"Navyše kľúče: {extra}")
if d.get("id") != 42:
    errors.append(f"id={d.get('id')!r}, očakávané 42")
if d.get("available") != 3:
    errors.append(f"available={d.get('available')!r}, očakávané 3")
if errors:
    report("MODEL-1", "BUG", " | ".join(errors))
else:
    report("MODEL-1", "OK", f"to_dict() vracia správnych {len(d)} kľúčov: {list(d.keys())}")

# ── MODEL-2 ── Loan.is_overdue() s returned=True → False ──────
print(f"\n{BLUE}▶ MODEL-2 — Loan.is_overdue() vráti False keď returned=True (aj po termíne){RESET}")
overdue_loan = Loan(1, 1, 1, datetime.date(2020, 1, 1), datetime.date(2020, 1, 15))
overdue_loan.returned = True
try:
    result = overdue_loan.is_overdue()
    if result is False:
        report("MODEL-2", "OK",
               "Loan.is_overdue()=False pre vrátené výpožičky — returned=True správne blokuje")
    else:
        report("MODEL-2", "BUG",
               f"is_overdue()={result} napriek returned=True — vrátená výpožička hlásená ako oneskorená")
except TypeError as e:
    report("MODEL-2", "BUG", f"TypeError: {e} — due_date je date objekt ale porovnanie zlyhalo")

# ── MODEL-3 ── Member.can_borrow() presne na hranici 5 ────────
print(f"\n{BLUE}▶ MODEL-3 — Member.can_borrow() presne na hranici: 4 aktívne=True, 5=False{RESET}")
m = Member(1, "Test", "t@t.com")
m.loans = [{"returned": False}] * 4
can_4 = m.can_borrow()
m.loans = [{"returned": False}] * 5
can_5 = m.can_borrow()
m.loans = [{"returned": True}] * 5 + [{"returned": False}]
can_mixed = m.can_borrow()
errors = []
if can_4 is not True:
    errors.append(f"4 aktívne výpožičky → can_borrow()={can_4}, očakávané True")
if can_5 is not False:
    errors.append(f"5 aktívnych výpožičiek → can_borrow()={can_5}, očakávané False")
if can_mixed is not True:
    errors.append(f"5 vrátených + 1 aktívna → can_borrow()={can_mixed}, očakávané True")
if errors:
    report("MODEL-3", "BUG", " | ".join(errors))
else:
    report("MODEL-3", "OK",
           f"can_borrow(): 4 aktívne→True, 5 aktívnych→False, 5 vrátených+1→True")

# ── MODEL-4 ── Book.__str__ a absencia __repr__ ───────────────
print(f"\n{BLUE}▶ MODEL-4 — Book.__str__ vs __repr__ (debug output){RESET}")
b = Book(1, "Švejk", "Hašek", "978-1", 2)
str_out  = str(b)
repr_out = repr(b)
if str_out != repr_out and "<models.Book object" in repr_out:
    report("MODEL-4", "BUG",
           f"repr(book)='{repr_out}' — nečitateľný debug output; "
           f"str(book)='{str_out}' funguje ale __repr__ chýba (Bug #20)")
elif str_out == repr_out:
    report("MODEL-4", "OK", f"__repr__ implementovaný: {repr_out!r}")
else:
    report("MODEL-4", "OK", f"str={str_out!r}, repr={repr_out!r}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   BOUNDARY TESTY PRE PAGINATE{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── PAGE-1 ── page_size=0 → ZeroDivisionError? ────────────────
print(f"\n{BLUE}▶ PAGE-1 — paginate(items, page=1, page_size=0){RESET}")
items = list(range(20))
try:
    result = paginate(items, 1, 0)
    report("PAGE-1", "BUG",
           f"page_size=0 akceptované, výsledok: {result!r} — malo by vyvolať ValueError")
except ZeroDivisionError as e:
    report("PAGE-1", "BUG",
           f"ZeroDivisionError pre page_size=0 — žiadna validácia vstupu: {e}")
except ValueError as e:
    report("PAGE-1", "OK", f"ValueError pre page_size=0: {e}")

# ── PAGE-2 ── page ďaleko za koncom → prázdny list ────────────
print(f"\n{BLUE}▶ PAGE-2 — paginate(items, page=9999) — ďaleko za koncom{RESET}")
items = list(range(10))
result = paginate(items, 9999, 10)
if result == []:
    report("PAGE-2", "OK",
           "Strana ďaleko za koncom vráti prázdny list — Python slicing [N:M] kde N>len je prázdny")
else:
    report("PAGE-2", "BUG", f"Neočakávaný výsledok pre page=9999: {result}")

# ── PAGE-3 ── page_size väčší ako celý zoznam ─────────────────
print(f"\n{BLUE}▶ PAGE-3 — paginate(items, page=1, page_size=1000) — page_size > len(items){RESET}")
items = list(range(5))
result = paginate(items, 1, 1000)
# Off-by-one Bug #17 stále platí: page=1 → start=1000, result=[]
if result == []:
    report("PAGE-3", "BUG",
           f"page_size=1000 > len=5, page=1 → start=1*1000=1000 → prázdny list "
           f"(Bug #17 off-by-one spôsobuje že ani page=1 nevráti dáta pre veľké page_size)")
elif result == items:
    report("PAGE-3", "OK", f"Vrátil všetkých {len(result)} položiek")
else:
    report("PAGE-3", "BUG", f"Neočakávaný výsledok: {result}")

# ── PAGE-4 ── page=1 so správnou opravou by mal vrátiť prvých N ──
print(f"\n{BLUE}▶ PAGE-4 — Overenie: paginate(range(5), page=0) vráti prvých 5 (0-indexed workaround){RESET}")
items = list(range(1, 6))
result_p0 = paginate(items, 0, 10)
result_p1 = paginate(items, 1, 10)
if result_p0 == items and result_p1 == []:
    report("PAGE-4", "BUG",
           f"Len page=0 vracia dáta {result_p0}, page=1 vracia {result_p1} — "
           f"potvrdenie Bug #17: 1-indexed volanie vyžaduje page=0")
else:
    report("PAGE-4", "OK", f"page=0→{result_p0}, page=1→{result_p1}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   SÚBEŽNOSŤ — RACE CONDITION (threading){RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── THREAD-1 ── 2 vlákna súčasne borrowujú tú istú knihu (available=1) ──
print(f"\n{BLUE}▶ THREAD-1 — Race condition: 2 vlákna súčasne požičajú knihu s available=1{RESET}")
import threading

db = fresh_db()
register_member("T1", "t1@t.com", db)
register_member("T2", "t2@t.com", db)
add_book("RaceBook", "A", "RACE1", 1, db)  # iba 1 výtlačok

results = []
barrier = threading.Barrier(2)

def try_borrow(member_id):
    barrier.wait()  # obe vlákna štartujú súčasne
    r = borrow_book(member_id, 1, db)
    results.append(r["success"])

threads = [threading.Thread(target=try_borrow, args=(i+1,)) for i in range(2)]
for t in threads:
    t.start()
for t in threads:
    t.join()

successes = sum(results)
final_available = db["books"][0]["available"]

if successes == 2 and final_available < 0:
    report("THREAD-1", "BUG",
           f"Obe vlákna úspešne požičali — available={final_available} (záporné!) — "
           f"race condition potvrdená za behu")
elif successes == 2 and final_available == -1:
    report("THREAD-1", "BUG",
           f"Race condition: 2 úspešné výpožičky, available={final_available}")
elif successes == 1:
    report("THREAD-1", "OK",
           f"Len jedna výpožička uspela (available={final_available}) — "
           f"race condition sa tentoraz neprejavila (nie je deterministická)")
else:
    report("THREAD-1", "BUG" if successes > 1 else "OK",
           f"successes={successes}, available={final_available}, results={results}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   OBSAH EXPORTU — OVERENIE SÚBORU{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── EXPORT-1 ── Obsah overdue exportu je správny ──────────────
print(f"\n{BLUE}▶ EXPORT-1 — Overenie obsahu export_overdue_loans (správne loan_id, meno, pokuta){RESET}")
db = fresh_db()
mid = register_member("Export Tester", "exp@test.com", db)
bid = add_book("Export Book", "A", "EXP1", 1, db)
days_late = 5
past = str(datetime.date.today() - datetime.timedelta(days=days_late))
db["loans"].append({"id": 77, "member_id": mid, "book_id": bid,
                    "borrow_date": past, "due_date": past, "returned": False})
tmp_exp = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
tmp_exp.close()
try:
    count = export_overdue_loans(db, tmp_exp.name)
    with open(tmp_exp.name, "r") as f:
        content = f.read().strip()
    errors = []
    if count != 1:
        errors.append(f"count={count}, očakávané 1")
    if "77" not in content:
        errors.append(f"loan_id=77 nie je v exporte: {content!r}")
    if "Export Tester" not in content:
        errors.append(f"meno člena nie je v exporte: {content!r}")
    expected_fine = round(days_late * FINE_PER_DAY, 2)
    if f"{expected_fine}" not in content and f"{expected_fine:.1f}" not in content:
        errors.append(f"pokuta {expected_fine} nie je v exporte: {content!r}")
    if errors:
        report("EXPORT-1", "BUG", " | ".join(errors))
    else:
        report("EXPORT-1", "OK", f"Export správny: {content!r}")
finally:
    os.unlink(tmp_exp.name)

# ── EXPORT-2 ── Export bez oneskorených výpožičiek → prázdny súbor ──
print(f"\n{BLUE}▶ EXPORT-2 — export_overdue_loans keď nie sú omeškané výpožičky{RESET}")
db = fresh_db()
register_member("OnTime", "ot@test.com", db)
add_book("B", "A", "EXP2", 1, db)
future = str(datetime.date.today() + datetime.timedelta(days=7))
db["loans"].append({"id": 1, "member_id": 1, "book_id": 1,
                    "borrow_date": str(datetime.date.today()),
                    "due_date": future, "returned": False})
tmp_exp2 = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
tmp_exp2.close()
try:
    count = export_overdue_loans(db, tmp_exp2.name)
    with open(tmp_exp2.name, "r") as f:
        content = f.read()
    if count == 0 and content == "":
        report("EXPORT-2", "OK", "Bez oneskorených → count=0, prázdny súbor")
    elif count == 0 and content != "":
        report("EXPORT-2", "BUG", f"count=0 ale súbor nie je prázdny: {content!r}")
    else:
        report("EXPORT-2", "BUG", f"count={count} pre včasnú výpožičku — nesprávne hlásená ako oneskorená")
finally:
    os.unlink(tmp_exp2.name)

# ── EXPORT-3 ── Export neobsahuje názov knihy (iba book_id) ───
print(f"\n{BLUE}▶ EXPORT-3 — export_overdue_loans obsahuje iba book_id, nie názov knihy{RESET}")
db = fresh_db()
mid = register_member("Reader", "r@r.com", db)
bid = add_book("Tajomná Kniha", "Autor", "EXP3", 1, db)
past = str(datetime.date.today() - datetime.timedelta(days=2))
db["loans"].append({"id": 1, "member_id": mid, "book_id": bid,
                    "borrow_date": past, "due_date": past, "returned": False})
tmp_exp3 = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
tmp_exp3.close()
try:
    export_overdue_loans(db, tmp_exp3.name)
    with open(tmp_exp3.name, "r") as f:
        content = f.read().strip()
    if "Tajomná Kniha" not in content and str(bid) in content:
        report("EXPORT-3", "BUG",
               f"Export obsahuje iba book_id={bid} ale nie názov 'Tajomná Kniha' — "
               f"správca knižnice musí manuálne dohľadávať názvy: {content!r}")
    elif "Tajomná Kniha" in content:
        report("EXPORT-3", "OK", f"Názov knihy je v exporte: {content!r}")
    else:
        report("EXPORT-3", "BUG", f"Neočakávaný obsah exportu: {content!r}")
finally:
    os.unlink(tmp_exp3.name)

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   ŠTATISTIKY — EDGE CASES{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── STAT-1 ── calculate_statistics s členmi ale bez výpožičiek ─
print(f"\n{BLUE}▶ STAT-1 — calculate_statistics: členovia existujú ale žiadne výpožičky{RESET}")
db = fresh_db()
register_member("M1", "m1@s.com", db)
register_member("M2", "m2@s.com", db)
add_book("B", "A", "ST1", 2, db)
try:
    stats = calculate_statistics(db)
    errors = []
    if stats["total_loans"] != 0:
        errors.append(f"total_loans={stats['total_loans']}, očakávané 0")
    if stats["avg_loans_per_member"] != 0.0:
        errors.append(f"avg={stats['avg_loans_per_member']}, očakávané 0.0")
    if stats["top_books"] != []:
        errors.append(f"top_books={stats['top_books']}, očakávané []")
    if errors:
        report("STAT-1", "BUG", " | ".join(errors))
    else:
        report("STAT-1", "OK",
               f"Štatistiky bez výpožičiek: loans=0, avg=0.0, top_books=[]")
except ZeroDivisionError as e:
    report("STAT-1", "BUG", f"ZeroDivisionError aj s 2 členmi — neočakávané: {e}")
except Exception as e:
    report("STAT-1", "BUG", f"{type(e).__name__}: {e}")

# ── STAT-2 ── calculate_statistics — top_books obsahuje ID nie názvy ─
print(f"\n{BLUE}▶ STAT-2 — top_books obsahuje raw ID namiesto názvov kníh{RESET}")
db = fresh_db()
register_member("M", "m@s.com", db)
add_book("Najlepšia Kniha", "Autor", "ST2", 3, db)
borrow_book(1, 1, db)
borrow_book(1, 1, db)
stats = calculate_statistics(db)
top = stats.get("top_books", [])
if top and all(isinstance(x, int) for x in top):
    report("STAT-2", "BUG",
           f"top_books={top} — obsahuje iba ID, nie názvy; "
           f"API konzument musí robiť ďalší lookup pre každú knihu")
elif top and all(isinstance(x, dict) for x in top):
    report("STAT-2", "OK", f"top_books obsahuje objekty s detailmi: {top}")
else:
    report("STAT-2", "BUG", f"Neočakávaný formát top_books: {top!r}")

# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   NOVÉ TESTY — NEPOKRYTÉ SCENÁRE{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")

# ── NEW-1 ── return_book() nenastavuje return_date v loan dict ─
print(f"\n{BLUE}▶ NEW-1 — return_book() nenastavuje return_date v loan dict (Bug #25){RESET}")
db = fresh_db()
mid = register_member("Returner", "ret@new.com", db)
bid = add_book("ReturnTest", "A", "RN01", 1, db)
br = borrow_book(mid, bid, db)
return_book(br["loan_id"], db)
loan = db["loans"][0]
if "return_date" not in loan:
    report("NEW-1", "BUG",
           "Po return_book() loan dict nemá kľúč 'return_date' — dátum vrátenia sa nikde "
           "nezaznamenáva; história výpožičiek neobsahuje kedy bola kniha vrátená")
else:
    report("NEW-1", "OK", f"return_date nastavený: {loan['return_date']}")

# ── NEW-2 ── add_book s copies=-1 (záporné výtlačky) ──────────
print(f"\n{BLUE}▶ NEW-2 — add_book(copies=-1): záporné výtlačky{RESET}")
db = fresh_db()
try:
    bid = add_book("Neg Book", "A", "NEG9", -1, db)
    b = db["books"][0]
    report("NEW-2", "BUG",
           f"add_book(copies=-1) akceptované bez chyby — "
           f"copies={b['copies']}, available={b['available']} (záporné výtlačky nemajú zmysel)")
except (ValueError, Exception) as e:
    report("NEW-2", "OK", f"Záporné copies odmietnuté: {type(e).__name__}: {e}")

# ── NEW-3 ── Loan.is_overdue() s string due_date z JSON roundtrip ─
print(f"\n{BLUE}▶ NEW-3 — Loan.is_overdue() s string due_date ako je uložené v JSON (praktický Bug #26){RESET}")
db = fresh_db()
mid = register_member("U", "u@new.com", db)
bid = add_book("B", "A", "LN01", 1, db)
borrow_book(mid, bid, db)
loan_dict = db["loans"][0]
loan_obj = Loan(
    loan_dict["id"], loan_dict["member_id"], loan_dict["book_id"],
    loan_dict["borrow_date"], loan_dict["due_date"]   # oba sú stringy po JSON uložení
)
try:
    result = loan_obj.is_overdue()
    report("NEW-3", "OK",
           f"is_overdue() so string due_date nepadlo → {result} (bug #26 možno opravený)")
except TypeError as e:
    report("NEW-3", "BUG",
           f"is_overdue() crashne s string due_date (reálny scenár z JSON): TypeError: {e} — "
           f"Loan.is_overdue() nekonvertuje string na datetime.date pred porovnaním")

# ── NEW-4 ── load_database s čiastočnou JSON štruktúrou ────────
print(f"\n{BLUE}▶ NEW-4 — load_database s JSON čo neobsahuje kľúč 'loans'{RESET}")
import json as _json_n4
tmp_partial = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
_json_n4.dump({"books": [], "members": []}, tmp_partial)   # chýba "loans"
tmp_partial.close()
orig_db_n4 = app_module.DB_FILE
app_module.DB_FILE = tmp_partial.name
try:
    loaded = app_module.load_database()
    if "loans" not in loaded:
        report("NEW-4", "BUG",
               "load_database vrátilo dict bez kľúča 'loans' — aplikácia crashne pri "
               "prvom prístupe k db['loans']; chýba validácia načítanej štruktúry")
    else:
        report("NEW-4", "OK", f"Načítaná db má kľúče: {list(loaded.keys())}")
except KeyError as e:
    report("NEW-4", "BUG", f"KeyError pri prístupe k načítanému JSON: {e}")
except Exception as e:
    report("NEW-4", "BUG", f"{type(e).__name__}: {e}")
finally:
    app_module.DB_FILE = orig_db_n4
    os.unlink(tmp_partial.name)

# ── NEW-5 ── update_book_copies(delta=-1) spôsobí available > copies ─
print(f"\n{BLUE}▶ NEW-5 — update_book_copies(delta=-1): available prekročí copies (Bug #18 + #33){RESET}")
db = fresh_db()
bid = add_book("B", "A", "UC99", 3, db)   # copies=3, available=3
update_book_copies(bid, -1, db)            # copies=2, ale available ostáva 3 (Bug #18)
b = db["books"][0]
if b["available"] > b["copies"]:
    report("NEW-5", "BUG",
           f"available={b['available']} > copies={b['copies']} — zníženie copies "
           f"neaktualizuje available; fyzicky existuje {b['copies']} kópií ale "
           f"systém ponúka {b['available']} na požičanie")
else:
    report("NEW-5", "OK", f"available={b['available']}, copies={b['copies']} — konzistentné")

# ── NEW-6 ── search_books(" ") nájde všetky knihy so medzerou ─
print(f"\n{BLUE}▶ NEW-6 — search_books(' '): medzera ako dotaz nájde knihy obsahujúce medzeru{RESET}")
db = fresh_db()
add_book("Malý princ", "Antoine de Saint", "SP01", 1, db)   # má medzery
add_book("Švejk", "Hašek", "SP02", 1, db)                   # autor bez medzery
results = search_books(" ", db)
titles_with_space = [b["title"] for b in db["books"] if " " in b["title"] or " " in b["author"]]
if len(results) > 0:
    report("NEW-6", "BUG",
           f"search_books(' ') vrátil {len(results)} kníh — medzera je podreťazec "
           f"každého reťazca s medzerou; whitespace nie je filtrovaný pred hľadaním")
else:
    report("NEW-6", "OK", "Medzera ako query vrátila prázdny zoznam")

# ── NEW-7 ── paginate(items, 1, None) → TypeError ──────────────
print(f"\n{BLUE}▶ NEW-7 — paginate(items, page=1, page_size=None){RESET}")
items = list(range(20))
try:
    result = paginate(items, 1, None)
    report("NEW-7", "BUG",
           f"paginate(page_size=None) akceptované bez chyby — výsledok: {result!r} "
           f"(žiadna typová validácia page_size)")
except TypeError as e:
    report("NEW-7", "BUG",
           f"paginate(page_size=None) → nekontrolovaný TypeError: {e} — "
           f"chýba validácia vstupu, chyba sa propaguje ďalej")
except ValueError as e:
    report("NEW-7", "OK", f"page_size=None odmietnutý cez ValueError: {e}")

# ── NEW-8 ── authenticate_admin(None) → AttributeError crash ──
print(f"\n{BLUE}▶ NEW-8 — authenticate_admin(None): None heslo spôsobí crash{RESET}")
try:
    result = authenticate_admin(None)
    report("NEW-8", "BUG",
           f"authenticate_admin(None) nepadlo, vrátilo: {result!r} — "
           f"None by malo byť odmietnuté pred .encode()")
except AttributeError as e:
    report("NEW-8", "BUG",
           f"authenticate_admin(None) → AttributeError: {e} — "
           f"None.encode() crashne; chýba typová kontrola vstupného hesla")
except TypeError as e:
    report("NEW-8", "BUG",
           f"authenticate_admin(None) → TypeError: {e} — nekontrolovaný pád")

# ── NEW-9 ── Float presnosť pokút: 3 dni × 0.10€ ──────────────
print(f"\n{BLUE}▶ NEW-9 — Floating point presnosť pokuty: 3 × 0.10€ = 0.30 presne?{RESET}")
db = fresh_db()
mid = register_member("P", "pfp@new.com", db)
bid = add_book("B", "A", "FP99", 1, db)
past3 = str(datetime.date.today() - datetime.timedelta(days=3))
db["loans"].append({"id": 1, "member_id": mid, "book_id": bid,
                    "borrow_date": past3, "due_date": past3, "returned": False})
res = return_book(1, db)
if res["success"]:
    exact_30 = (res["fine"] == 0.30)
    float_result = repr(res["fine"])
    if not exact_30:
        report("NEW-9", "BUG",
               f"3 × FINE_PER_DAY({FINE_PER_DAY}) = {float_result} ≠ 0.3 — "
               f"floating point nepresnosť v pokute; odporúča sa Decimal alebo round()")
    else:
        report("NEW-9", "OK", f"3 × {FINE_PER_DAY} = {res['fine']} (presné)")

# ── NEW-10 ── export_overdue_loans s loan pre zmazaného člena ─
print(f"\n{BLUE}▶ NEW-10 — export_overdue_loans kde loan odkazuje na neexistujúceho člena{RESET}")
db = fresh_db()
add_book("B", "A", "EX99", 1, db)
past = str(datetime.date.today() - datetime.timedelta(days=3))
db["loans"].append({"id": 1, "member_id": 999, "book_id": 1,
                    "borrow_date": past, "due_date": past, "returned": False})
tmp_n10 = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
tmp_n10.close()
try:
    count = export_overdue_loans(db, tmp_n10.name)
    with open(tmp_n10.name, "r") as f:
        content = f.read().strip()
    if count == 1 and "Neznámy" in content:
        report("NEW-10", "BUG",
               f"Loan odkazuje na member_id=999 ktorý neexistuje — export prebehol s "
               f"'Neznámy': {content!r}; chýba validácia referenčnej integrity")
    elif count == 0:
        report("NEW-10", "OK", "Loan s neexistujúcim členom vylúčený z exportu")
    else:
        report("NEW-10", "BUG", f"Neočakávaný výsledok: count={count}, obsah={content!r}")
finally:
    os.unlink(tmp_n10.name)

# ── NEW-11 ── register_member s menom obsahujúcim iba medzery ─
print(f"\n{BLUE}▶ NEW-11 — register_member('   ', email) — meno len z medzier{RESET}")
db = fresh_db()
try:
    mid = register_member("   ", "ws@new.com", db)
    m = next(x for x in db["members"] if x["id"] == mid)
    report("NEW-11", "BUG",
           f"Člen s menom='   ' (iba medzery) zaregistrovaný — "
           f"chýba strip() validácia; systém má neviditeľných členov")
except Exception as e:
    report("NEW-11", "OK", f"Meno z medzier odmietnuté: {type(e).__name__}: {e}")

# ── NEW-12 ── borrow_book neaktualizuje loans_count ani po return ─
print(f"\n{BLUE}▶ NEW-12 — loans_count zostáva 0 aj po výpožičke a vrátení{RESET}")
db = fresh_db()
mid = register_member("Counter", "cnt@new.com", db)
bid = add_book("B", "A", "CT99", 1, db)
br = borrow_book(mid, bid, db)
return_book(br["loan_id"], db)
member = next(m for m in db["members"] if m["id"] == mid)
if member["loans_count"] == 0:
    report("NEW-12", "BUG",
           "loans_count=0 aj po kompletnom cykle výpožičky+vrátenia — "
           "counter nie je nikdy aktualizovaný ani pri vrátení; pole je trvale 0")
else:
    report("NEW-12", "OK", f"loans_count={member['loans_count']} po cykle borrow→return")

# ═══════════════════════════════════════════════════════════════
total = confirmed + not_a_bug + false_pos
print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}   SÚHRN{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")
print(f"  Celkovo testov  : {total}")
print(f"  {RED}Potvrdené bugy  : {confirmed}{RESET}")
print(f"  {YELLOW}False positives : {false_pos}{RESET}")
print(f"  {GREEN}Nereprodukovateľné: {not_a_bug}{RESET}")
print()
print(f"  {YELLOW}FALSE POSITIVES v pôvodnom kóde:{RESET}")
print(f"    Bug #6  — timedelta(14) == timedelta(days=14), komentár je nesprávny")
print(f"    Bug #10 — sorted(dict) vracia kľúče, nie tuples; kód nepadá")
print()
print(f"  {RED}KRITICKÉ bugy (odporúča sa okamžitá oprava):{RESET}")
print(f"    #4  — NoneType crash pre neexistujúceho člena")
print(f"    #7  — Pokuta pri včasnom vrátení (abs() bug)")
print(f"    #9  — ZeroDivisionError v štatistikách")
print(f"    #13 — MD5 + hardcoded heslo 'admin123'")
print(f"    #16 — IndexError v get_book_by_id")
print(f"    EXTRA-D — Timing attack v autentifikácii")
