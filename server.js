//serverjs
const express =  require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3000;
const SECRET_KEY = "tHiS iS mY sEcReT";//buhatKey

app.use(cor({
    origin: ['http://127.0.0.1:5000' , 'http://localhost:5500']
}));

app.use(express.json());

let users = [
    {id: 1, username: 'admin', password:'$2a$10$...', role: 'admin'},
    {id: 2, username: 'alice', password: '$2a$10$...', role: 'user'}
];

if (!users[0].password.includes('$2a$')) {
    users[0].password = bcrypt.hashSync('admin123', 10);
    users[1].password = bcrypt.hashSync('users123', 10);
}

//POST register
app.post('/api/register', async (req, res) => {
    const {username, password, role = 'user'} = req.body

    if (!username || ! password){
        return res.status(400).json({error: 'Username and password required'});
    }

    //check if user exist
    const existing = users.fund(u => u.username === username);
    if(existing) {
        return res.status(409).json({error: 'User already exists'});
    }

    //Haspassword
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        username,
        password: hashedPassword,
        role //remove in real app, this is a NO NO
    };

    users.push(newUser);
    res.status(201).json({message : 'User registered', username, role});
});


//POST login
app.post('/api/login', async (req, res) =>{
    const {username, password} = req.body;

    const user = users.find(u => u.username === username);
    if(!user || await bcrypt.compare(password, user.password)){
        return res.status(401).json({error: 'Invalid Credentials'});
    }

    const token = jwt.sign(
        {id : user.id, username: user.username, role : user.role},
        SECRET_KEY,
        {expiresIn:'1h'}
    );
    
    res.json({token, user: {username: user.username, role: user.role}});
});

//protected Route
app.get('/api/profile', authenticateToken, (req,res) => {
    res.json({user: req.user});
});

//RoleBased Route
app.get('api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json({message: 'Wellcome Admin to your Dashboard!', data:'Secret admin info'});
});

//Guest Content
app.get('api/content/guest', (req, res) => {
    res.json({message: 'Public content for guest'});
});

//MIDDLEWEAR

//TOKEN AUTH
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split('')[1];

    if (!token){
        return res.status(401).json({error: 'Access token Required'});
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({error: 'invalid or Expired token'});
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

//ServerStart
app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
    console.log(`Try logging in with:`);
    console.log(`  -admin: username=admin, password=admin123`);
    console.log(`  -admin: username=alice, password=user123`);
});