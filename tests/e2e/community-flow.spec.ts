import { test, expect } from '@playwright/test';

test.describe('Community Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3001/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display community page', async ({ page }) => {
    // Navigate to community page
    await page.goto('http://localhost:3001/community');
    
    // Verify community page is loaded
    await expect(page.locator('text=Community')).toBeVisible();
    
    // Verify posts are displayed
    await expect(page.locator('[class*="post"]')).toBeVisible();
  });

  test('should create a new post', async ({ page }) => {
    // Navigate to community page
    await page.goto('http://localhost:3001/community');
    
    // Click create post button
    await page.click('button:has-text("Create Post")');
    
    // Wait for create post form
    await page.waitForTimeout(1000);
    
    // Fill post form
    await page.fill('input[name="title"]', 'Test Post');
    await page.fill('textarea[name="content"]', 'This is a test post content.');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for post to be created
    await page.waitForTimeout(1000);
    
    // Verify post is displayed
    await expect(page.locator('text=Test Post')).toBeVisible();
  });

  test('should like a post', async ({ page }) => {
    // Navigate to community page
    await page.goto('http://localhost:3001/community');
    
    // Wait for posts to load
    await page.waitForSelector('[class*="post"]');
    
    // Get initial like count
    const initialLikeCount = await page.locator('[class*="like-count"]:first-child').textContent();
    
    // Click like button on first post
    await page.click('[class*="like-button"]:first-child');
    
    // Wait for like to be registered
    await page.waitForTimeout(1000);
    
    // Verify like count increased
    const newLikeCount = await page.locator('[class*="like-count"]:first-child').textContent();
    expect(parseInt(newLikeCount || '0')).toBeGreaterThan(parseInt(initialLikeCount || '0'));
  });

  test('should add a comment', async ({ page }) => {
    // Navigate to community page
    await page.goto('http://localhost:3001/community');
    
    // Wait for posts to load
    await page.waitForSelector('[class*="post"]');
    
    // Click on a post to view details
    await page.click('[class*="post"]:first-child');
    
    // Wait for post details to load
    await page.waitForTimeout(1000);
    
    // Fill comment form
    await page.fill('textarea[name="comment"]', 'This is a test comment.');
    
    // Submit comment
    await page.click('button:has-text("Submit Comment")');
    
    // Wait for comment to be added
    await page.waitForTimeout(1000);
    
    // Verify comment is displayed
    await expect(page.locator('text=This is a test comment.')).toBeVisible();
  });
});
