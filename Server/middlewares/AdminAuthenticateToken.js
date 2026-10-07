import { verifyAccessToken } from '../utils/authTokens.js';

const AdminAuthenticateToken = (req, res, next) => {
    // Get the JWT token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
 
    if (!token) {
      return res.status(401).json({ message: 'Authorization token not found' });
    }

    try {
      // Verify and decode the token
      const decoded = verifyAccessToken(token);

      // Attach the decoded token to the request object
      req.user = decoded;

      // Proceed to the next middleware or route handler
      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid token' });
    }
  };

  export default AdminAuthenticateToken;
