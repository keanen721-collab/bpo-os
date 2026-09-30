# BPO OS v0.3 — Full-stack prototype

## What changed
Version 0.3 moves from a browser-only demo to a local full-stack application:
- Node.js + Express backend
- SQLite persistent database
- Password hashing with bcrypt
- JWT authentication
- Role-aware API permissions
- Audit logging
- Persistent clients, agents, campaigns, customers and tickets
- Searchable management screens
- Dashboard backed by database data

## Run
1. Install Node.js 18+.
2. Extract this ZIP.
3. Open a terminal in the extracted folder.
4. Run: `npm install`
5. Run: `npm start`
6. Open: http://localhost:3000

Demo admin:
Email: admin@bpo.local
Password: admin123

IMPORTANT: This is still a development prototype. Before using real customer data or deploying publicly, change JWT_SECRET, change the demo password, add HTTPS, stronger password rules, backups, CSRF/rate-limit protections, production secrets management, and a proper cloud database/hosting setup.
