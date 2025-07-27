require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize'); // Für Operators
const { User, MinijobSetting, initDatabase } = require('./database'); // ERWEITERT

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
  user: { 
    id: user.id, 
    email: user.email, 
    name: user.name,
    role: user.role,        // NEU: Rolle hinzufügen
    isActive: user.isActive // NEU: Status hinzufügen
  }
});
  } catch (error) {
    console.error('Login Fehler:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// TOKEN REFRESH
app.post('/api/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh Token erforderlich' });
  }
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findByPk(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'User nicht gefunden oder inaktiv' });
    }
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    console.log(`🔄 Token refresh für ${user.email}`);
    
    res.json({
      message: 'Token erfolgreich erneuert',
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Token refresh Fehler:', error);
    res.status(403).json({ error: 'Ungültiger Refresh Token' });
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
      attributes: [
        'id', 'email', 'name', 'role', 'isActive', 'createdAt',
        'stundenlohn', 'abrechnungStart', 'abrechnungEnde', 'lohnzettelEmail'  // NEU HINZUFÜGEN
      ],
      order: [['id', 'ASC']]
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

// USER BEARBEITEN (nur Admin)
app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { email, name, role, isActive, password } = req.body;
    
    // User finden
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    
    // Email-Eindeutigkeit prüfen (falls Email geändert wird)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'Email bereits vergeben' });
      }
    }
    
    // Update-Objekt vorbereiten
    const updateData = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    
    // Passwort separat behandeln (falls angegeben)
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }
    
    // User aktualisieren
    await user.update(updateData);
    
    console.log(`✏️ Admin ${req.user.email} hat User ${user.email} bearbeitet`);
    
    res.json({
      message: 'Benutzer erfolgreich aktualisiert',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        stundenlohn: user.stundenlohn,
        abrechnungStart: user.abrechnungStart,
        abrechnungEnde: user.abrechnungEnde,
        lohnzettelEmail: user.lohnzettelEmail
      }
    });
  } catch (error) {
    console.error('Fehler beim Bearbeiten des Users:', error);
    res.status(500).json({ error: 'Benutzer konnte nicht aktualisiert werden' });
  }
});

// USER EINSTELLUNGEN BEARBEITEN (nur Admin)
app.put('/api/admin/users/:id/settings', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { stundenlohn, abrechnungStart, abrechnungEnde, lohnzettelEmail } = req.body;
    
    // User finden
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    
    // Validierung
    if (stundenlohn && (stundenlohn < 0 || stundenlohn > 999)) {
      return res.status(400).json({ error: 'Stundenlohn muss zwischen 0 und 999 Euro liegen' });
    }
    
    if (abrechnungStart && (abrechnungStart < 1 || abrechnungStart > 31)) {
      return res.status(400).json({ error: 'Abrechnungsstart muss zwischen 1 und 31 liegen' });
    }
    
    if (abrechnungEnde && (abrechnungEnde < 1 || abrechnungEnde > 31)) {
      return res.status(400).json({ error: 'Abrechnungsende muss zwischen 1 und 31 liegen' });
    }
    
    // Update-Objekt vorbereiten
    const updateData = {};
    if (stundenlohn !== undefined) updateData.stundenlohn = parseFloat(stundenlohn);
    if (abrechnungStart !== undefined) updateData.abrechnungStart = parseInt(abrechnungStart);
    if (abrechnungEnde !== undefined) updateData.abrechnungEnde = parseInt(abrechnungEnde);
    if (lohnzettelEmail !== undefined) updateData.lohnzettelEmail = lohnzettelEmail || null;
    
    // User-Einstellungen aktualisieren
    await user.update(updateData);
    
    console.log(`⚙️ Admin ${req.user.email} hat Einstellungen für ${user.email} aktualisiert`);
    
    res.json({
      message: 'Einstellungen erfolgreich aktualisiert',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        stundenlohn: user.stundenlohn,
        abrechnungStart: user.abrechnungStart,
        abrechnungEnde: user.abrechnungEnde,
        lohnzettelEmail: user.lohnzettelEmail
      }
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Einstellungen:', error);
    res.status(500).json({ error: 'Einstellungen konnten nicht aktualisiert werden' });
  }
});

// USER DEAKTIVIEREN/AKTIVIEREN (nur Admin)
app.patch('/api/admin/users/:id/toggle-status', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // User finden
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    
    // Status umschalten
    const newStatus = !user.isActive;
    await user.update({ isActive: newStatus });
    
    console.log(`🔄 Admin ${req.user.email} hat User ${user.email} ${newStatus ? 'aktiviert' : 'deaktiviert'}`);
    
    res.json({
      message: `Benutzer erfolgreich ${newStatus ? 'aktiviert' : 'deaktiviert'}`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Fehler beim Ändern des User-Status:', error);
    res.status(500).json({ error: 'Status konnte nicht geändert werden' });
  }
});

// ===== MINIJOB-EINSTELLUNGEN ROUTES (NUR ADMIN) =====

// Alle Minijob-Einstellungen abrufen
app.get('/api/admin/minijob-settings', requireAdmin, async (req, res) => {
  try {
    const settings = await MinijobSetting.findAll({
      include: [{
        model: User,
        as: 'Creator',
        attributes: ['name', 'email']
      }],
      order: [['validFrom', 'DESC']]
    });

    // Aktive Einstellungen aktualisieren
    await MinijobSetting.updateActiveStatus();

    console.log(`📋 Admin ${req.user.email} hat Minijob-Einstellungen abgerufen`);

    res.json({
      message: 'Minijob-Einstellungen erfolgreich geladen',
      settings: settings,
      total: settings.length
    });
  } catch (error) {
    console.error('Fehler beim Laden der Minijob-Einstellungen:', error);
    res.status(500).json({ error: 'Minijob-Einstellungen konnten nicht geladen werden' });
  }
});

// Aktuelle Minijob-Einstellung abrufen
app.get('/api/admin/minijob-settings/current', requireAdmin, async (req, res) => {
  try {
    const currentSetting = await MinijobSetting.getCurrentSetting();

    if (!currentSetting) {
      return res.status(404).json({ 
        error: 'Keine aktuelle Minijob-Einstellung gefunden',
        suggestion: 'Bitte erstellen Sie eine neue Einstellung'
      });
    }

    console.log(`📊 Admin ${req.user.email} hat aktuelle Minijob-Einstellung abgerufen`);

    res.json({
      message: 'Aktuelle Minijob-Einstellung gefunden',
      setting: currentSetting
    });
  } catch (error) {
    console.error('Fehler beim Laden der aktuellen Minijob-Einstellung:', error);
    res.status(500).json({ error: 'Aktuelle Minijob-Einstellung konnte nicht geladen werden' });
  }
});

// Neue Minijob-Einstellung erstellen
app.post('/api/admin/minijob-settings', requireAdmin, [
  body('monthlyLimit')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Monatliches Limit muss zwischen 0 und 999.999,99€ liegen'),
  body('description')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Beschreibung muss zwischen 3 und 500 Zeichen haben'),
  body('validFrom')
    .isISO8601({ strict: true })
    .toDate()
    .withMessage('Gültigkeit-Von muss ein gültiges Datum sein (YYYY-MM-DD)'),
  body('validUntil')
    .optional({ nullable: true })
    .isISO8601({ strict: true })
    .toDate()
    .withMessage('Gültigkeit-Bis muss ein gültiges Datum sein oder leer bleiben')
], handleValidationErrors, async (req, res) => {
  try {
    const { monthlyLimit, description, validFrom, validUntil } = req.body;

    // Validierung: validFrom darf nicht in der Vergangenheit liegen (außer heute)
    const today = new Date().toISOString().split('T')[0];
    const fromDate = new Date(validFrom).toISOString().split('T')[0];
    
    if (fromDate < today) {
      return res.status(400).json({ 
        error: 'Das Startdatum darf nicht in der Vergangenheit liegen' 
      });
    }

    // Validierung: validUntil muss nach validFrom liegen
    if (validUntil) {
      const untilDate = new Date(validUntil).toISOString().split('T')[0];
      if (untilDate <= fromDate) {
        return res.status(400).json({ 
          error: 'Das Enddatum muss nach dem Startdatum liegen' 
        });
      }
    }

    // Prüfen auf Überschneidungen mit bestehenden Einstellungen
    const overlappingSettings = await MinijobSetting.findAll({
      where: {
        [Sequelize.Op.or]: [
          // Neue Einstellung startet innerhalb einer bestehenden
          {
            validFrom: { [Sequelize.Op.lte]: fromDate },
            [Sequelize.Op.or]: [
              { validUntil: null },
              { validUntil: { [Sequelize.Op.gte]: fromDate } }
            ]
          },
          // Neue Einstellung endet innerhalb einer bestehenden (nur wenn validUntil gesetzt)
          validUntil ? {
            validFrom: { [Sequelize.Op.lte]: validUntil },
            [Sequelize.Op.or]: [
              { validUntil: null },
              { validUntil: { [Sequelize.Op.gte]: validUntil } }
            ]
          } : {},
          // Bestehende Einstellung liegt komplett innerhalb der neuen
          validUntil ? {
            validFrom: { [Sequelize.Op.gte]: fromDate },
            validUntil: { [Sequelize.Op.lte]: validUntil }
          } : {}
        ]
      }
    });

    if (overlappingSettings.length > 0) {
      return res.status(409).json({
        error: 'Zeitraum überschneidet sich mit bestehenden Einstellungen',
        conflictingSettings: overlappingSettings.map(s => ({
          id: s.id,
          validFrom: s.validFrom,
          validUntil: s.validUntil,
          description: s.description
        }))
      });
    }

    // Neue Einstellung erstellen
    const newSetting = await MinijobSetting.create({
      monthlyLimit: parseFloat(monthlyLimit),
      description,
      validFrom: fromDate,
      validUntil: validUntil ? new Date(validUntil).toISOString().split('T')[0] : null,
      createdBy: req.user.userId
    });

    // Aktive Einstellungen aktualisieren
    await MinijobSetting.updateActiveStatus();

    console.log(`➕ Admin ${req.user.email} hat neue Minijob-Einstellung erstellt: ${monthlyLimit}€ ab ${fromDate}`);

    res.status(201).json({
      message: 'Minijob-Einstellung erfolgreich erstellt',
      setting: newSetting
    });
  } catch (error) {
    console.error('Fehler beim Erstellen der Minijob-Einstellung:', error);
    res.status(500).json({ error: 'Minijob-Einstellung konnte nicht erstellt werden' });
  }
});

// Minijob-Einstellung bearbeiten
app.put('/api/admin/minijob-settings/:id', requireAdmin, [
  body('monthlyLimit')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Monatliches Limit muss zwischen 0 und 999.999,99€ liegen'),
  body('description')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Beschreibung muss zwischen 3 und 500 Zeichen haben'),
  body('validFrom')
    .isISO8601({ strict: true })
    .toDate()
    .withMessage('Gültigkeit-Von muss ein gültiges Datum sein'),
  body('validUntil')
    .optional({ nullable: true })
    .isISO8601({ strict: true })
    .toDate()
    .withMessage('Gültigkeit-Bis muss ein gültiges Datum sein oder leer bleiben')
], handleValidationErrors, async (req, res) => {
  try {
    const settingId = req.params.id;
    const { monthlyLimit, description, validFrom, validUntil } = req.body;

    const setting = await MinijobSetting.findByPk(settingId);
    if (!setting) {
      return res.status(404).json({ error: 'Minijob-Einstellung nicht gefunden' });
    }

    // Datum-Validierung
    const fromDate = new Date(validFrom).toISOString().split('T')[0];
    
    if (validUntil) {
      const untilDate = new Date(validUntil).toISOString().split('T')[0];
      if (untilDate <= fromDate) {
        return res.status(400).json({ 
          error: 'Das Enddatum muss nach dem Startdatum liegen' 
        });
      }
    }

    // Aktualisieren
    await setting.update({
      monthlyLimit: parseFloat(monthlyLimit),
      description,
      validFrom: fromDate,
      validUntil: validUntil ? new Date(validUntil).toISOString().split('T')[0] : null
    });

    // Aktive Einstellungen aktualisieren
    await MinijobSetting.updateActiveStatus();

    console.log(`✏️ Admin ${req.user.email} hat Minijob-Einstellung ${settingId} bearbeitet`);

    res.json({
      message: 'Minijob-Einstellung erfolgreich aktualisiert',
      setting: setting
    });
  } catch (error) {
    console.error('Fehler beim Bearbeiten der Minijob-Einstellung:', error);
    res.status(500).json({ error: 'Minijob-Einstellung konnte nicht aktualisiert werden' });
  }
});

// Minijob-Einstellung löschen (nur zukünftige)
app.delete('/api/admin/minijob-settings/:id', requireAdmin, async (req, res) => {
  try {
    const settingId = req.params.id;
    const today = new Date().toISOString().split('T')[0];

    const setting = await MinijobSetting.findByPk(settingId);
    if (!setting) {
      return res.status(404).json({ error: 'Minijob-Einstellung nicht gefunden' });
    }

    // Nur zukünftige Einstellungen dürfen gelöscht werden
    if (setting.validFrom <= today) {
      return res.status(400).json({ 
        error: 'Aktive oder vergangene Einstellungen können nicht gelöscht werden',
        suggestion: 'Bearbeiten Sie die Einstellung oder erstellen Sie eine neue'
      });
    }

    await setting.destroy();

    console.log(`🗑️ Admin ${req.user.email} hat zukünftige Minijob-Einstellung ${settingId} gelöscht`);

    res.json({
      message: 'Minijob-Einstellung erfolgreich gelöscht'
    });
  } catch (error) {
    console.error('Fehler beim Löschen der Minijob-Einstellung:', error);
    res.status(500).json({ error: 'Minijob-Einstellung konnte nicht gelöscht werden' });
  }
});

// Minijob-Status für alle Einstellungen aktualisieren (Manual Trigger)
app.post('/api/admin/minijob-settings/refresh-status', requireAdmin, async (req, res) => {
  try {
    const currentSetting = await MinijobSetting.updateActiveStatus();

    console.log(`🔄 Admin ${req.user.email} hat Minijob-Status manuell aktualisiert`);

    res.json({
      message: 'Minijob-Status erfolgreich aktualisiert',
      currentSetting: currentSetting
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Minijob-Status:', error);
    res.status(500).json({ error: 'Minijob-Status konnte nicht aktualisiert werden' });
  }
});

// ===== TEMPORÄRE ROUTE: Ersten Admin erstellen =====
app.get('/api/create-first-admin', async (req, res) => {  // GET statt POST
  try {
    // Prüfen ob bereits ein Admin existiert
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    if (existingAdmin) {
      return res.status(400).json({ 
        error: 'Admin bereits vorhanden',
        existingAdmin: {
          email: existingAdmin.email,
          name: existingAdmin.name,
          role: existingAdmin.role
        }
      });
    }
    
    // Ersten Admin erstellen
    const admin = await User.create({
      email: 'admin@schoppmann.de',
      password: 'Admin123!',
      name: 'Administrator',
      role: 'admin',
      isActive: true
    });
    
    console.log('🔑 Erster Admin wurde erstellt!');
    
    res.json({
      message: 'Erster Admin erfolgreich erstellt',
      admin: {
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      loginDaten: {
        email: 'admin@schoppmann.de',
        passwort: 'Admin123!'
      }
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Admins:', error);
    res.status(500).json({ error: 'Admin konnte nicht erstellt werden' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Sicherer Server läuft auf http://localhost:${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV}`);
});