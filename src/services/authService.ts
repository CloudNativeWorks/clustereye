import axios from 'axios';

// URL'i çevre değişkeninden al, bu sayede farklı ortamlar için farklı değerler kullanılabilir
const API_URL = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost';

export interface LoginResponse {
  success: boolean;
  token: string;
  user?: {
    username: string;
    given_name?: string;
    role?: string;
  };
}

export const loginUser = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await axios.post(`${API_URL}/api/v1/login`, {
    username,
    password
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    withCredentials: true
  });
  
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    
    // Get user role from response or set default based on username
    const role = response.data.role || (username.toLowerCase() === 'admin' ? 'admin' : 'user');
    
    const user = {
      username: username,
      given_name: username,
      role: role
    };
    
    localStorage.setItem('user', JSON.stringify(user));
    
    return {
      success: true,
      token: response.data.token,
      user: user
    };
  }
  
  throw new Error('Login failed');
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
}; 