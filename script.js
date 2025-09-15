import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sequelize = new Sequelize('sqlite::memory:');
try{
    await sequelize.authenticate();
    console.log('Соединение с БД есть');
} catch (e){
    console.log('Соединения с БД нету', e);
}

const Role = sequelize.define(
    'Role', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        }
    }
);

const User = sequelize.define(
    'User', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        login: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        roleId: {
            type: DataTypes.INTEGER,
            references: {
                model: Role,
                key: 'id',
            },
            allowNull: false,
        }
    }
);

Role.hasMany(User, { foreignKey: "roleId" });
User.belongsTo(Role, { foreignKey: 'roleId' });

// Инициализация ролей при запуске
async function initializeRoles() {
    try {
        await sequelize.sync({ force: false });
        
        // Создаем стандартные роли если их нет
        const roles = ['Админ', 'Пользователь'];
        for (const roleName of roles) {
            await Role.findOrCreate({
                where: { name: roleName },
                defaults: { name: roleName }
            });
        }
        
        console.log('База данных инициализирована');
    } catch (error) {
        console.error('Ошибка инициализации БД:', error);
    }
}

const app = express();
const port = 5000; 

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
    session({
        secret: 'secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
    })
);

// Исправление: правильное указание статической папки
app.use(express.static(path.join(__dirname, 'public')));

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login')
    }
};

function hasRole(roleName) {
    return async (req, res, next) => {
        if (req.session.user) {
            const user = await User.findByPk(req.session.user.id, { include: Role }); 
            if (user && user.Role.name === roleName) {
                next();
            } else {
                res.status(403).send('Доступ запрещён');
            }
        } else {
            res.redirect('/login');
        }
    };
}

// Главная страница теперь всегда ведет на логин
app.get('/', (req, res) => {
    res.redirect('/login');
});

// ИСПРАВЛЕНИЕ: Убрали лишнюю логику из GET /register
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', async (req, res) => {
    const { login, password, roleId } = req.body;
    try {
        const role = await Role.findByPk(roleId);
        if (!role) {
            return res.status(400).send('Роль не найдена');
        }

        const existingUser = await User.findOne({ where: { login } });
        if (existingUser) {
            return res.status(400).send('Пользователь с таким логином уже существует');
        }

        const user = await User.create({
            login,
            password,
            roleId
        });

        res.redirect('/login');
    } catch (error) {
        res.status(400).send('Ошибка регистрации: ' + error.message);
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    const { login, password } = req.body;
    try {
        const user = await User.findOne({ 
            where: { login, password }, 
            include: Role 
        });
        
        if (user) {
            req.session.user = { 
                id: user.id, 
                login: user.login, 
                role: user.Role.name 
            };
            res.redirect('/profile');
        } else {
            res.status(401).send('Неверный логин или пароль');
        }
    } catch (error) {
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/profile', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/admin', isAuthenticated, hasRole('Админ'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API для получения ролей (для формы регистрации)
app.get('/api/roles', async (req, res) => {
    try {
        const roles = await Role.findAll();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения ролей' });
    }
});

// API для получения информации о текущем пользователе
app.get('/api/user-info', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findByPk(req.session.user.id, { include: Role });
        res.json({
            id: user.id,
            login: user.login,
            role: user.Role.name
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения информации' });
    }
});

// API для получения списка пользователей (только для админов)
app.get('/api/users', isAuthenticated, hasRole('Админ'), async (req, res) => {
    try {
        const users = await User.findAll({ include: Role });
        res.json(users.map(user => ({
            id: user.id,
            login: user.login,
            role: user.Role.name
        })));
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
});

// Запуск сервера
app.listen(port, async () => {
    await initializeRoles();
    console.log(`Сервер запущен на порту: ${port}`);
    console.log(`Страница логина: http://localhost:${port}/login`);
    console.log(`Главная страница: http://localhost:${port}/`);
});