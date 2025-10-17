# Error Handling Guidelines

## Overview
FieldSnaps uses a standardized error handling system defined in `server/errorHandler.ts`. This document provides guidelines for consistent error handling across the API.

## Error Handler Infrastructure

### Error Codes
```typescript
enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}
```

### AppError Class
Custom error class that encapsulates error code, HTTP status, message, and optional details:
```typescript
throw new AppError(ErrorCode.NOT_FOUND, 404, 'Project not found');
```

### Error Helpers
Pre-configured helpers for common error scenarios:
```typescript
// Resource not found
throw errors.notFound('Project');

// Bad request
throw errors.badRequest('Invalid project name', { field: 'name' });

// Unauthorized
throw errors.unauthorized();

// Forbidden
throw errors.forbidden('Only owners can delete projects');

// Validation error
throw errors.validation('Invalid input', zodError.issues);

// Internal error
throw errors.internal('Failed to process request');

// Database error
throw errors.database('Failed to update record');
```

## Best Practices

### 1. Use handleError in Catch Blocks
Always use `handleError(res, error)` in catch blocks for consistent error handling:

```typescript
// ✅ GOOD
app.post("/api/projects", async (req, res) => {
  try {
    const validated = insertProjectSchema.parse(req.body);
    const project = await storage.createProject(validated);
    res.status(201).json(project);
  } catch (error: any) {
    handleError(res, error);
  }
});

// ❌ AVOID (unless specific error codes needed)
app.post("/api/projects", async (req, res) => {
  try {
    // ...
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

**Benefits:**
- Automatically handles Zod validation errors
- Provides consistent error response format
- Logs errors for debugging
- Returns proper HTTP status codes

### 2. Throw AppError for Known Error Conditions
Use error helpers for predictable error scenarios:

```typescript
// ✅ GOOD
const project = await storage.getProject(req.params.id);
if (!project) {
  throw errors.notFound('Project');
}

// ❌ AVOID (direct response)
const project = await storage.getProject(req.params.id);
if (!project) {
  return res.status(404).json({ error: "Project not found" });
}
```

### 3. Validation Errors
Zod validation errors are automatically handled by `handleError`:

```typescript
app.post("/api/projects", async (req, res) => {
  try {
    // This will throw ZodError if validation fails
    const validated = insertProjectSchema.parse(req.body);
    // ...
  } catch (error: any) {
    // handleError automatically formats Zod errors
    handleError(res, error);
  }
});
```

### 4. Authorization Checks
For inline authorization checks that need immediate response:

```typescript
// Current pattern (acceptable for simple checks)
if (!user || !user.companyId) {
  return res.status(403).json({ error: "User must belong to a company" });
}

// Future pattern (recommended for consistency)
if (!user || !user.companyId) {
  throw errors.forbidden('User must belong to a company');
}
```

## Error Response Format

### Standard Error Response
```json
{
  "code": "NOT_FOUND",
  "message": "Project not found"
}
```

### Validation Error Response
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "issues": [
      {
        "path": ["name"],
        "message": "Required"
      }
    ]
  }
}
```

## HTTP Status Codes

| Status | Error Code | Usage |
|--------|-----------|-------|
| 400 | BAD_REQUEST | Invalid request format or parameters |
| 400 | VALIDATION_ERROR | Zod schema validation failures |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Authenticated but lacking permissions |
| 404 | NOT_FOUND | Requested resource doesn't exist |
| 409 | CONFLICT | Resource conflict (e.g., duplicate) |
| 500 | INTERNAL_ERROR | Unexpected server errors |
| 500 | DATABASE_ERROR | Database operation failures |
| 500 | EXTERNAL_API_ERROR | Third-party API failures |

## Migration Strategy

### Current State
- **Standardized:** 3 routes use `handleError(res, error)`
- **Legacy:** 154 routes use direct `res.status(...).json({ error: ... })`

### Incremental Migration Plan

**Phase 1: High-Traffic Routes** (Priority)
- `/api/companies/*`
- `/api/projects/*`
- `/api/photos/*`
- `/api/tasks/*`

**Phase 2: Billing & Critical Paths**
- `/api/billing/*`
- `/api/auth/*`
- `/api/subscription/*`

**Phase 3: Remaining Routes**
- All other endpoints

### Migration Checklist
- [ ] Replace catch block error responses with `handleError(res, error)`
- [ ] Convert resource not found checks to `throw errors.notFound(resource)`
- [ ] Update authorization failures to `throw errors.forbidden(message)`
- [ ] Ensure Zod validation uses try/catch with `handleError`
- [ ] Test error responses match expected format
- [ ] Verify HTTP status codes are correct

## Testing Error Handling

### Test Different Error Types
```typescript
// Test validation error
const response = await request(app)
  .post('/api/projects')
  .send({ invalid: 'data' });
expect(response.status).toBe(400);
expect(response.body.code).toBe('VALIDATION_ERROR');

// Test not found
const response = await request(app)
  .get('/api/projects/invalid-id');
expect(response.status).toBe(404);
expect(response.body.code).toBe('NOT_FOUND');

// Test authorization
const response = await request(app)
  .delete('/api/projects/123')
  .auth('non-owner-token');
expect(response.status).toBe(403);
expect(response.body.code).toBe('FORBIDDEN');
```

## Logging

The `handleError` function automatically logs errors:
```typescript
console.error('Error:', error);
```

For production, consider enhancing with structured logging:
```typescript
import winston from 'winston';

logger.error('API error', {
  code: error.code,
  message: error.message,
  path: req.path,
  method: req.method,
  userId: req.user?.id,
  timestamp: new Date().toISOString(),
});
```

## Common Patterns

### Database Operations
```typescript
try {
  const result = await storage.updateProject(id, data);
  if (!result) {
    throw errors.notFound('Project');
  }
  res.json(result);
} catch (error) {
  handleError(res, error);
}
```

### Authorization Checks
```typescript
if (project.companyId !== user.companyId) {
  throw errors.forbidden('Access denied');
}
```

### Validation
```typescript
try {
  const validated = insertProjectSchema.parse(req.body);
  // Process validated data
} catch (error) {
  handleError(res, error); // Automatically formats Zod errors
}
```

### External API Calls
```typescript
try {
  const response = await fetch(externalApiUrl);
  if (!response.ok) {
    throw errors.external('Failed to fetch from external API');
  }
} catch (error) {
  handleError(res, error);
}
```

## Future Enhancements

1. **Rate Limiting Errors**: Add `TOO_MANY_REQUESTS` error code
2. **Structured Logging**: Integrate Winston or Pino for production logging
3. **Error Monitoring**: Add Sentry or similar for error tracking
4. **Client Error Types**: Export error codes for frontend type safety
5. **Error Recovery**: Add retry logic for transient failures
6. **Validation Details**: Enhanced Zod error formatting for better UX
