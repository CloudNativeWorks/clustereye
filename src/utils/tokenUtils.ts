interface DecodedToken {
  exp: number;
  iat: number;
  [key: string]: any;
}

export const isTokenExpired = (): boolean => {
  const token = localStorage.getItem('token');
  if (!token) return true;

  try {
    // JWT token consists of three parts separated by dots
    const [, payloadBase64] = token.split('.');
    
    // Decode the base64 payload
    const payload = JSON.parse(atob(payloadBase64));
    
    // Check if the token has expired
    const currentTime = Math.floor(Date.now() / 1000); // Convert to seconds
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

export const getTokenExpirationTime = (): Date | null => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(atob(payloadBase64));
    return new Date(payload.exp * 1000); // Convert seconds to milliseconds
  } catch (error) {
    console.error('Error getting token expiration time:', error);
    return null;
  }
}; 