const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// SQLite Datenbank
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './users.db', // Datei wird automatisch erstellt
  logging: false
});

// User Model mit Rollen
const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'mitarbeiter'),
    allowNull: false,
    defaultValue: 'mitarbeiter'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

// Passwort hashen vor dem Speichern
User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 10);
});

// Datenbank initialisieren
const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // Tabellen erstellen
    console.log('✅ Datenbank verbunden und initialisiert');
  } catch (error) {
    console.error('❌ Datenbankfehler:', error);
  }
};

module.exports = { User, initDatabase };