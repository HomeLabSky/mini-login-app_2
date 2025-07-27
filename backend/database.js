const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// SQLite Datenbank
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './users.db',
  logging: false
});

// User Model (bestehend)
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
  },
  stundenlohn: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    defaultValue: 12.00,
    comment: 'Stundenlohn in Euro'
  },
  abrechnungStart: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 31
    },
    comment: 'Start-Tag des Abrechnungszeitraums'
  },
  abrechnungEnde: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 31,
    validate: {
      min: 1,
      max: 31
    },
    comment: 'End-Tag des Abrechnungszeitraums'
  },
  lohnzettelEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    },
    comment: 'E-Mail-Adresse für Lohnzettel-Versand'
  }
});

// NEU: Minijob-Einstellungen Model
const MinijobSetting = sequelize.define('MinijobSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  monthlyLimit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 999999.99
    },
    comment: 'Monatliches Minijob-Limit in Euro'
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Beschreibung der Einstellung'
  },
  validFrom: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Gültig ab Datum (YYYY-MM-DD)'
  },
  validUntil: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Gültig bis Datum (YYYY-MM-DD), NULL = unbegrenzt'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Ist diese Einstellung derzeit aktiv?'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'ID des Admins, der diese Einstellung erstellt hat'
  }
}, {
  tableName: 'MinijobSettings',
  indexes: [
    {
      fields: ['validFrom']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['validFrom', 'validUntil']
    }
  ]
});

// Beziehungen definieren
User.hasMany(MinijobSetting, { 
  foreignKey: 'createdBy', 
  as: 'CreatedMinijobSettings' 
});
MinijobSetting.belongsTo(User, { 
  foreignKey: 'createdBy', 
  as: 'Creator' 
});

// Helper-Funktion: Aktuelle Minijob-Einstellung ermitteln
MinijobSetting.getCurrentSetting = async function() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD Format
  
  return await MinijobSetting.findOne({
    where: {
      validFrom: {
        [Sequelize.Op.lte]: today
      },
      [Sequelize.Op.or]: [
        { validUntil: null },
        { validUntil: { [Sequelize.Op.gte]: today } }
      ]
    },
    order: [['validFrom', 'DESC']],
    include: [{
      model: User,
      as: 'Creator',
      attributes: ['name', 'email']
    }]
  });
};

// Helper-Funktion: Aktive Einstellungen aktualisieren
MinijobSetting.updateActiveStatus = async function() {
  const today = new Date().toISOString().split('T')[0];
  
  // Alle als inaktiv markieren
  await MinijobSetting.update(
    { isActive: false },
    { where: {} }
  );
  
  // Aktuelle Einstellung finden und als aktiv markieren
  const currentSetting = await MinijobSetting.findOne({
    where: {
      validFrom: {
        [Sequelize.Op.lte]: today
      },
      [Sequelize.Op.or]: [
        { validUntil: null },
        { validUntil: { [Sequelize.Op.gte]: today } }
      ]
    },
    order: [['validFrom', 'DESC']]
  });
  
  if (currentSetting) {
    await currentSetting.update({ isActive: true });
    console.log(`✅ Minijob-Einstellung ${currentSetting.id} ist jetzt aktiv (${currentSetting.monthlyLimit}€)`);
  }
  
  return currentSetting;
};

// Passwort hashen vor dem Speichern (bestehend)
User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 10);
});

// Datenbank initialisieren
const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    
    // Aktive Minijob-Einstellungen beim Start aktualisieren
    await MinijobSetting.updateActiveStatus();
    
    console.log('✅ Datenbank verbunden und initialisiert');
  } catch (error) {
    console.error('❌ Datenbankfehler:', error);
  }
};

module.exports = { 
  User, 
  MinijobSetting,
  initDatabase,
  sequelize 
};