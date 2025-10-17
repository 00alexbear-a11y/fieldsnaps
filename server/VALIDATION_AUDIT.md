# Input Validation Audit Report

## Executive Summary
This document audits input validation across all API routes and identifies gaps, security concerns, and recommended improvements.

**Current State:**
- ✅ Most POST/PATCH routes use Zod schema validation
- ⚠️ Query parameters lack validation
- ⚠️ File uploads need stronger type/size validation
- ⚠️ Route parameters (IDs, tokens) lack format validation
- ✅ Request bodies are generally well-validated

## Validation Coverage by Route Category

### ✅ WELL-VALIDATED Routes

**Projects**
- `POST /api/projects` - Uses `insertProjectSchema.parse()`
- `PATCH /api/projects/:id` - Uses `insertProjectSchema.partial().parse()`
- ✅ Complete validation

**Photos**
- `POST /api/projects/:projectId/photos` - Uses `insertPhotoSchema.parse()`
- `PATCH /api/photos/:id` - Uses `insertPhotoSchema.partial().parse()`
- ✅ Metadata validation complete

**Tasks**
- `POST /api/tasks` - Uses `insertTaskSchema.parse()`
- ✅ Complete validation

**Tags**
- `POST /api/tags` - Uses `insertTagSchema.parse()`
- `PATCH /api/tags/:id` - Uses `insertTagSchema.partial().parse()`
- ✅ Complete validation

**Photo Annotations**
- `POST /api/photos/:photoId/annotations` - Uses `insertPhotoAnnotationSchema.parse()`
- ✅ Complete validation

**Comments**
- `POST /api/photos/:photoId/comments` - Uses `insertCommentSchema.parse()`
- ✅ Complete validation

### ⚠️ WEAK VALIDATION Routes

#### 1. Query Parameters (HIGH PRIORITY)
```typescript
// Current: No validation
app.get("/api/tags", async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const tags = await storage.getTags(projectId);
});
```

**Risks:**
- SQL injection if projectId is malformed
- Unexpected behavior with invalid UUIDs
- No type checking

**Recommended Fix:**
```typescript
import { z } from 'zod';

const querySchema = z.object({
  projectId: z.string().uuid().optional(),
});

app.get("/api/tags", async (req, res) => {
  try {
    const { projectId } = querySchema.parse(req.query);
    const tags = await storage.getTags(projectId);
    res.json(tags);
  } catch (error) {
    handleError(res, error);
  }
});
```

#### 2. File Uploads (HIGH PRIORITY)
```typescript
// Current: Basic multer validation
app.post("/api/projects/:projectId/photos", upload.single('photo'), async (req, res) => {
  if (!req.file) {
    throw errors.badRequest("No photo file provided");
  }
  // No type/size validation
});
```

**Risks:**
- Malicious file types (executables, scripts)
- Oversized files causing memory issues
- Invalid media types

**Current Multer Config Needed:**
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'video/mp4',
      'video/quicktime', // .mov files
      'video/x-msvideo',  // .avi files
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`));
    }
  },
});
```

#### 3. Route Parameters (MEDIUM PRIORITY)
```typescript
// Current: No validation
app.get("/api/projects/:id", async (req, res) => {
  const project = await storage.getProject(req.params.id);
  // What if ID is malformed?
});
```

**Risks:**
- Database errors with invalid UUIDs
- Potential injection attacks
- Poor error messages

**Recommended Fix:**
```typescript
const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const project = await storage.getProject(id);
    // ...
  } catch (error) {
    handleError(res, error);
  }
});
```

#### 4. Invite Tokens (MEDIUM PRIORITY)
```typescript
// Current: No token format validation
app.get("/api/companies/invite/:token", async (req, res) => {
  const invite = await storage.getInviteByToken(req.params.token);
});
```

**Risks:**
- Unexpected behavior with malformed tokens
- Timing attacks if no rate limiting

**Recommended Fix:**
```typescript
const tokenParamSchema = z.object({
  token: z.string().min(16).max(64).regex(/^[a-zA-Z0-9_-]+$/),
});

app.get("/api/companies/invite/:token", async (req, res) => {
  try {
    const { token } = tokenParamSchema.parse(req.params);
    // ...
  } catch (error) {
    handleError(res, error);
  }
});
```

#### 5. Share Tokens (MEDIUM PRIORITY)
```typescript
// Current: No token validation
app.get("/api/shared/:token", async (req, res) => {
  const share = await storage.getShareByToken(req.params.token);
});
```

**Same risks and fix as invite tokens above**

### 🔒 SECURITY CONCERNS

#### 1. File Upload Security
**Current State:** Basic file acceptance, no strict validation

**Recommendations:**
- ✅ Validate file MIME types
- ✅ Enforce file size limits (50MB max)
- ✅ Scan file content (magic numbers) to verify actual type
- ✅ Sanitize filenames
- ✅ Rate limit uploads per user

#### 2. Parameter Injection
**Current State:** Query params and route params not validated

**Recommendations:**
- ✅ Validate all UUID parameters
- ✅ Validate all query parameters with Zod schemas
- ✅ Use parameterized queries (already done with Drizzle)

#### 3. Content Length
**Current State:** No explicit content-length validation

**Recommendations:**
- ✅ Add Express body-parser limits
- ✅ Reject oversized JSON payloads

```typescript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

## Validation Best Practices

### 1. Always Validate Route Parameters
```typescript
// UUID parameters
const uuidSchema = z.object({ id: z.string().uuid() });

// Token parameters
const tokenSchema = z.object({ 
  token: z.string().min(16).max(64).regex(/^[a-zA-Z0-9_-]+$/) 
});
```

### 2. Always Validate Query Parameters
```typescript
const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(200).optional(),
  projectId: z.string().uuid().optional(),
});
```

### 3. Validate File Uploads Strictly
```typescript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

if (!req.file) {
  throw errors.badRequest('No file provided');
}

if (![...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].includes(req.file.mimetype)) {
  throw errors.badRequest(`Invalid file type: ${req.file.mimetype}`);
}

if (req.file.size > MAX_FILE_SIZE) {
  throw errors.badRequest('File too large (max 50MB)');
}
```

### 4. Validate Before Database Operations
```typescript
// Bad: Validate after fetching
const project = await storage.getProject(req.params.id);
const validated = insertProjectSchema.parse(req.body);

// Good: Validate first
const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
const validated = insertProjectSchema.parse(req.body);
const project = await storage.getProject(id);
```

## Implementation Priority

### Phase 1: High Priority (Security-Critical)
1. ✅ Configure multer with file type and size limits
2. ✅ Add UUID validation to all `:id` route parameters
3. ✅ Add validation to query parameters in GET routes
4. ✅ Add Express body size limits

### Phase 2: Medium Priority (Error Handling)
5. ✅ Add token format validation (invites, shares)
6. ✅ Add validation to all remaining route parameters
7. ✅ Standardize error responses for validation failures

### Phase 3: Low Priority (Enhancements)
8. ✅ Add rate limiting per route
9. ✅ Add request logging with validation errors
10. ✅ Add content-type verification for all POST/PATCH

## Example Implementations

### Example 1: Query Parameter Validation
```typescript
const getProjectsQuerySchema = z.object({
  completed: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

app.get("/api/projects", isAuthenticated, async (req, res) => {
  try {
    const query = getProjectsQuerySchema.parse(req.query);
    const projects = await storage.getProjects(query);
    res.json(projects);
  } catch (error) {
    handleError(res, error);
  }
});
```

### Example 2: UUID Parameter Validation Middleware
```typescript
// Create reusable middleware
const validateUuidParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const schema = z.object({
      [paramName]: z.string().uuid(),
    });
    
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      handleError(res, error);
    }
  };
};

// Usage
app.get("/api/projects/:id", validateUuidParam('id'), async (req, res) => {
  const project = await storage.getProject(req.params.id);
  res.json(project);
});
```

### Example 3: File Upload with Validation
```typescript
const validatePhotoUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    throw errors.badRequest('No file provided');
  }
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    throw errors.badRequest(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
  }
  
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (req.file.size > maxSize) {
    throw errors.badRequest('File too large (max 50MB)');
  }
  
  next();
};

app.post("/api/projects/:projectId/photos", 
  isAuthenticated,
  upload.single('photo'),
  validatePhotoUpload,
  async (req, res) => {
    // File is validated, proceed with upload
  }
);
```

## Testing Validation

### Test Invalid Inputs
```typescript
// Test invalid UUID
const res = await request(app)
  .get('/api/projects/not-a-uuid')
  .expect(400);
expect(res.body.code).toBe('VALIDATION_ERROR');

// Test invalid query param
const res = await request(app)
  .get('/api/projects?limit=-1')
  .expect(400);

// Test invalid file type
const res = await request(app)
  .post('/api/projects/123/photos')
  .attach('photo', Buffer.from('test'), {
    filename: 'test.exe',
    contentType: 'application/x-msdownload',
  })
  .expect(400);
```

## Summary

**Current Validation Coverage:** ~70%
- ✅ Request bodies: Well-validated
- ⚠️ Route parameters: Weak validation
- ⚠️ Query parameters: No validation
- ⚠️ File uploads: Basic validation

**Priority Actions:**
1. Add multer file type/size limits (HIGH)
2. Validate UUID route parameters (HIGH)
3. Validate query parameters (HIGH)
4. Add token format validation (MEDIUM)
5. Add rate limiting (MEDIUM)

**Expected Impact:**
- Reduced database errors from invalid inputs
- Better error messages for users
- Improved security posture
- Prevented injection attacks
