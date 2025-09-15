import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sequelize = new Sequelize ('test1', 'admin', '1',{
    host: 'localhost',
    dialect: 'mssql'
});


const Role = sequelize.define(
    'Role',{
        id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name:{
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        }
    }
);


const User = sequelize.define(
    'User',{
        id:{
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        login:{
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        password:{
            type: DataTypes.STRING,
            allowNull: false,
        },
        roleId:{
            type: DataTypes.INTEGER,
            references:{
                model: Role,
                key: 'id',
            },
            allowNull: false,
        }
    }
);

Role.hasMany(User, {foreignKey:"roleId"});
User.belongsTo(Role, {foreignKey:'roleId'});

sequelize.sync();


const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(
    session({
        secret: 'secret-key',
        resave: false,
        saveUninitialized: false,
    })
);

app.use(express.static(path.join(__dirname,'public')));

function isAuthenticated(req, res, next){
    if (req.session.user){
        next();
    } else{
        res.redirect('/login')
    }
};

function hasRole (roleName){
    return async (req, res, next) => {
        if(req.session.user){
            const User = await User.findByPk(req.session.user.id, {include: Role});
            if (user && user.Role.name === roleName){
                next();
            } else{
                res.status(403).send('Доступ запрещён');
            }
        } else{
            res.redirect('/login');
        }
    };
}


app.get('/', (req, res) => {
    if(req.session.user) {
        res.redirect('/profile');
    } else{
        res.redirect('/login')
    }
});

app.get('/register', async (req,res) =>{
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', async (req, res) =>{
    const {login, password, roleId} = req.body;
    try{
        const role = await Role.findByPk(roleId);
        if (!role) {
            return res.status(400).send('Роль не найдена');
        } else {
        res.redirect('/login');
        } 
    }   catch (error) {
        res.status(400).send('Ошибка регистрации:' +error.message);
    }
});


app.get ('/login', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


app.post('/login', async (req, res) =>{
    const { login, password} = req.body;
    try {
        const user = await User.findOne({where: {login, password}, include: Role});
        if (user){
            req.session.user = {id: user.id, login: user.login, role: user.Role.name};
            res.redirect('/profile');
        } else {
            res.status(401).send('Неверный логин или пароль');
        }
    } catch (error){
        res.status(500).send('Ошибка сервера:' +error.message);
    }
});

app.get('/profile', isAuthenticated, (req, res) =>{
    res.send(`Добро пожаловать, ${req.session.user.login}! <a href="/logout">Выйти</a>`);
});

app.get('/admin', isAuthenticated,hasRole('Админ'), (req,res)=>{
    res.send('Добро пожаловать в админ-панель, только для админов');
});

app.listen(port, () => {
    console.log(`Сервер порт: ${port}`)
    console.log(`Страница логина: http://localhost:${port}/`)
})