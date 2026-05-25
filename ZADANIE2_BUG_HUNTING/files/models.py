"""
Dátové modely pre KnihaPlus
"""

class Book:
    def __init__(self, id, title, author, isbn, copies):
        self.id = id
        self.title = title  
        self.author = author
        self.isbn = isbn
        self.copies = copies
        self.available = copies  # BUG #19: Nekontroluje sa či available <= copies

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "author": self.author,
            "isbn": self.isbn,
            "copies": self.copies,
            "available": self.available
        }
    
    def __str__(self):
        # BUG #20: Chýba __repr__, debugging je ťažší
        return f"{self.title} by {self.author}"
    
    def is_available(self):
        return self.available > 0  # BUG #21: Nikdy sa nevolá v borrow_book()


class Member:
    def __init__(self, id, name, email):
        self.id = id
        self.name = name
        self.email = email  # BUG #22: Žiadna validácia emailu
        self.active = True
        self.loans = []  # BUG #23: Mutable default v inštancii - OK tu, ale pri zdieľaní db nie

    def can_borrow(self):
        # BUG #24: Hardcoded limit 5, nie je konfigurovateľný
        active_loans = [l for l in self.loans if not l.get("returned", False)]
        return len(active_loans) < 5
    
    def get_fine_total(self):
        total = 0
        for loan in self.loans:
            if "fine" in loan:
                # BUG #25: Fines sa sčítavajú aj zaplatené
                total += loan["fine"]
        return total


class Loan:
    def __init__(self, id, member_id, book_id, borrow_date, due_date):
        self.id = id
        self.member_id = member_id
        self.book_id = book_id
        self.borrow_date = borrow_date
        self.due_date = due_date
        self.returned = False
        self.return_date = None  # BUG #26: Nikdy sa nenastavuje pri vrátení cez dict
    
    def is_overdue(self):
        import datetime
        # BUG #27: Porovnáva string s date objektom ak due_date je string
        today = datetime.date.today()
        return today > self.due_date and not self.returned
