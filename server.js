//serverjs
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3000;
const SECRET_KEY = "tHiS iS mY sEcReT";

// FIXED: added localhost:3000 to allowed origins
app.use(cors({
    origin: ['http://127.0.0.1:5000', 'http://localhost:5500', 'http://localhost:3000']
}));

app.use(express.json());

// serves your frontend files from the /public folder
app.use(express.static('public'));

// FIXED: use 'UNHASHED' placeholder so the condition works correctly
let users = [
    {id: 1, email: 'admin@example.com', password: 'UNHASHED', role: 'admin'},
    {id: 2, email: 'alice@example.com', password: 'UNHASHED', role: 'user'}
];

if (users[0].password === 'UNHASHED') {
    users[0].password = bcrypt.hashSync('admin123', 10);
    users[1].password = bcrypt.hashSync('user123', 10);
}

//POST register
app.post('/api/register', async (req, res) => {
    const {email, password, role = 'user'} = req.body;

    if (!email || !password){
        return res.status(400).json({error: 'Email and password required'});
    }

    const existing = users.find(u => u.email === email);
    if(existing) {
        return res.status(409).json({error: 'User already exists'});
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        email,
        password: hashedPassword,
        role
    };

    users.push(newUser);
    res.status(201).json({message: 'User registered', email, role});
});

//POST login
app.post('/api/login', async (req, res) => {
    // FIXED: now uses email instead of username
    const {email, password} = req.body;
    const user = users.find(u => u.email === email);

    if(!user || !(await bcrypt.compare(password, user.password))){
        return res.status(401).json({error: 'Invalid Credentials'});
    }

    const token = jwt.sign(
        {id: user.id, email: user.email, role: user.role},
        SECRET_KEY,
        {expiresIn: '1h'}
    );

    // FIXED: returns email instead of username
    res.json({token, user: {email: user.email, role: user.role}});
});

//Protected Route
app.get('/api/profile', authenticateToken, (req, res) => {
    res.json({user: req.user});
});

app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json({message: 'Welcome Admin to your Dashboard!', data: 'Secret admin info'});
});

app.get('/api/content/guest', (req, res) => {
    res.json({message: 'Public content for guest'});
});

//MIDDLEWARE

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token){
        return res.status(401).json({error: 'Access token required'});
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({error: 'Invalid or expired token'});
        req.user = user;
        next();
    });
}

function authorizeRole(role){
    return (req, res, next) => {
        if (req.user.role !== role){
            return res.status(403).json({error: 'Access denied: insufficient permission'});
        }
        next();
    };
}

//Server Start
app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
    console.log(`Try logging in with:`);
    console.log(`  - admin: email=admin@example.com, password=admin123`);
    console.log(`  - user:  email=alice@example.com, password=user123`);
});