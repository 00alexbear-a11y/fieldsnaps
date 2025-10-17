# Database Query Optimization Guide

## Overview
This document outlines query optimization patterns implemented in FieldSnaps and best practices for maintaining optimal database performance.

## Optimization Patterns Implemented

### 1. Batch Queries to Eliminate N+1 Issues

**Problem**: Making individual queries inside loops leads to N+1 query problems.

**Solution**: Use batch operations with `inArray()` to fetch related data in a single query.

#### Example: Tag Seeding Optimization
```typescript
// ❌ BAD: N+1 queries (1 check + 1 insert per tag = 8 queries)
for (const tag of predefinedTags) {
  const existing = await db.select().from(tags).where(eq(tags.name, tag.name));
  if (existing.length === 0) {
    await db.insert(tags).values(tag);
  }
}

// ✅ GOOD: Batch check + batch insert (2 queries total)
const tagNames = predefinedTags.map(t => t.name);
const existingTags = await db.select().from(tags)
  .where(inArray(tags.name, tagNames));

const existingNames = new Set(existingTags.map(t => t.name));
const tagsToInsert = predefinedTags.filter(tag => !existingNames.has(tag.name));

if (tagsToInsert.length > 0) {
  await db.insert(tags).values(tagsToInsert);
}
```

**Performance Gain**: 75% reduction in queries (from 8 to 2).

### 2. JOIN Related Data to Prevent Future N+1

**Problem**: Fetching user data separately for each comment/annotation creates N+1 issues.

**Solution**: Use LEFT JOIN to include related data in the initial query.

#### Example: Comments with User Data
```typescript
// ❌ BAD: Would need N additional queries to fetch user data
const comments = await db.select().from(comments)
  .where(eq(comments.photoId, photoId));
// Then: for each comment, fetch user data separately

// ✅ GOOD: Single query with JOIN
const comments = await db
  .select({
    id: comments.id,
    photoId: comments.photoId,
    userId: comments.userId,
    content: comments.content,
    createdAt: comments.createdAt,
    user: {
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    },
  })
  .from(comments)
  .leftJoin(users, eq(comments.userId, users.id))
  .where(eq(comments.photoId, photoId));
```

**Applied to**:
- `getPhotoComments()` - includes user data
- `getPhotoAnnotations()` - includes user data
- `getTasksAssignedToUser()` - includes project data

### 3. Efficient Aggregation with GROUP BY

**Pattern**: Use SQL aggregation instead of fetching all data and counting in application code.

#### Example: Project Photo Counts
```typescript
// ✅ GOOD: Single query with aggregation
const projects = await db
  .select({
    ...projectFields,
    photoCount: sql<number>`CAST(COUNT(CASE WHEN ${photos.deletedAt} IS NULL THEN 1 END) AS INTEGER)`,
  })
  .from(projects)
  .leftJoin(photos, eq(photos.projectId, projects.id))
  .groupBy(projects.id);
```

**Benefits**:
- Database performs counting (faster)
- Reduces data transfer
- Single query instead of N+1

## Index Strategy

### Current Index Coverage

Our database has comprehensive index coverage for optimal query performance:

#### 1. **Composite Indexes**
```sql
-- Photos: Optimizes project photo queries with soft-delete filtering
CREATE INDEX idx_photos_project_active ON photos (project_id, deleted_at, created_at)
WHERE deleted_at IS NULL;

-- Supports: WHERE projectId = X AND deletedAt IS NULL ORDER BY createdAt
```

#### 2. **Partial Indexes**
```sql
-- Projects: Active projects only
CREATE INDEX idx_projects_active ON projects (created_at)
WHERE deleted_at IS NULL;

-- Projects: Trash queries
CREATE INDEX idx_projects_trash ON projects (deleted_at DESC)
WHERE deleted_at IS NOT NULL;
```

#### 3. **Foreign Key Indexes**
All foreign key columns are indexed:
- `companies.ownerId`
- `users.companyId`
- `projects.companyId, createdBy`
- `photos.projectId, photographerId`
- `tasks.projectId, assignedTo, createdBy`
- `comments.photoId, userId`
- `photoAnnotations.photoId, userId`
- `photoTags.photoId, tagId`

### When to Add New Indexes

Only add indexes when:
1. **Query analysis shows slow performance** on specific WHERE/JOIN clauses
2. **You have multi-column WHERE clauses** not covered by existing indexes
3. **Sort operations (ORDER BY)** on large datasets are slow

**Note**: Over-indexing slows down writes. Our current coverage is excellent.

## Best Practices

### 1. Prevent N+1 Queries

**Rule**: Never make database queries inside loops or `.map()` operations.

```typescript
// ❌ AVOID
const photos = await getPhotos();
for (const photo of photos) {
  const user = await getUser(photo.userId); // N+1!
}

// ✅ USE
const photos = await getPhotos();
const userIds = photos.map(p => p.userId);
const users = await db.select().from(users).where(inArray(users.id, userIds));
const userMap = new Map(users.map(u => [u.id, u]));
```

### 2. Use Joins for Related Data

When fetching data that commonly needs related information, include it in the query:

```typescript
// ✅ One query with all needed data
const tasksWithProjects = await db
  .select({
    ...taskFields,
    project: { id: projects.id, name: projects.name }
  })
  .from(tasks)
  .innerJoin(projects, eq(tasks.projectId, projects.id));
```

### 3. Leverage Existing Indexes

Write queries that use indexed columns in WHERE clauses:

```typescript
// ✅ Uses idx_photos_project_active
const photos = await db.select().from(photos)
  .where(and(
    eq(photos.projectId, projectId),  // indexed
    isNull(photos.deletedAt)           // indexed
  ))
  .orderBy(photos.createdAt);          // indexed
```

### 4. Batch Operations

For multiple inserts/updates, use batch operations:

```typescript
// ❌ Multiple queries
for (const item of items) {
  await db.insert(table).values(item);
}

// ✅ Single batch insert
await db.insert(table).values(items);
```

### 5. Update Interface Types

When enriching queries with joins, update the storage interface:

```typescript
// Interface
getPhotoComments(photoId: string): Promise<(Comment & { user?: User })[]>;

// Implementation
async getPhotoComments(photoId: string): Promise<(Comment & { user?: User })[]> {
  const result = await db.select({...}).from(comments)
    .leftJoin(users, eq(comments.userId, users.id));
  return result;
}
```

## Performance Monitoring

### Query Analysis Tools

1. **EXPLAIN ANALYZE**: Use PostgreSQL's query planner
```sql
EXPLAIN ANALYZE 
SELECT * FROM photos 
WHERE project_id = 'xxx' AND deleted_at IS NULL;
```

2. **Check Index Usage**:
```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### Common Issues to Watch For

1. **Sequential scans** on large tables (missing index)
2. **Multiple queries** for related data (missing join)
3. **Counting in application code** (use SQL COUNT)
4. **Fetching unused columns** (select only needed fields)

## Migration Patterns

When adding fields that require JOINs:

1. **Make new fields nullable** for backwards compatibility
2. **Update schema** with new column and index
3. **Run `npm run db:push`** to apply changes
4. **Update storage method** to include JOIN
5. **Update interface signature** to match new return type
6. **Update routes** to populate new field

## Implemented Optimizations

### ✅ Completed
- **seedPredefinedTags()**: Eliminated N+1 with batch check + insert (75% fewer queries)
- **getPhotoComments()**: Added user JOIN to prevent future N+1
- **getPhotoAnnotations()**: Added user JOIN to prevent future N+1
- **getProjectPhotos()**: Already optimized with batch tag fetching
- **getProjectsWithPhotoCounts()**: Uses efficient aggregation

### Current Performance
- All critical queries use proper indexes
- No active N+1 issues identified
- Efficient JOIN patterns for related data
- Batch operations for bulk inserts

## Future Considerations

As the application scales:
- Monitor slow query logs
- Consider read replicas for heavy read operations
- Implement query result caching for frequently accessed data
- Use materialized views for complex aggregations
- Add database connection pooling for high concurrency
