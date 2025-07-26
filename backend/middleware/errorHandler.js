const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    success: false,
    error: 'Internal Server Error',
    details: err.message
  };

  // Supabase errors
  if (err.code) {
    switch (err.code) {
      case 'PGRST116':
        error = {
          success: false,
          error: 'Resource not found',
          details: 'The requested resource does not exist'
        };
        return res.status(404).json(error);
      
      case 'PGRST103':
        error = {
          success: false,
          error: 'Bad request',
          details: 'Invalid query parameters or request format'
        };
        return res.status(400).json(error);
      
      default:
        error.details = `Database error: ${err.message}`;
        break;
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error = {
      success: false,
      error: 'Validation Error',
      details: err.message
    };
    return res.status(400).json(error);
  }

  // Default to 500 server error
  res.status(500).json(error);
};

const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    details: `The endpoint ${req.method} ${req.originalUrl} does not exist`
  });
};

module.exports = {
  errorHandler,
  notFound
}; 