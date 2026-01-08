const Joi = require('joi');
const { AppError } = require('../utils/helpers');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const message = error.details[0].message;
      return next(new AppError(message, 400));
    }
    next();
  };
};

module.exports = { validate };