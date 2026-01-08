// utils/helpers.js

// Classe d'erreur personnalisée
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Wrapper pour les fonctions async pour capturer les erreurs
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Fonction pour envoyer des réponses standardisées
const sendResponse = (res, statusCode, status, message, data = null) => {
  const response = {
    status,
    message
  };
  
  if (data) {
    response.data = data;
  }
  
  res.status(statusCode).json(response);
};

// Générer les métadonnées de pagination
const getPaginationMeta = (totalItems, currentPage, itemsPerPage) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  
  return {
    currentPage: parseInt(currentPage),
    totalPages,
    totalItems,
    itemsPerPage: parseInt(itemsPerPage),
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? currentPage + 1 : null,
    prevPage: hasPrevPage ? currentPage - 1 : null,
    skip: (currentPage - 1) * itemsPerPage
  };
};

// Fonction pour générer la pagination (ancienne version pour compatibilité)
const generatePagination = (page, limit, total) => {
  const currentPage = parseInt(page) || 1;
  const itemsPerPage = parseInt(limit) || 10;
  const totalItems = parseInt(total) || 0;
  
  return getPaginationMeta(totalItems, currentPage, itemsPerPage);
};

// Filtrer les champs d'un objet
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// Valider un ObjectId MongoDB
const isValidObjectId = (id) => {
  const ObjectId = require('mongoose').Types.ObjectId;
  return ObjectId.isValid(id);
};

// Générer un slug à partir d'une chaîne
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// Calculer la distance entre deux coordonnées géographiques
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en kilomètres
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance en kilomètres
  return distance;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

// Formater une date
const formatDate = (date, locale = 'en-US', options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return new Date(date).toLocaleDateString(locale, { ...defaultOptions, ...options });
};

// Calculer le temps écoulé depuis une date
const getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

// Valider un email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Générer un token aléatoire
const generateRandomToken = (length = 32) => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
};

// Capitaliser la première lettre
const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Nettoyer une chaîne de caractères
const sanitizeString = (str) => {
  return str
    .trim()
    .replace(/[<>]/g, '') // Supprimer les balises HTML basiques
    .replace(/javascript:/gi, '') // Supprimer javascript:
    .replace(/on\w+=/gi, ''); // Supprimer les gestionnaires d'événements
};

// Valider un numéro de téléphone
const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
};

// Convertir une chaîne en boolean
const stringToBoolean = (str) => {
  if (typeof str === 'boolean') return str;
  if (typeof str === 'string') {
    return str.toLowerCase() === 'true';
  }
  return false;
};

// Créer un objet de réponse d'erreur
const createErrorResponse = (message, statusCode = 500, errors = []) => {
  return {
    status: 'error',
    message,
    statusCode,
    errors: Array.isArray(errors) ? errors : [errors]
  };
};

// Créer un objet de réponse de succès
const createSuccessResponse = (message, data = null, statusCode = 200) => {
  const response = {
    status: 'success',
    message,
    statusCode
  };
  
  if (data) {
    response.data = data;
  }
  
  return response;
};

// Fonction pour masquer des informations sensibles
const hideSensitiveData = (obj, fieldsToHide = ['password', 'token', 'secret']) => {
  const result = { ...obj };
  fieldsToHide.forEach(field => {
    if (result[field]) {
      result[field] = '***';
    }
  });
  return result;
};

// Fonction pour parser les paramètres de requête
const parseQueryParams = (query) => {
  const parsed = {};
  
  // Page et limit pour la pagination
  parsed.page = parseInt(query.page) || 1;
  parsed.limit = parseInt(query.limit) || 10;
  
  // Tri
  parsed.sortBy = query.sortBy || 'createdAt';
  parsed.sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  
  // Recherche
  if (query.search) {
    parsed.search = sanitizeString(query.search);
  }
  
  return parsed;
};

// Fonction pour valider les champs requis
const validateRequiredFields = (obj, requiredFields) => {
  const missing = [];
  
  requiredFields.forEach(field => {
    if (!obj[field] || (typeof obj[field] === 'string' && !obj[field].trim())) {
      missing.push(field);
    }
  });
  
  return {
    isValid: missing.length === 0,
    missingFields: missing
  };
};

// Fonction pour créer un hash simple
const createSimpleHash = (data) => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Exporter toutes les fonctions
module.exports = {
  AppError,
  catchAsync,
  sendResponse,
  getPaginationMeta,
  generatePagination,
  filterObj,
  isValidObjectId,
  generateSlug,
  calculateDistance,
  formatDate,
  getTimeAgo,
  isValidEmail,
  generateRandomToken,
  capitalize,
  sanitizeString,
  isValidPhone,
  stringToBoolean,
  createErrorResponse,
  createSuccessResponse,
  hideSensitiveData,
  parseQueryParams,
  validateRequiredFields,
  createSimpleHash
};