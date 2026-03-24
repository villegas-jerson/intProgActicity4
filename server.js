//serverjs
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3000;
const SECRET_KEY = "tHiS iS mY sEcReT";

// BUG 1 FIXED: was app.use(cor({ — typo, missing 's'
app.use(cors({
    origin: ['http://127.0.0.1:5000', 'http://localhost:5500']
}));

app.use(express.json());

let users = [
    {id: 1, username: 'admin', password:'$2a$10$...', role: 'admin'},
    {id: 2, username: 'alice', password: '$2a$10$...', role: 'user'}
];

if (!users[0].password.includes('$2a$')) {
    users[0].password = bcrypt.hashSync('admin123', 10);
    users[1].password = bcrypt.hashSync('user123', 10);
}

//POST register
app.post('/api/register', async (req, res) => {
    const {username, password, role = 'user'} = req.body;

    if (!username || !password){
        return res.status(400).json({error: 'Username and password required'});
    }

    // BUG 2 FIXED: was users.fund( — typo, should be users.find(
    const existing = users.find(u => u.username === username);
    if(existing) {
        return res.status(409).json({error: 'User already exists'});
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        username,
        password: hashedPassword,
        role
    };

    users.push(newUser);
    res.status(201).json({message: 'User registered', username, role});
});

//POST login
app.post('/api/login', async (req, res) => {
    const {username, password} = req.body;

    const user = users.find(u => u.username === username);

    // BUG 3 FIXED: was missing ! before await bcrypt.compare — logic was inverted
    if(!user || !(await bcrypt.compare(password, user.password))){
        return res.status(401).json({error: 'Invalid Credentials'});
    }

    const token = jwt.sign(
        {id: user.id, username: user.username, role: user.role},
        SECRET_KEY,
        {expiresIn: '1h'}
    );

    res.json({token, user: {username: user.username, role: user.role}});
});

//Protected Route
app.get('/api/profile', authenticateToken, (req, res) => {
    res.json({user: req.user});
});

// BUG 5 FIXED: was 'api/admin/dashboard' — missing leading /
app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json({message: 'Welcome Admin to your Dashboard!', data: 'Secret admin info'});
});

// BUG 5 FIXED: was 'api/content/guest' — missing leading /
app.get('/api/content/guest', (req, res) => {
    res.json({message: 'Public content for guest'});
});

//MIDDLEWARE

//TOKEN AUTH
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    // BUG 4 FIXED: was split('')[1] — empty string splits every character
    // should be split(' ')[1] — splits "Bearer <token>" by space
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
    console.log(`  - admin: username=admin, password=admin123`);
    console.log(`  - user:  username=alice, password=user123`);
});