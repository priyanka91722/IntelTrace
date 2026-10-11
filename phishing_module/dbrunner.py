import sqlite3
conn = sqlite3.connect("phishing_scans.db")
c = conn.cursor()
c.execute("SELECT * FROM scans")
for row in c.fetchall():
    print(row)
conn.close()
