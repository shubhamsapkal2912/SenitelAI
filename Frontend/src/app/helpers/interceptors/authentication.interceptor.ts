import { HttpInterceptorFn } from '@angular/common/http';

export const authenticationInterceptor: HttpInterceptorFn = (req, next) => {
  // ✅ FIX 1: Use correct localStorage key from your auth service
  const ACCESS_TOKEN = localStorage.getItem('access_token'); // Not Constant.ACCESS_TOKEN
  
  // ✅ FIX 2: Don't parse JWT token - it's already a string!
  if (ACCESS_TOKEN) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${ACCESS_TOKEN}` // Use token directly
      }
    });
    return next(authReq);
  }
  
  return next(req);
};
