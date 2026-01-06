from flask import Flask, render_template, request, jsonify, redirect, url_for
import sqlite3
import os

app = Flask(__name__)

# =============== DATABASE SETUP ==================
DB_PATH = "database/finance.db"

def init_db():
    os.makedirs("database", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

init_db()

# =============== FRONTEND ROUTES =================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        # ✅ After login, redirect to dashboard
        return redirect(url_for("dashboard"))
    return render_template("login.html")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        # After signup, redirect to login
        return redirect(url_for("login"))
    return render_template("signup.html")

@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        return redirect(url_for("login"))
    return render_template("forgot-password.html")

@app.route("/support")
def support():
    return render_template("support.html")

# ✅ New dashboard route
@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")
@app.route("/analytics")
def analytics():
    return render_template("analytics.html")


# =============== API ENDPOINTS ===================
@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT * FROM transactions ORDER BY date DESC")
    data = [
        {"id": row[0], "date": row[1], "description": row[2],
         "category": row[3], "amount": row[4], "type": row[5]}
        for row in cur.fetchall()
    ]
    conn.close()
    return jsonify(data)

@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    data = request.get_json()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO transactions (date, description, category, amount, type)
        VALUES (?, ?, ?, ?, ?)
    """, (data["date"], data["description"], data["category"], data["amount"], data["type"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Transaction added"}), 201

@app.route("/api/transactions/<int:id>", methods=["DELETE"])
def delete_transaction(id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("DELETE FROM transactions WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Transaction deleted"}), 200

# ==================================================
if __name__ == "__main__":
    app.run(debug=True)
