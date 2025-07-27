require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet());

// Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // Max 5 Login-Versuche
  message: { error: 'Zu viele Login-Versuche. Versuche es in 15 Minuten erneut.' }
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Zu viele Anfragen.' }
});

// CORS
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(generalLimiter);

// Datenbank initialisieren
initDatabase();

// Validation
const validateRegistration = [
  body('email')
    .isEmail()
    .withMessage('Bitte eine gültige Email-Adresse eingeben')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Passwort muss mindestens 8 Zeichen haben')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Passwort muss Groß-, Kleinbuchstaben und mindestens eine Zahl enthalten'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name muss zwischen 2 und 50 Zeichen haben')
    .matches(/^[a-zA-ZäöüÄÖÜß\s]+$/)
    .withMessage('Name darf nur Buchstaben und Leerzeichen enthalten')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Eingabefehler', 
      details: errors.array().map(err => err.msg)
    });
  }
  next();
};

// JWT Helper Functions mit Rollen-Support
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      role: user.role,           // NEU: Rolle hinzufügen
      name: user.name            // NEU: Name hinzufügen
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { 
      userId: user.id,
      role: user.role            // NEU: Rolle auch im Refresh Token
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access Token erforderlich' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Ungültiger Token' });
    }
    req.user = user;
    next();
  });
};

// Admin-only Middleware
const requireAdmin = (req, res, next) => {
  // Erst prüfen ob User eingeloggt ist
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access Token erforderlich' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Ungültiger Token' });
    }
    
    // NEU: Admin-Rolle prüfen
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Administratorrechte erforderlich',
        userRole: user.role 
      });
    }
    
    req.user = user;
    next();
  });
};

// ROUTES
app.get('/api/test', (req, res) => {
  res.json({ message: 'Sicheres Backend läuft!', timestamp: new Date().toISOString() });
});

// REGISTRIERUNG
app.post('/api/register', validateRegistration, handleValidationErrors, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email bereits registriert' });
    }
    
    const user = await User.create({ email, password, name });
    const { accessToken, refreshToken } = generateTokens(user);
    
    console.log(`✅ Neue Registrierung: ${email}`);
    
    res.status(201).json({ 
      message: 'Registrierung erfolgreich',
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Registrierung Fehler:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// LOGIN
app.post('/api/login', loginLimiter, validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Email oder Passwort falsch' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email oder Passwort falsch' });
    }
    
    const { accessToken, refreshToken } = generateTokens(user);
    
    console.log(`✅ Login: ${email}`);
    
    res.json({
      message: 'Login erfolgreich',
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Login Fehler:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// PROFIL (geschützt)
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'email', 'name', 'createdAt']
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Profil konnte nicht geladen werden' });
  }
});

// ===== ADMIN-ONLY ROUTES =====

// ALLE USER AUFLISTEN (nur Admin)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'role', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`📋 Admin ${req.user.email} hat User-Liste abgerufen`);
    
    res.json({
      message: 'User-Liste erfolgreich geladen',
      users: users,
      total: users.length
    });
  } catch (error) {
    console.error('Fehler beim Laden der User:', error);
    res.status(500).json({ error: 'User-Liste konnte nicht geladen werden' });
  }
});

// NEUEN USER ERSTELLEN (nur Admin)
app.post('/api/admin/users', requireAdmin, validateRegistration, handleValidationErrors, async (req, res) => {
  try {
    const { email, password, name, role = 'mitarbeiter' } = req.body;
    
    // Prüfen ob User bereits existiert
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email bereits registriert' });
    }
    
    // Neuen User erstellen
    const user = await User.create({ 
      email, 
      password, 
      name, 
      role: role === 'admin' ? 'admin' : 'mitarbeiter',
      isActive: true
    });
    
    console.log(`➕ Admin ${req.user.email} hat neuen User erstellt: ${email} (${role})`);
    
    res.status(201).json({ 
      message: 'Benutzer erfolgreich erstellt',
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Users:', error);
    res.status(500).json({ error: 'Benutzer konnte nicht erstellt werden' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Sicherer Server läuft auf http://localhost:${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV}`);
});