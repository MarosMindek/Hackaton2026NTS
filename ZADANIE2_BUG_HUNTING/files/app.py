"""
KnihaPlus - Systém správy knižničného fondu
Verzia: 2.3.1
"""

import json
import datetime
import hashlib
import os

# Konfigurácia
DB_FILE = "library_db.json"
MAX_BORROW_DAYS = 14
FINE_PER_DAY = 0.10
ADMIN_PASSWORD = hashlib.md5("admin123".encode()).hexdigest()


def load_database():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            return json.load(f)
    return {"books": [], "members": [], "loans": []}


def save_database(db):
    with open(DB_FILE, "w") as f:
        json.dump(db, f)


def add_book(title, author, isbn, copies=1, db=[]):
    """Pridá knihu do systému."""
    # BUG #1: mutable default argument - db=[] zdieľané medzi volaniami
    for book in db["books"]:
        if book["isbn"] == isbn:
            book["copies"] += copies
            return book["id"]
    
    new_id = len(db["books"]) + 1  # BUG #2: ID nie je unikátne ak sa knihy mažú
    book = {
        "id": new_id,
        "title": title,
        "author": author,
        "isbn": isbn,
        "copies": copies,
        "available": copies
    }
    db["books"].append(book)
    return new_id


def search_books(query, db):
    """Hľadá knihy podľa názvu alebo autora."""
    results = []
    for book in db["books"]:
        # BUG #3: case-sensitive porovnanie - nenájde "Hašek" ak hľadáme "hašek"
        if query in book["title"] or query in book["author"]:
            results.append(book)
    return results


def borrow_book(member_id, book_id, db):
    """Požičia knihu členovi."""
    member = None
    for m in db["members"]:
        if m["id"] == member_id:
            member = m
    
    # BUG #4: Chýba kontrola ak member je None - havaruje s AttributeError
    if member["active"] == False:
        return {"success": False, "error": "Člen nie je aktívny"}
    
    book = None
    for b in db["books"]:
        if b["id"] == book_id:
            book = b
            break
    
    if book is None:
        return {"success": False, "error": "Kniha nenájdená"}
    
    # BUG #5: Race condition - available sa kontroluje ale nezdieľa sa atomicky
    if book["available"] <= 0:
        return {"success": False, "error": "Žiadny dostupný výtlačok"}
    
    book["available"] -= 1
    
    today = datetime.date.today()
    # BUG #6: timedelta(MAX_BORROW_DAYS) namiesto timedelta(days=MAX_BORROW_DAYS)
    due_date = today + datetime.timedelta(MAX_BORROW_DAYS)
    
    loan = {
        "id": len(db["loans"]) + 1,
        "member_id": member_id,
        "book_id": book_id,
        "borrow_date": str(today),
        "due_date": str(due_date),
        "returned": False
    }
    db["loans"].append(loan)
    return {"success": True, "loan_id": loan["id"], "due_date": str(due_date)}


def return_book(loan_id, db):
    """Vráti knihu a vypočíta prípadnú pokutu."""
    for loan in db["loans"]:
        if loan["id"] == loan_id:
            if loan["returned"]:
                return {"success": False, "error": "Kniha už bola vrátená"}
            
            loan["returned"] = True
            return_date = datetime.date.today()
            due_date = datetime.date.fromisoformat(loan["due_date"])
            
            # BUG #7: Pokuta sa počíta aj keď je vrátená včas (záporné dni = stále > 0 po abs())
            days_late = (return_date - due_date).days
            fine = abs(days_late) * FINE_PER_DAY  # BUG: abs() - pokuta aj pri vrátení vopred
            
            # Aktualizuj dostupnosť knihy
            for book in db["books"]:
                if book["id"] == loan["book_id"]:
                    book["available"] += 1
                    break
            
            return {"success": True, "fine": fine, "days_late": days_late}
    
    return {"success": False, "error": "Výpožička nenájdená"}


def get_member_history(member_id, db):
    """Vráti históriu výpožičiek člena."""
    history = []
    for loan in db["loans"]:
        if loan["member_id"] == member_id:
            history.append(loan)
    # BUG #8: Nie je zoradené podľa dátumu
    return history


def calculate_statistics(db):
    """Vypočíta štatistiky knižnice."""
    total_books = len(db["books"])
    total_members = len(db["members"])
    
    # BUG #9: Delenie nulou ak nie sú žiadne požičania
    avg_loans = len(db["loans"]) / total_members
    
    most_borrowed = {}
    for loan in db["loans"]:
        bid = loan["book_id"]
        if bid in most_borrowed:
            most_borrowed[bid] = most_borrowed[bid] + 1
        else:
            most_borrowed[bid] = 1
    
    # BUG #10: sorted s lambda vracia list tuples, ale pristupuje sa k nemu ako k dict
    top_books = sorted(most_borrowed, key=lambda x: most_borrowed[x], reverse=True)[:5]
    
    return {
        "total_books": total_books,
        "total_members": total_members,
        "total_loans": len(db["loans"]),
        "avg_loans_per_member": avg_loans,
        "top_books": top_books
    }


def register_member(name, email, db):
    """Registruje nového člena."""
    # BUG #11: Chýba validácia formátu emailu
    # BUG #12: Duplicitné emaily sú povolené
    for m in db["members"]:
        if m["email"] == email:
            pass  # BUG: mal by vrátiť chybu, ale iba ignoruje
    
    member = {
        "id": len(db["members"]) + 1,
        "name": name,
        "email": email,
        "active": True,
        "registered": str(datetime.date.today()),
        "loans_count": 0
    }
    db["members"].append(member)
    return member["id"]


def authenticate_admin(password):
    """Overí admin heslo."""
    # BUG #13: MD5 je kryptograficky slabý hash, heslo je "admin123" v kóde
    hashed = hashlib.md5(password.encode()).hexdigest()
    return hashed == ADMIN_PASSWORD


def export_overdue_loans(db, output_file="overdue.txt"):
    """Exportuje zoznam oneskorených výpožičiek."""
    today = datetime.date.today()
    overdue = []
    
    for loan in db["loans"]:
        if not loan["returned"]:
            due = datetime.date.fromisoformat(loan["due_date"])
            if today > due:
                days = (today - due).days
                # BUG #14: Hľadá člena v O(n) pre každú výpožičku = O(n²) celkovo
                member_name = "Neznámy"
                for m in db["members"]:
                    if m["id"] == loan["member_id"]:
                        member_name = m["name"]
                overdue.append({
                    "loan_id": loan["id"],
                    "member": member_name,
                    "book_id": loan["book_id"],
                    "days_late": days,
                    "fine": days * FINE_PER_DAY
                })
    
    # BUG #15: Súbor sa otvára ale výnimky sa nechytajú, + chýba finally/close
    f = open(output_file, "w")
    for item in overdue:
        f.write(f"{item['loan_id']},{item['member']},{item['fine']}\n")
    f.close()
    
    return len(overdue)


def get_book_by_id(book_id, db):
    # BUG #16: Vracia prvú zhodu ale nekontroluje či existuje, None crash
    return [b for b in db["books"] if b["id"] == book_id][0]


def paginate(items, page, page_size=10):
    """Stránkovanie výsledkov."""
    # BUG #17: Off-by-one - stránka 1 vracia items[10:20] namiesto items[0:10]
    start = page * page_size
    end = start + page_size
    return items[start:end]


def update_book_copies(book_id, delta, db):
    """Aktualizuje počet výtlačkov."""
    for book in db["books"]:
        if book["id"] == book_id:
            book["copies"] += delta
            # BUG #18: available sa neaktualizuje keď sa menia copies
            return True
    return False


if __name__ == "__main__":
    db = load_database()
    
    # Testovací scenár
    print("=== KnihaPlus v2.3.1 ===")
    
    mid = register_member("Ján Novák", "jan.novak@example.com", db)
    print(f"Registrovaný člen: {mid}")
    
    bid = add_book("Osudy dobrého vojaka Švejka", "Jaroslav Hašek", "978-80-7049-123-4", 3, db)
    print(f"Pridaná kniha: {bid}")
    
    result = borrow_book(mid, bid, db)
    print(f"Výpožička: {result}")
    
    stats = calculate_statistics(db)
    print(f"Štatistiky: {stats}")
    
    save_database(db)
    print("Databáza uložená.")
