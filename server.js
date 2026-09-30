const express=require("express"), path=require("path"), Database=require("better-sqlite3"), bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken");
const app=express(), db=new Database("bpo.sqlite"), SECRET=process.env.JWT_SECRET||"change-this-secret-in-production";
app.use(express.json()); app.use(express.static(path.join(__dirname,"public")));
db.pragma("foreign_keys=ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'agent',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS clients(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,industry TEXT,status TEXT DEFAULT 'Onboarding',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS campaigns(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,client_id INTEGER,channel TEXT DEFAULT 'Voice',status TEXT DEFAULT 'Setup',created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT,client_id INTEGER,last_interaction TEXT,status TEXT DEFAULT 'Active',created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id INTEGER,subject TEXT NOT NULL,priority TEXT DEFAULT 'Normal',status TEXT DEFAULT 'Open',agent_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,FOREIGN KEY(agent_id) REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL);
`);
if(!db.prepare("SELECT id FROM users LIMIT 1").get()){
 const hash=bcrypt.hashSync("admin123",10);
 db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)").run("Administrator","admin@bpo.local",hash,"admin");
}
function auth(req,res,next){const h=req.headers.authorization||"";try{req.user=jwt.verify(h.replace("Bearer ",""),SECRET);next()}catch(e){res.status(401).json({error:"Unauthorized"})}}
function log(user,action){db.prepare("INSERT INTO audit_logs(user_id,action) VALUES(?,?)").run(user.id,action)}
app.post("/api/login",(req,res)=>{const u=db.prepare("SELECT * FROM users WHERE email=?").get(req.body.email);if(!u||!bcrypt.compareSync(req.body.password,u.password_hash))return res.status(401).json({error:"Invalid credentials"});const token=jwt.sign({id:u.id,name:u.name,email:u.email,role:u.role},SECRET,{expiresIn:"8h"});res.json({token,user:{id:u.id,name:u.name,email:u.email,role:u.role}})});
app.get("/api/me",auth,(req,res)=>res.json(req.user));
app.get("/api/dashboard",auth,(req,res)=>{const q=x=>db.prepare(x).get();res.json({clients:q("SELECT COUNT(*) n FROM clients").n,agents:q("SELECT COUNT(*) n FROM users WHERE role='agent'").n,campaigns:q("SELECT COUNT(*) n FROM campaigns WHERE status='Live'").n,openTickets:q("SELECT COUNT(*) n FROM tickets WHERE status!='Closed'").n,available:q("SELECT COUNT(*) n FROM users WHERE role='agent'").n})});
const resources={
clients:["SELECT c.*,COUNT(DISTINCT ca.id) campaigns FROM clients c LEFT JOIN campaigns ca ON ca.client_id=c.id GROUP BY c.id ORDER BY c.id DESC"],
agents:["SELECT id,name,email,role FROM users WHERE role IN ('agent','manager') ORDER BY id DESC"],
campaigns:["SELECT ca.*,c.name client FROM campaigns ca LEFT JOIN clients c ON c.id=ca.client_id ORDER BY ca.id DESC"],
customers:["SELECT cu.*,c.name client FROM customers cu LEFT JOIN clients c ON c.id=cu.client_id ORDER BY cu.id DESC"],
tickets:["SELECT t.*,cu.name customer,u.name agent FROM tickets t LEFT JOIN customers cu ON cu.id=t.customer_id LEFT JOIN users u ON u.id=t.agent_id ORDER BY t.id DESC"],
logs:["SELECT a.*,u.name user FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100"]
};
for(const [name,[sql]] of Object.entries(resources))app.get("/api/"+name,auth,(req,res)=>res.json(db.prepare(sql).all()));
app.post("/api/clients",auth,(req,res)=>{if(!["admin","manager"].includes(req.user.role))return res.status(403).json({error:"Forbidden"});const r=db.prepare("INSERT INTO clients(name,industry,status) VALUES(?,?,?)").run(req.body.name,req.body.industry||"General",req.body.status||"Onboarding");log(req.user,"Created client "+r.lastInsertRowid);res.json({id:r.lastInsertRowid})});
app.post("/api/campaigns",auth,(req,res)=>{if(!["admin","manager"].includes(req.user.role))return res.status(403).json({error:"Forbidden"});const r=db.prepare("INSERT INTO campaigns(name,client_id,channel,status) VALUES(?,?,?,?)").run(req.body.name,req.body.client_id||null,req.body.channel||"Voice",req.body.status||"Setup");log(req.user,"Created campaign "+r.lastInsertRowid);res.json({id:r.lastInsertRowid})});
app.post("/api/customers",auth,(req,res)=>{const r=db.prepare("INSERT INTO customers(name,email,client_id,last_interaction) VALUES(?,?,?,?)").run(req.body.name,req.body.email||"",req.body.client_id||null,req.body.last_interaction||"New");log(req.user,"Created customer "+r.lastInsertRowid);res.json({id:r.lastInsertRowid})});
app.post("/api/tickets",auth,(req,res)=>{const r=db.prepare("INSERT INTO tickets(customer_id,subject,priority,status,agent_id) VALUES(?,?,?,?,?)").run(req.body.customer_id||null,req.body.subject,req.body.priority||"Normal",req.body.status||"Open",req.body.agent_id||null);log(req.user,"Created ticket "+r.lastInsertRowid);res.json({id:r.lastInsertRowid})});
app.post("/api/users",auth,(req,res)=>{if(req.user.role!=="admin")return res.status(403).json({error:"Forbidden"});const hash=bcrypt.hashSync(req.body.password||"ChangeMe123!",10);try{const r=db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)").run(req.body.name,req.body.email,hash,req.body.role||"agent");log(req.user,"Created user "+r.lastInsertRowid);res.json({id:r.lastInsertRowid})}catch(e){res.status(400).json({error:"Email already exists"})}});
app.listen(3000,()=>console.log("BPO OS v0.3 running at http://localhost:3000"));
