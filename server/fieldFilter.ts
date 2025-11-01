import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to filter API response fields based on ?fields query parameter
 * Example: /api/projects?fields=id,name,photoCount
 * 
 * Reduces bandwidth for mobile clients by only sending requested fields
 */
export function fieldFilterMiddleware(req: Request, res: Response, next: NextFunction) {
  const fieldsParam = req.query.fields as string | undefined;
  
  if (!fieldsParam) {
    return next(); // No filtering requested
  }

  // Parse comma-separated field list
  const requestedFields = fieldsParam.split(',').map(f => f.trim()).filter(Boolean);
  
  if (requestedFields.length === 0) {
    return next(); // No valid fields specified
  }

  // Intercept res.json to filter fields
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    const filtered = filterFields(data, requestedFields);
    return originalJson(filtered);
  };

  next();
}

/**
 * Filter object or array of objects to only include requested fields
 */
function filterFields(data: any, fields: string[]): any {
  if (Array.isArray(data)) {
    // Filter each object in the array
    return data.map(item => filterObject(item, fields));
  } else if (data && typeof data === 'object') {
    // Filter single object
    return filterObject(data, fields);
  }
  
  // Return primitive values as-is
  return data;
}

/**
 * Filter a single object to only include requested fields
 */
function filterObject(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const filtered: any = {};
  
  for (const field of fields) {
    if (field in obj) {
      filtered[field] = obj[field];
    }
  }

  return filtered;
}

/**
 * Calculate bandwidth savings from field filtering
 */
export function calculateBandwidthSavings(original: any, filtered: any): number {
  const originalSize = JSON.stringify(original).length;
  const filteredSize = JSON.stringify(filtered).length;
  const savings = ((originalSize - filteredSize) / originalSize) * 100;
  return Math.round(savings);
}
